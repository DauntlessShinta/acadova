const { randomUUID } = require('node:crypto');
const StudySet = require('../models/StudySet');
const StudyReport = require('../models/StudyReport');
const { studyContent, contentOf } = require('../utils/studyQuiz');
const { transaction, handle, fail, owned, ownerView, idOf } = require('./studyController').helpers;
const { ACTIONS, recordAudit } = require('../services/auditService');
const notifications = require('../services/notificationService');
const { escapeRegExp } = require('../middleware/validation');
const reportIndex = index => index.name === 'uniq_study_report_set_reporter' && index.unique === true
  && index.key?.studySet === 1 && index.key?.reporter === 1 && Object.keys(index.key).length === 2 && !index.partialFilterExpression && !index.sparse;
exports.shared = handle(async (req, res) => {
  const q = req.validatedQuery.q; const filter = { origin: { $ne: 'ai' }, state: 'published', deletedAt: null, $expr: { $eq: ['$revision', '$approvedRevision'] },
    ...(q ? { $or: ['title', 'subject'].map(key => ({ [key]: { $regex: escapeRegExp(q), $options: 'i' } })) } : {}) };
  const rows = await StudySet.find(filter).select('title subject owner revision questions flashcards publishedAt').populate('owner', 'name').sort({ publishedAt: -1 }).limit(100);
  res.json({ success: true, data: rows.map(row => ({ id: idOf(row), title: row.title, subject: row.subject, questionCount: row.questions.length, flashcardCount: row.flashcards?.length || 0, revision: row.revision, state: 'published', authorName: row.owner?.name || 'Acadova Student' })) });
});
exports.publish = handle(async (req, res) => {
  const row = await owned(req); if (row.origin === 'ai') fail('AI-generated study sets stay private and cannot be submitted for publication.', 403); studyContent(contentOf(row), true);
  if (row.version !== req.body.version) fail('This saved revision changed. Refresh before submitting.');
  const changed = await StudySet.findOneAndUpdate({ _id: row._id, owner: req.user.id, origin: { $ne: 'ai' }, deletedAt: null, version: req.body.version, state: { $in: ['private', 'rejected', 'removed'] } },
    { $set: { state: 'pending', submittedAt: new Date(), unlistedActive: false, unlistedRemoved: false }, $inc: { version: 1 }, $unset: { publicationId: 1, approvedRevision: 1, unlistedHash: 1 } }, { returnDocument: 'after' });
  if (!changed) fail('This submission changed. Refresh and review the saved revision.'); res.json({ success: true, data: { ...ownerView(changed), isOwner: true } });
});
exports.withdraw = handle(async (req, res) => {
  const row = await StudySet.findOneAndUpdate({ _id: req.params.id, owner: req.user.id, deletedAt: null, version: req.body.version, state: { $in: ['pending', 'published'] } },
    { $set: { state: 'private', unlistedActive: false }, $inc: { version: 1 }, $unset: { publicationId: 1, approvedRevision: 1, unlistedHash: 1 } }, { returnDocument: 'after' });
  if (!row) fail('This submission changed or is unavailable. Refresh before withdrawing.'); res.json({ success: true, data: { ...ownerView(row), isOwner: true } });
});
exports.report = handle(async (req, res) => {
  if (process.env.NODE_ENV === 'production' && !(await StudyReport.collection.indexes()).some(reportIndex)) fail('Study reporting is temporarily unavailable until its unique index is verified.', 503);
  const report = await transaction(async session => {
    const row = await StudySet.findOneAndUpdate({ _id: req.params.id, origin: { $ne: 'ai' }, deletedAt: null, owner: { $ne: req.user.id }, ...(req.unlistedHash ? { state: 'private', unlistedActive: true, unlistedHash: req.unlistedHash } : { state: 'published', $expr: { $eq: ['$revision', '$approvedRevision'] } }) }, { $inc: { attemptGuard: 1 } }, { session });
    if (!row) fail('Only another student’s currently published set can be reported.', 404);
    const existing = await StudyReport.findOne({ studySet: row._id, reporter: req.user.id }).session(session);
    if (existing?.state === 'open') {
      if (!req.unlistedHash || existing.revision === row.revision) return existing;
      return StudyReport.findOneAndUpdate({ _id: existing._id, state: 'open', cycle: existing.cycle },
        { $set: { reason: req.body.reason, revision: row.revision }, $inc: { cycle: 1 }, $unset: { publicationId: 1 } }, { returnDocument: 'after', session });
    }
    if (await StudyReport.countDocuments({ studySet: row._id, state: 'open' }).session(session) >= 100) fail('This set already has a full review queue. Staff review is pending.', 429);
    if (existing) return StudyReport.findOneAndUpdate({ _id: existing._id, state: 'closed', cycle: existing.cycle },
      { $set: { reason: req.body.reason, state: 'open', revision: row.revision, publicationId: row.publicationId }, $inc: { cycle: 1 }, $unset: { closedBy: 1, closedAt: 1, closureReason: 1 } }, { returnDocument: 'after', session });
    return (await StudyReport.create([{ studySet: row._id, reporter: req.user.id, reason: req.body.reason, revision: row.revision, publicationId: row.publicationId }], { session }))[0];
  }); res.json({ success: true, data: { id: idOf(report), state: report.state }, message: 'Report saved. Repeated active reports are grouped.' });
});
async function staffView(row) { await row.populate('owner', 'name'); const reports = await StudyReport.find({ studySet: row._id, state: 'open' }).populate('reporter', 'name').sort({ createdAt: 1 }).limit(100).lean();
  const contentAvailable = row.state !== 'private' || reports.some(report => report.revision === row.revision);
  return { ...ownerView(row), ...(!contentAvailable ? { title: 'Reported revision unavailable', subject: '', description: '', questions: [], flashcards: [], contentUnavailable: true } : {}), unlistedRemoved: row.unlistedRemoved === true, authorId: idOf(row.owner), authorName: row.owner?.name || 'Acadova Student', deletedAt: row.deletedAt, submittedAt: row.submittedAt, reports: reports.map(report => ({ id: idOf(report), reporterName: report.reporter?.name || 'Acadova Student', reason: report.reason, revision: report.revision, cycle: report.cycle, createdAt: report.createdAt })) }; }
exports.list = handle(async (req, res) => { const reports = await StudyReport.find({ state: 'open' }).select('studySet').sort({ createdAt: 1 }).limit(100).lean();
  const rows = await StudySet.find({ origin: { $ne: 'ai' }, ...(req.validatedQuery?.view === 'removed' ? { state: 'removed', deletedAt: null } : { $or: [{ state: 'pending', deletedAt: null }, { _id: { $in: reports.map(report => report.studySet) } }] }) }).sort({ submittedAt: 1, _id: 1 }).limit(100);
  res.json({ success: true, data: await Promise.all(rows.map(staffView)) }); });
exports.get = handle(async (req, res) => { const row = await StudySet.findById(req.params.id); if (!row || row.origin === 'ai' || !['pending', 'published', 'rejected', 'removed'].includes(row.state) && !await StudyReport.exists({ studySet: row._id })) fail('Study review not found or unavailable.', 404); res.json({ success: true, data: await staffView(row) }); });
exports.decide = handle(async (req, res) => { const row = await transaction(async session => {
  const current = await StudySet.findById(req.params.id).session(session); if (!current || current.origin === 'ai' || current.deletedAt || current.version !== req.body.version) fail('This review changed. Reload the current revision before deciding.');
  const { outcome, reason } = req.body; if (outcome === 'restore' && current.unlistedRemoved) fail('An unlisted takedown cannot be restored into public discovery. The owner must edit and explicitly submit a new revision.'); const approval = ['approve', 'restore'].includes(outcome);
  if (approval && idOf(current.owner) === req.user.id) fail('Reviewers cannot approve their own study sets.', 403);
  const expected = outcome === 'remove' && current.state === 'private' && await StudyReport.exists({ studySet: current._id, state: 'open', revision: current.revision }).session(session) ? 'private' : { approve: 'pending', reject: 'pending', remove: 'published', restore: 'removed' }[outcome]; if (current.state !== expected) fail('This action is stale or unavailable for the current publication state.');
  if (approval) studyContent(contentOf(current), true);
  const state = approval ? 'published' : outcome === 'reject' ? 'rejected' : 'removed';
  const updated = await StudySet.findOneAndUpdate({ _id: current._id, version: current.version, state: expected, deletedAt: null },
    { $set: { state, unlistedActive: false, ...(outcome === 'remove' ? { unlistedRemoved: expected === 'private' } : {}), decision: { actor: req.user.id, reason, at: new Date(), outcome }, ...(approval ? { approvedRevision: current.revision, publicationId: randomUUID(), publishedAt: new Date() } : {}) },
      $inc: { version: 1 }, ...(!approval ? { $unset: { publicationId: 1, approvedRevision: 1, unlistedHash: 1 } } : {}) }, { returnDocument: 'after', session });
  if (!updated) fail('This review changed. Reload before deciding.');
  await recordAudit({ actor: req.user, action: ACTIONS.studyDecision, targetType: 'StudySet', targetId: current._id, summary: `Study set ${state}`, metadata: { reason, previousStatus: current.state, newStatus: state, beforeVersion: current.version, afterVersion: updated.version }, session });
  if (outcome === 'remove') {
    const reports = await StudyReport.find({ studySet: current._id, state: 'open' }).session(session);
    for (const report of reports) { await StudyReport.updateOne({ _id: report._id, state: 'open', cycle: report.cycle }, { $set: { state: 'closed', closedBy: req.user.id, closedAt: new Date(), closureReason: reason } }, { session });
      await recordAudit({ actor: req.user, action: ACTIONS.studyReportClosed, targetType: 'StudyReport', targetId: report._id, summary: 'Study report closed by removal', metadata: { reason }, session }); }
  }
  await notifications.publish({ recipient: updated.owner, type: `study.${state}`, relatedType: 'StudySet', relatedId: updated._id, eventKey: `study.${state}:${updated._id}:${updated.version}`, deferPush: true, dbSession: session });
  return updated;
}); res.json({ success: true, data: await staffView(row) }); });
exports.closeReport = handle(async (req, res) => { await transaction(async session => {
  const report = await StudyReport.findOneAndUpdate({ _id: req.params.id, state: 'open', cycle: req.body.version }, { $set: { state: 'closed', closedBy: req.user.id, closedAt: new Date(), closureReason: req.body.reason } }, { returnDocument: 'after', session });
  if (!report) fail('This report was already handled or changed. Refresh the queue.');
  await recordAudit({ actor: req.user, action: ACTIONS.studyReportClosed, targetType: 'StudyReport', targetId: report._id, summary: 'Study report reviewed and closed', metadata: { reason: req.body.reason }, session });
}); res.json({ success: true, message: 'Report closed with recorded reason. Publication is unchanged.' }); });
exports.hasReportIndex = reportIndex;
