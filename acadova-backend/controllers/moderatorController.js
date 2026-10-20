const mongoose = require('mongoose');
const Rating = require('../models/Rating');
const Session = require('../models/Session');
const CreditTransaction = require('../models/CreditTransaction');
const { transferSessionCredits } = require('../services/sessionSettlement');
const { isValidObjectId } = require('../middleware/validation');
const { recalculateAverageRating } = require('../utils/ratingReputation');
const { logSecurityEvent } = require('../utils/securityLogger');
const { ACTIONS, recordAudit } = require('../services/auditService');
const notifications = require('../services/notificationService');
const SessionMessage = require('../models/SessionMessage');
const AuditLog = require('../models/AuditLog');
const completion = require('../services/completionLifecycle');
const { presentSession } = require('../services/rescheduleLifecycle');
const { hasCanonicalEvidence } = require('../utils/completionPresentation');
const { randomUUID } = require('node:crypto');

const populateModerationRating = (query) => query
  .populate('fromUser', 'name')
  .populate('toUser', 'name')
  .populate('session', 'subject completedAt')
  .populate('moderatedBy', 'name role');

// GET /api/moderator/ratings - includes visible and hidden reviews for review.
exports.listRatingsForModeration = async (req, res) => {
  try {
    const ratings = await populateModerationRating(
      Rating.find().sort({ createdAt: -1 }).limit(200)
    );

    return res.json({ success: true, message: 'Ratings retrieved for moderation', data: ratings });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error while retrieving moderation reviews' });
  }
};

// PATCH /api/moderator/ratings/:id/visibility
exports.updateRatingVisibility = async (req, res) => {
  let dbSession;
  try {
    const { id } = req.params;
    const { hidden } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid review id' });
    }
    if (typeof hidden !== 'boolean') {
      return res.status(400).json({ success: false, message: 'hidden must be a boolean' });
    }

    dbSession = await mongoose.startSession();
    let rating;
    await dbSession.withTransaction(async () => {
      const previous = await Rating.findById(id).session(dbSession).lean();
      if (!previous) throw Object.assign(new Error('Review not found'), { status: 404 });
      if (Boolean(previous.isHidden) === hidden) {
        throw Object.assign(new Error('Review visibility is already set'), { status: 409 });
      }
      rating = await Rating.findOneAndUpdate({ _id: id, isHidden: hidden ? { $ne: true } : true },
        { $set: { isHidden: hidden, moderatedBy: req.user.id, moderatedAt: new Date() } },
        { new: true, session: dbSession });
      if (!rating) throw Object.assign(new Error('Review changed. Reload and try again.'), { status: 409 });
      await recordAudit({ actor: req.user, action: ACTIONS.review, targetType: 'Rating', targetId: id,
        summary: hidden ? 'Review hidden' : 'Review restored', metadata: { hidden }, session: dbSession });
      await recalculateAverageRating(rating.toUser, dbSession);
    });
    logSecurityEvent('moderation.visibility_changed', req, { reviewId: id, hidden });
    await notifications.notifySafely({ recipient: rating.fromUser, type: 'review.moderated',
      relatedType: 'Rating', relatedId: rating._id,
      eventKey: `review.moderated:${id}:${hidden}:${rating.moderatedAt.toISOString()}` });

    const populatedRating = await populateModerationRating(Rating.findById(rating._id));

    return res.json({
      success: true,
      message: hidden ? 'Review hidden' : 'Review restored',
      data: populatedRating,
    });
  } catch (error) {
    return res.status(error.status || 503).json({ success: false,
      message: error.status ? error.message : 'Review visibility could not be updated' });
  } finally { if (dbSession) await dbSession.endSession(); }
};

exports.listDisputedSessions = async (req, res) => {
  try {
    const sessions = await Session.find({ $or: [{ status: 'disputed' },
      { status: 'awaiting_validation', 'reviewReferral.id': { $exists: true }, 'reviewReferral.closedAt': null }] })
      .populate([{ path: 'learner', select: 'name' }, { path: 'tutor', select: 'name' }, { path: 'disputedBy', select: 'name' }])
      .sort({ disputedAt: -1 })
      .limit(100);
    const payments = sessions.length ? await CreditTransaction.find({ session: { $in: sessions.map((row) => row._id) } })
      .select('session type amount').lean() : [];
    const paymentIds = new Set(payments.map((row) => String(row.session)));
    const data = sessions.map((row) => ({ ...presentSession(row), reviewIndicators: [
      ...(row.noShowAt ? ['no_show_reported'] : []),
      ...(paymentIds.has(String(row._id)) ? ['prior_credit_transaction'] : []),
    ] }));
    return res.json({ success: true, message: 'Disputed sessions retrieved.', data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Disputed sessions could not be loaded.' });
  }
};

exports.listResolvedSessions = async (req, res) => {
  try {
    const rows = await Session.find({ $or: [{ status: 'resolved' },
      { status: 'completed', 'reviewReferral.closure': 'participant_completion' }] })
      .select('subject status learner tutor scheduledAt disputedAt resolvedAt resolvedBy resolution resolutionNote creditsSettledAt reviewReferral completedAt economyVersion validationSettledAt creditAmount lifecycleVersion disputeReason learnerCheckedInAt tutorCheckedInAt startedAt awaitingValidationAt learnerConfirmedAt tutorConfirmedAt')
      .populate([{ path: 'learner', select: 'name' }, { path: 'tutor', select: 'name' }])
      .sort({ resolvedAt: -1 }).limit(100).lean();
    return res.json({ success: true, data: rows });
  } catch { return res.status(503).json({ success: false, message: 'Resolved sessions unavailable.' }); }
};

exports.resolveSessionDispute = async (req, res) => {
  if (!['moderator', 'admin'].includes(req.user?.role)) return res.status(403).json({ success: false, message: 'Only authorized staff can resolve a session review.' });
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid session id.' });
  }
  const { resolution, resolutionNote } = req.body;
  if (!['confirm_session', 'cancel_session'].includes(resolution)
    || typeof resolutionNote !== 'string' || resolutionNote.trim().length < 10
    || resolutionNote.trim().length > 500) {
    return res.status(400).json({ success: false, message: 'Enter a valid outcome and resolution note.' });
  }
  const dbSession = await mongoose.startSession();
  let resolvedSession;
  try {
    await dbSession.withTransaction(async () => {
      resolvedSession = undefined;
      const session = await Session.findById(req.params.id).session(dbSession);
      if (!session) throw Object.assign(new Error('Session not found.'), { status: 404 });
      if(require('../config/studentExperience').active() && session.economyVersion!=='free-v1') throw Object.assign(new Error('Legacy obligations are frozen. Use the audited legacy review and participant-consent workflow.'),{status:410});
      const referralReview = session.status === 'awaiting_validation' && session.reviewReferral && !session.reviewReferral.closedAt;
      if (!completion.isOpenReview(session)) throw completion.conflict();
      if ([String(session.learner), String(session.tutor)].includes(req.user.id)) throw Object.assign(new Error('A participant cannot approve or reject their own session.'), { status: 403 });
      const requiresVersion = referralReview || session.reviewVersion != null;
      if ((requiresVersion && req.body.reviewVersion == null)
        || (req.body.reviewVersion != null && req.body.reviewVersion !== (session.reviewVersion || 0))) throw completion.conflict();
      if ((referralReview ? !hasCanonicalEvidence(session) || !session.reviewReferral.id || !session.reviewReferral.createdAt
        : !session.disputedAt || !session.disputedBy || !session.disputeReason || (!session.awaitingValidationAt && !session.noShowAt))
        || session.resolvedAt || session.resolution || session.completedAt || session.creditsSettledAt) {
        throw Object.assign(new Error('Dispute evidence is incomplete or already resolved.'), { status: 409 });
      }
      const existingPayment = await CreditTransaction.findOne({ session: session._id }).session(dbSession);
      if (existingPayment) {
        throw Object.assign(new Error('This session already has a credit transaction.'), { status: 409 });
      }
      const now = new Date();
      const changes = {
        status: 'resolved', resolvedAt: now, resolvedBy: req.user.id,
        resolution, resolutionNote: resolutionNote.trim(),
      };
      if (resolution === 'confirm_session') {
        changes.completedAt = now;
        if(session.economyVersion==='free-v1') changes.validationSettledAt=now; else changes.creditsSettledAt = now;
      }
      if (session.reviewReferral && !session.reviewReferral.closedAt) {
        changes['reviewReferral.closedAt'] = now;
        changes['reviewReferral.closure'] = 'staff_resolution';
      }
      const claim = await Session.updateOne(
        {
          _id: session._id,
          status: session.status,
          disputedAt: session.disputedAt ?? null,
          reviewVersion: session.reviewVersion ?? null,
          ...(referralReview ? { 'reviewReferral.id': session.reviewReferral.id, 'reviewReferral.closedAt': null } : {}),
          resolvedAt: null,
          resolution: null,
          completedAt: null,
          creditsSettledAt: null,
        },
        { $set: changes, $inc: { reviewVersion: 1 } },
        { session: dbSession, runValidators: true }
      );
      if (claim.matchedCount !== 1) {
        throw Object.assign(new Error('This session has already changed. Refresh and try again.'), { status: 409 });
      }
      Object.assign(session, Object.fromEntries(Object.entries(changes).filter(([key]) => !key.includes('.'))));
      session.reviewVersion = (session.reviewVersion || 0) + 1;
      if (session.reviewReferral) Object.assign(session.reviewReferral, { closedAt: now, closure: 'staff_resolution' });
      if (resolution === 'confirm_session') await transferSessionCredits(session, dbSession);
      await recordAudit({ actor: req.user, action: referralReview ? ACTIONS.completionReview : ACTIONS.dispute, targetType: 'Session',
        targetId: session._id, summary: referralReview ? 'Completion review resolved' : 'Session dispute resolved',
        metadata: { resolution, reason: resolutionNote.trim() }, session: dbSession });
      resolvedSession = session;
    });
    await resolvedSession.populate([{ path: 'learner', select: 'name' }, { path: 'tutor', select: 'name' }]);
    await notifications.notifySession('session.resolved', resolvedSession,
      [resolvedSession.learner, resolvedSession.tutor]);
    return res.json({
      success: true,
      message: resolvedSession.economyVersion==='free-v1' ? (resolution==='confirm_session'?'Free session review resolved as valid. Staff resolution alone does not award EXP.':'Free session review resolved as invalid. No EXP is awarded.') : resolution === 'confirm_session'
        ? 'Session review resolved as valid. Credits transferred once.'
        : 'Session review resolved as invalid. No credits transferred.',
      data: resolvedSession,
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: /enough credits/.test(error.message)
      ? 'The Learner has insufficient credits. This case remains open; request clarification before retrying settlement.' : error.message });
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'This session already has a credit transaction.' });
    return res.status(500).json({ success: false, message: 'Session dispute could not be resolved.' });
  } finally {
    await dbSession.endSession();
  }
};

exports.getSessionReviewEvidence = async (req, res) => {
  if (!['moderator', 'admin'].includes(req.user?.role)) return res.status(403).json({ success: false, message: 'Staff access required.' });
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid session id.' });
  try {
    const row = await Session.findById(req.params.id).populate([{ path: 'learner', select: 'name' }, { path: 'tutor', select: 'name' }]);
    if (!row) return res.status(404).json({ success: false, message: 'Session not found.' });
    if (!completion.isOpenReview(row) && !(row.status === 'resolved' || row.reviewReferral?.closedAt)) {
      return res.status(403).json({ success: false, message: 'This session is not a staff review case.' });
    }
    const [messages, payments, auditEntries] = await Promise.all([
      SessionMessage.find({ session: row._id }).select('sender body createdAt').populate('sender', 'name').sort({ createdAt: -1, _id: -1 }).limit(100).lean(),
      CreditTransaction.find({ session: row._id }).select('type amount fromUser toUser createdAt').lean(),
      // Case-scoped read access, not access to the global Admin audit directory.
      AuditLog.find({ targetType: 'Session', targetId: String(row._id),
        action: { $in: [ACTIONS.dispute, ACTIONS.completionReview, ACTIONS.clarification] } })
        .select('actor actorRole action targetType targetId summary createdAt metadata.resolution metadata.reason')
        .populate('actor', 'name').sort({ createdAt: -1, _id: -1 }).limit(20).lean(),
    ]);
    return res.json({ success: true, data: { session: presentSession(row), messages: messages.reverse(), payments,
      messagesLimit: 100, auditEntries, auditLimit: 20 } });
  } catch { return res.status(503).json({ success: false, message: 'Review evidence unavailable.' }); }
};

exports.requestSessionClarification = async (req, res) => {
  if (!['moderator', 'admin'].includes(req.user?.role)) return res.status(403).json({ success: false, message: 'Staff access required.' });
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid session id.' });
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
  if (reason.length < 10 || reason.length > 500 || !Number.isSafeInteger(req.body.reviewVersion)) return res.status(400).json({ success: false, message: 'Use a clarification reason and current review version.' });
  try {
    const updated = await completion.inTransaction(async (dbSession) => {
      const row = await Session.findById(req.params.id).session(dbSession);
      if (!row) throw Object.assign(new Error('Session not found.'), { status: 404 });
      if (!completion.isOpenReview(row) || req.body.reviewVersion !== (row.reviewVersion || 0)) throw completion.conflict();
      if ([String(row.learner), String(row.tutor)].includes(req.user.id)) throw Object.assign(new Error('A participant cannot act as staff in their own session.'), { status: 403 });
      const entry = { id: randomUUID(), requestedBy: req.user.id, requestedAt: new Date(), reason };
      const changed = await Session.findOneAndUpdate({ ...completion.reviewClaim(row),
        $expr: { $lt: [{ $size: { $ifNull: ['$reviewClarifications', []] } }, 5] } },
      { $push: { reviewClarifications: entry }, $inc: { reviewVersion: 1 } },
      { returnDocument: 'after', runValidators: true, session: dbSession });
      if (!changed) throw completion.conflict();
      await recordAudit({ actor: req.user, action: ACTIONS.clarification, targetType: 'Session', targetId: row._id,
        summary: 'Session clarification requested', metadata: { reason }, session: dbSession });
      await completion.enqueueCompletionEvent('session.review_clarification', changed, [row.learner, row.tutor], dbSession, entry.id);
      return changed;
    });
    await updated.populate([{ path: 'learner', select: 'name' }, { path: 'tutor', select: 'name' }]);
    return res.json({ success: true, message: 'Clarification requested. The case remains open and no credits changed.', data: presentSession(updated) });
  } catch (error) { return res.status(error.status || 503).json({ success: false, message: error.status ? error.message : 'Clarification could not be requested.' }); }
};
