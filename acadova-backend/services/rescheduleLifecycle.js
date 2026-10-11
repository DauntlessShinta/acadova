const Session = require('../models/Session');
const { commitSchedule } = require('./sessionRequestIntegrity');
const notifications = require('./notificationService');
const mongoose = require('mongoose');
const { completionView } = require('../utils/completionPresentation');

const CHECK_IN_LATE_MS = 4 * 60 * 60 * 1000;
const rescheduleFields = { proposedScheduledAt: 1, rescheduleProposedBy: 1,
  rescheduleProposedAt: 1, rescheduleProposalId: 1, rescheduleExpiresAt: 1 };
const idOf = (value) => String(value?._id || value || '');
const timeOf = (value) => value ? new Date(value).getTime() : NaN;
function lifetimeMs() {
  const hours = Number(process.env.RESCHEDULE_PROPOSAL_HOURS);
  return (Number.isFinite(hours) && hours >= 1 && hours <= 168 ? hours : 24) * 3600000;
}
function proposalExpiry(session) {
  const proposed = timeOf(session.proposedScheduledAt);
  const created = timeOf(session.rescheduleProposedAt);
  if (!Number.isFinite(proposed) || !Number.isFinite(created)) return new Date(0);
  const snapshot = timeOf(session.rescheduleExpiresAt);
  const original = timeOf(session.scheduledAt);
  return new Date(Math.min(proposed, Number.isFinite(snapshot) ? snapshot : created + lifetimeMs(),
    Number.isFinite(original) ? original + CHECK_IN_LATE_MS : Infinity));
}
function proposalExpired(session, now = new Date()) {
  return Boolean(session.rescheduleProposalId || session.proposedScheduledAt)
    && proposalExpiry(session).getTime() <= now.getTime();
}
function presentSession(session, now = new Date()) {
  const row = session.toObject ? session.toObject() : { ...session };
  return { ...row, serverNow: now, completionReview: completionView(row, now), rescheduleExpiresAtEffective:
    row.rescheduleProposalId || row.proposedScheduledAt ? proposalExpiry(row) : null,
  proposalStatus: row.rescheduleProposalId || row.proposedScheduledAt
    ? proposalExpired(row, now) ? 'expired' : 'active' : null };
}
const attendanceFree = { learnerCheckedInAt: null, tutorCheckedInAt: null,
  startedAt: null, completedAt: null, confirmedAt: null, creditsSettledAt: null };
function proposalClaim(session) {
  return { _id: session._id, status: session.status, scheduledAt: session.scheduledAt ?? null,
    rescheduleProposalId: session.rescheduleProposalId ?? null,
    proposedScheduledAt: session.proposedScheduledAt ?? null };
}
function historyEntry(session, outcome, actor, now = new Date()) {
  return { proposalId: session.rescheduleProposalId || 'legacy', outcome,
    ...(actor ? { actor: new mongoose.Types.ObjectId(idOf(actor)) } : {}), at: now, scheduledAt: session.scheduledAt,
    proposedScheduledAt: session.proposedScheduledAt, expiresAt: proposalExpiry(session) };
}
const historyPush = (entry) => ({ rescheduleHistory: { $each: [entry], $slice: -20 } });
function expiryExpression() {
  return { $min: [
    { $ifNull: ['$rescheduleExpiresAt', { $add: [{ $ifNull: ['$rescheduleProposedAt', new Date(0)] }, lifetimeMs()] }] },
    { $ifNull: ['$proposedScheduledAt', new Date(0)] },
    { $cond: [{ $eq: [{ $type: '$scheduledAt' }, 'date'] },
      { $add: ['$scheduledAt', CHECK_IN_LATE_MS] }, new Date(8640000000000000)] },
  ] };
}
// The business write and durable in-app/provider intent share a transaction.
// Delivery occurs only in the existing restart-safe worker after commit.
async function proposalMutation(session, instant, write, event) {
  return commitSchedule(session, instant, async (dbSession) => {
    const updated = await write(dbSession);
    if (updated && event) await notifications.enqueueProposalEvent(event.type,
      event.source ? event.source : updated, event.recipients, dbSession);
    return updated;
  });
}
async function expireProposal(session, now = new Date()) {
  if (!proposalExpired(session, now)) return session;
  const updated = await proposalMutation(session, null, (dbSession) => Session.findOneAndUpdate(
    { ...proposalClaim(session), $expr: { $lte: [proposalExpiry(session), '$$NOW'] } },
    { $unset: rescheduleFields, $push: historyPush(historyEntry(session, 'expired', null, now)) },
    { new: true, runValidators: true, session: dbSession }),
  { type: 'session.reschedule_expired', source: session, recipients: [session.learner, session.tutor] });
  if (!updated) throw Object.assign(new Error('This proposal changed. Refresh to review the latest schedule.'), { status: 409 });
  return updated;
}
module.exports = { CHECK_IN_LATE_MS, rescheduleFields, lifetimeMs, proposalExpiry,
  proposalExpired, presentSession, attendanceFree, proposalClaim, historyEntry,
  historyPush, expiryExpression, proposalMutation, expireProposal };
