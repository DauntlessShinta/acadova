const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const Session = require('../models/Session');
const { isValidObjectId, schemas } = require('../middleware/validation');
const { referForReview } = require('../services/completionLifecycle');
const { presentSession } = require('../services/rescheduleLifecycle');
const idOf = (value) => String(value?._id || value || '');
async function participantSession(req) {
  if (!isValidObjectId(req.params.id)) throw Object.assign(new Error('Invalid session id.'), { status: 400 });
  const row = await Session.findById(req.params.id);
  if (!row) throw Object.assign(new Error('Session not found.'), { status: 404 });
  if (![idOf(row.learner), idOf(row.tutor)].includes(req.user.id)) throw Object.assign(new Error('You are not part of this session.'), { status: 403 });
  return row;
}
exports.getEvidence = async (req, res) => {
  try { const row = await participantSession(req); return res.json({ success: true,
    data: { evidence: row.completionEvidence || [], clarifications: row.reviewClarifications || [] } }); }
  catch (error) { return res.status(error.status || 503).json({ success: false, message: error.status ? error.message : 'Evidence unavailable.' }); }
};
exports.submitEvidence = async (req, res) => {
  try {
    const row = await participantSession(req);
    if (!['in_progress', 'awaiting_validation', 'disputed', 'no_show'].includes(row.status)
      || row.completedAt || row.creditsSettledAt || row.resolvedAt) return res.status(409).json({ success: false, message: 'Evidence can be added only to an active or unresolved session.' });
    // Validate again for direct controller callers; clients never own actor/time/id.
    const data = Object.fromEntries(Object.entries(schemas.completionEvidence).map(([key, validate]) => [key, validate(req.body[key])]));
    const entry = { ...data, id: randomUUID(), submittedBy: req.user.id, submittedAt: new Date() };
    const updated = await Session.findOneAndUpdate({ _id: row._id, status: row.status, completedAt: null, creditsSettledAt: null, resolvedAt: null,
      $expr: { $lt: [{ $size: { $filter: { input: { $ifNull: ['$completionEvidence', []] }, as: 'e',
        cond: { $eq: ['$$e.submittedBy', new mongoose.Types.ObjectId(req.user.id)] } } } }, 5] } },
    { $push: { completionEvidence: entry }, $inc: { reviewVersion: 1 } }, { returnDocument: 'after', runValidators: true });
    if (!updated) return res.status(409).json({ success: false, message: 'This session changed or your five evidence submissions were used. Refresh to review the current evidence.' });
    await updated.populate([{ path: 'learner', select: 'name' }, { path: 'tutor', select: 'name' }]);
    return res.json({ success: true, message: 'Private evidence saved. No completion or credits were changed.', data: presentSession(updated) });
  } catch (error) {
    const invalid = error.constructor?.name === 'InvalidInput' || error.name === 'ValidationError';
    return res.status(error.status || (invalid ? 400 : 503)).json({ success: false,
      message: error.status ? error.message : invalid ? 'Check your summary, completed work and up to five HTTPS links.' : 'Evidence is temporarily unavailable. Your draft can be retried.' });
  }
};
exports.requestReview = async (req, res) => {
  try {
    await participantSession(req);
    const reason = schemas.dispute.reason(req.body.reason);
    const row = await referForReview(req.params.id, { actor: req.user, reason });
    await row.populate([{ path: 'learner', select: 'name' }, { path: 'tutor', select: 'name' }]);
    return res.json({ success: true, message: 'Completion review requested. This does not approve payment or guarantee a staff decision time.', data: presentSession(row) });
  } catch (error) { return res.status(error.status || (error.constructor?.name === 'InvalidInput' ? 400 : 503)).json({ success: false,
    message: error.status ? error.message : error.constructor?.name === 'InvalidInput' ? 'Enter a review reason of 10 to 500 characters.' : 'Review requests are temporarily unavailable. Refresh and retry.' }); }
};
