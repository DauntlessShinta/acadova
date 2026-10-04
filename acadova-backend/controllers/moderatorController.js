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
    const sessions = await Session.find({ status: 'disputed' })
      .populate([{ path: 'learner', select: 'name' }, { path: 'tutor', select: 'name' }, { path: 'disputedBy', select: 'name' }])
      .sort({ disputedAt: -1 })
      .limit(100);
    const payments = sessions.length ? await CreditTransaction.find({ session: { $in: sessions.map((row) => row._id) } })
      .select('session type amount').lean() : [];
    const paymentIds = new Set(payments.map((row) => String(row.session)));
    const data = sessions.map((row) => ({ ...row.toObject(), reviewIndicators: [
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
    const rows = await Session.find({ status: 'resolved' })
      .select('subject learner tutor scheduledAt disputedAt resolvedAt resolution resolutionNote creditsSettledAt')
      .populate([{ path: 'learner', select: 'name' }, { path: 'tutor', select: 'name' }])
      .sort({ resolvedAt: -1 }).limit(100).lean();
    return res.json({ success: true, data: rows });
  } catch { return res.status(503).json({ success: false, message: 'Resolved sessions unavailable.' }); }
};

exports.resolveSessionDispute = async (req, res) => {
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
      if (session.status !== 'disputed') {
        throw Object.assign(new Error('Only a disputed session can be resolved.'), { status: 409 });
      }
      if (!session.disputedAt || !session.disputedBy || !session.disputeReason
        || (!session.awaitingValidationAt && !session.noShowAt)
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
        changes.creditsSettledAt = now;
      }
      const claim = await Session.updateOne(
        {
          _id: session._id,
          status: 'disputed',
          disputedAt: session.disputedAt,
          resolvedAt: null,
          resolution: null,
          completedAt: null,
          creditsSettledAt: null,
        },
        { $set: changes },
        { session: dbSession, runValidators: true }
      );
      if (claim.matchedCount !== 1) {
        throw Object.assign(new Error('This session has already changed. Refresh and try again.'), { status: 409 });
      }
      Object.assign(session, changes);
      if (resolution === 'confirm_session') await transferSessionCredits(session, dbSession);
      await recordAudit({ actor: req.user, action: ACTIONS.dispute, targetType: 'Session',
        targetId: session._id, summary: 'Session dispute resolved', metadata: { resolution }, session: dbSession });
      resolvedSession = session;
    });
    await resolvedSession.populate([{ path: 'learner', select: 'name' }, { path: 'tutor', select: 'name' }]);
    await notifications.notifySession('session.resolved', resolvedSession,
      [resolvedSession.learner, resolvedSession.tutor]);
    return res.json({
      success: true,
      message: resolution === 'confirm_session'
        ? 'Dispute resolved as a valid session. Credits transferred once.'
        : 'Dispute resolved as an invalid session. No credits transferred.',
      data: resolvedSession,
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'This session already has a credit transaction.' });
    return res.status(500).json({ success: false, message: 'Session dispute could not be resolved.' });
  } finally {
    await dbSession.endSession();
  }
};
