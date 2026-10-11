const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const Session = require('../models/Session');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const notifications = require('./notificationService');
const { completionSettings } = require('../config/completionSettings');
const { hasCanonicalEvidence, completionView } = require('../utils/completionPresentation');
const idOf = (value) => String(value?._id || value || '');
const conflict = () => Object.assign(new Error('This review changed. Refresh the evidence before trying again.'), { status: 409 });
const unsettled = { completedAt: null, creditsSettledAt: null, resolvedAt: null, resolution: null };
async function inTransaction(write) {
  const dbSession = await mongoose.startSession();
  try { let result; await dbSession.withTransaction(async () => { result = await write(dbSession); }); return result; }
  finally { await dbSession.endSession(); }
}
async function staffRecipients(dbSession, adminsOnly = false) {
  return User.find({ role: adminsOnly ? 'admin' : { $in: ['moderator', 'admin'] },
    suspendedAt: null, emailVerified: { $ne: false } }).select('_id').sort({ _id: 1 }).limit(100).session(dbSession).lean();
}
async function enqueueCompletionEvent(type, row, recipients, dbSession, occurrence, target = 'completion') {
  if (!dbSession) throw new Error('Completion events require their business transaction');
  for (const recipient of [...new Set(recipients.map(idOf))]) {
    await notifications.publish({ recipient, type, relatedType: 'Session', relatedId: idOf(row),
      eventKey: `${type}:${idOf(row)}:${recipient}:${occurrence}`, dbSession, deferPush: true, actionTarget: target });
  }
}
function reviewClaim(row) {
  return { _id: row._id, status: row.status, ...unsettled,
    reviewVersion: row.reviewVersion ?? null };
}
function isOpenReview(row) {
  return row.status === 'disputed' || Boolean(row.status === 'awaiting_validation'
    && row.reviewReferral && !row.reviewReferral.closedAt);
}
async function referForReview(id, { actor, reason, now = new Date() } = {}) {
  return inTransaction(async (dbSession) => {
    const row = await Session.findById(id).session(dbSession);
    if (!row) throw Object.assign(new Error('Session not found.'), { status: 404 });
    if (!actor && (row.status !== 'awaiting_validation' || row.reviewReferral
      || !row.validationDeadlineAt || new Date(row.validationDeadlineAt) > now)) return null;
    if (actor && idOf(row.tutor) !== actor.id) throw Object.assign(new Error('Only the Tutor can request completion review.'), { status: 403 });
    if (!completionView(row, now).canTutorRequestReview) throw conflict();
    if (!hasCanonicalEvidence(row)) throw Object.assign(new Error('Canonical finish and check-in evidence is required for completion review.'), { status: 409 });
    if (actor && !(row.completionEvidence || []).some((item) => idOf(item.submittedBy) === actor.id)) {
      throw Object.assign(new Error('Submit your session summary and completed-work evidence before requesting review.'), { status: 400 });
    }
    if (await CreditTransaction.exists({ session: row._id }).session(dbSession)) throw conflict();
    const referral = { id: randomUUID(), source: actor ? row.validationDeadlineAt ? 'tutor_request' : 'legacy_tutor_request' : 'system_overdue',
      reason: actor ? reason : 'Response deadline passed with completion confirmation unresolved.',
      ...(actor ? { requestedBy: actor.id } : {}), createdAt: now,
      targetAt: new Date(now.getTime() + completionSettings().staffTargetHours * 3600000) };
    const claim = { ...reviewClaim(row), status: 'awaiting_validation', reviewReferral: null,
      awaitingValidationAt: row.awaitingValidationAt, validationDeadlineAt: row.validationDeadlineAt ?? null };
    if (!actor || row.validationDeadlineAt) claim.validationDeadlineAt = { $lte: now };
    const updated = await Session.findOneAndUpdate(claim,
      { $set: { reviewReferral: referral }, $inc: { reviewVersion: 1 } },
      { returnDocument: 'after', runValidators: true, session: dbSession });
    if (!updated) throw conflict();
    await enqueueCompletionEvent('session.review_referred', updated, [row.learner, row.tutor], dbSession, referral.id);
    await enqueueCompletionEvent('session.review_referred', updated, await staffRecipients(dbSession), dbSession, referral.id, 'staff_review');
    return updated;
  });
}
async function scanCompletion(referenceNow) {
  let now = referenceNow || new Date();
  const rows = await Session.find({ status: 'awaiting_validation', ...unsettled,
    validationDeadlineAt: { $type: 'date' }, $or: [
      { validationDeadlineAt: { $lte: now }, reviewReferral: null },
      { validationDeadlineAt: { $gt: now }, $or: [24, 48].flatMap((slot) => ['learner', 'tutor'].map((role) => ({
        awaitingValidationAt: { $lte: new Date(now.getTime() - slot * 3600000) },
        [`${role}ConfirmedAt`]: null, validationReminderMarks: { $ne: `${role}:${slot}` },
      }))) },
    ] }).sort({ awaitingValidationAt: 1, _id: 1 }).limit(200).lean();
  let reminders = 0; let referrals = 0;
  for (const row of rows) {
    now = referenceNow || new Date();
    if (new Date(row.validationDeadlineAt) <= now) {
      try { if (await referForReview(row._id, { now })) referrals++; }
      catch (error) { if (error.status !== 409) throw error; }
      continue;
    }
    for (const slot of [24, 48]) for (const role of ['learner', 'tutor']) {
      if (new Date(row.awaitingValidationAt).getTime() + slot * 3600000 > now.getTime()) continue;
      const mark = `${role}:${slot}`;
      if (row[`${role}ConfirmedAt`] || row.validationReminderMarks?.includes(mark)) continue;
      const created = await inTransaction(async (dbSession) => {
        const claimAt = referenceNow || new Date();
        const updated = await Session.findOneAndUpdate({ _id: row._id, status: 'awaiting_validation', ...unsettled,
          awaitingValidationAt: row.awaitingValidationAt, validationDeadlineAt: { $gt: claimAt },
          [`${role}ConfirmedAt`]: null, validationReminderMarks: { $ne: mark } },
        { $addToSet: { validationReminderMarks: mark } }, { returnDocument: 'after', session: dbSession });
        if (!updated) return false;
        await enqueueCompletionEvent('session.validation_reminder', updated, [row[role]], dbSession,
          `${new Date(row.awaitingValidationAt).toISOString()}:${slot}`);
        return true;
      });
      if (created) reminders++;
    }
  }
  // One escalation to active Admins after the snapshotted staff response target.
  now = referenceNow || new Date();
  const aging = await Session.find({ status: { $in: ['awaiting_validation', 'disputed'] }, ...unsettled,
    'reviewReferral.closedAt': null, 'reviewReferral.escalatedAt': null,
    'reviewReferral.targetAt': { $lte: now } }).sort({ 'reviewReferral.targetAt': 1 }).limit(100).lean();
  let escalations = 0;
  for (const row of aging) {
    const changed = await inTransaction(async (dbSession) => {
      const claimAt = referenceNow || new Date();
      const updated = await Session.findOneAndUpdate({ ...reviewClaim(row), 'reviewReferral.id': row.reviewReferral.id,
        'reviewReferral.closedAt': null, 'reviewReferral.escalatedAt': null },
      { $set: { 'reviewReferral.escalatedAt': claimAt } }, { returnDocument: 'after', session: dbSession });
      if (!updated) return false;
      await enqueueCompletionEvent('session.review_escalated', updated, await staffRecipients(dbSession, true),
        dbSession, row.reviewReferral.id, 'staff_review'); return true;
    });
    if (changed) escalations++;
  }
  return { reminders, referrals, escalations };
}
module.exports = { inTransaction, enqueueCompletionEvent, referForReview, scanCompletion,
  reviewClaim, isOpenReview, conflict, unsettled };
