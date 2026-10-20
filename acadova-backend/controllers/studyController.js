const mongoose = require('mongoose');
const StudySet = require('../models/StudySet');
const StudyAttempt = require('../models/StudyAttempt');
const { studyContent, gradeStudy, contentOf } = require('../utils/studyQuiz');
const idOf = value => String(value?._id || value || '');
const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
async function transaction(write) { const session = await mongoose.startSession(); try { let result; await session.withTransaction(async () => { result = await write(session); }); return result; } finally { await session.endSession(); } }
const handle = action => async (req, res) => { try { return await action(req, res); } catch (error) { return res.status(error.status || 503).json({ success: false, message: error.status ? error.message : 'Study action unavailable. Your draft is retained; refresh and retry.', ...(error.fields ? { fields: error.fields } : {}) }); } };
function ownerView(row) { return { id: idOf(row), ...(row.unlistedActive && row.state === 'private' ? { visibility: 'unlisted' } : {}), ...contentOf(row), origin: row.origin || 'manual', archivedAt: row.archivedAt || null, ...(row.origin === 'ai' ? { flashcards: row.flashcards, ai: row.ai } : {}), revision: row.revision, version: row.version, state: row.state, decision: row.decision, createdAt: row.createdAt, updatedAt: row.updatedAt }; }
function visibleQuestions(questions) { return questions.map(q => ({ prompt: q.prompt, options: [...q.options] })); }
function attemptView(row) { return { id: idOf(row), studySetId: idOf(row.studySet), revision: row.revision, access: row.access, title: row.snapshot.title, subject: row.snapshot.subject,
  questions: row.submittedAt ? row.snapshot.questions : visibleQuestions(row.snapshot.questions), startedAt: row.startedAt, submittedAt: row.submittedAt,
  ...(row.submittedAt ? { score: row.score, correct: row.correct, total: row.total, answers: row.answers } : {}), creditsAwarded: 0 }; }
async function owned(req, dbSession) { const row = await StudySet.findOne({ _id: req.params.id, owner: req.user.id, deletedAt: null }).session(dbSession || null); if (!row) fail('Study set not found or unavailable.', 404); return row; }
async function accessible(req, dbSession) {
  const row = await StudySet.findOne({ _id: req.params.id, deletedAt: null, $or: [{ owner: req.user.id }, { state: 'published', origin: { $ne: 'ai' } }] }).session(dbSession || null);
  if (!row || (idOf(row.owner) !== req.user.id && row.approvedRevision !== row.revision)) fail('Study set not found or unavailable.', 404);
  return row;
}
exports.mine = handle(async (req, res) => { const rows = await StudySet.find({ owner: req.user.id, deletedAt: null }).sort({ updatedAt: -1 }).limit(100); res.json({ success: true, data: rows.map(ownerView) }); });
exports.create = handle(async (req, res) => { const body = studyContent(req.body); const row = await StudySet.create({ ...body, owner: req.user.id }); res.status(201).json({ success: true, data: ownerView(row) }); });
exports.get = handle(async (req, res) => { const row = await accessible(req); if (idOf(row.owner) === req.user.id) return res.json({ success: true, data: { ...ownerView(row), isOwner: true } });
  await row.populate('owner', 'name'); res.json({ success: true, data: { id: idOf(row), title: row.title, subject: row.subject, description: row.description, questions: visibleQuestions(row.questions), flashcards: (row.flashcards || []).map(c => ({ front: c.front, back: c.back })), revision: row.revision, state: 'published', authorName: row.owner?.name || 'Acadova Student', isOwner: false } }); });
exports.edit = handle(async (req, res) => { const { version, ...body } = req.body; const clean = studyContent(body); const row = await StudySet.findOneAndUpdate({ _id: req.params.id, owner: req.user.id, origin: { $ne: 'ai' }, deletedAt: null, version },
  { $set: { ...clean, flashcards: clean.flashcards || [], state: 'private', unlistedActive: false }, $inc: { revision: 1, version: 1 }, $unset: { approvedRevision: 1, publicationId: 1, unlistedHash: 1 } }, { returnDocument: 'after', runValidators: true });
  if (!row) fail('This study set changed or is unavailable. Refresh before saving; your draft is retained.'); res.json({ success: true, data: ownerView(row) }); });
exports.remove = handle(async (req, res) => { const row = await StudySet.findOneAndUpdate({ _id: req.params.id, owner: req.user.id, origin: { $ne: 'ai' }, deletedAt: null, version: req.body.version },
  { $set: { deletedAt: new Date(), state: 'private', unlistedActive: false }, $inc: { version: 1 }, $unset: { publicationId: 1, approvedRevision: 1, unlistedHash: 1 } }, { returnDocument: 'after' }); if (!row) fail('This study set changed or is unavailable. Refresh before deleting.'); res.json({ success: true, message: 'Study set deleted. Your already-started own attempts retain their snapshot; public attempts cannot be submitted.' }); });
exports.start = handle(async (req, res) => { const attempt = await transaction(async session => {
  const row = await accessible(req, session); if (row.origin === 'ai') fail('Open AI Study Tools to practice this private AI set.', 400); const snapshot = studyContent(contentOf(row), true); if (!snapshot.questions.length) fail('This set has flashcards only. Open answer review instead.', 400); const own = idOf(row.owner) === req.user.id;
  const touched = await StudySet.findOneAndUpdate({ _id: row._id, revision: row.revision, version: row.version, deletedAt: null }, { $inc: { attemptGuard: 1 } }, { session }); if (!touched) fail('This study set changed. Refresh before starting.');
  return (await StudyAttempt.create([{ student: req.user.id, studySet: row._id, revision: row.revision, access: own ? 'owner' : 'public', ...(!own ? { publicationId: row.publicationId } : {}), snapshot }], { session }))[0];
}); res.status(201).json({ success: true, data: attemptView(attempt) }); });
exports.review = handle(async (req, res) => { const row = await accessible(req); if (row.origin === 'ai') fail('Open AI Study Tools to review this private AI set.', 400); const content = studyContent(contentOf(row), true); res.json({ success: true, data: { ...content, id: idOf(row), revision: row.revision, creditsAwarded: 0 } }); });
exports.attempt = handle(async (req, res) => { const row = await StudyAttempt.findOne({ _id: req.params.id, student: req.user.id }); if (!row) fail('Study attempt not found.', 404);
  if (!row.submittedAt && row.access === 'public' && !await StudySet.exists({ _id: row.studySet, state: 'published', deletedAt: null, revision: row.revision, approvedRevision: row.revision, publicationId: row.publicationId })) fail('This shared revision is unavailable. Your submitted results remain in your history.');
  res.json({ success: true, data: attemptView(row) }); });
exports.results = handle(async (req, res) => { const rows = await StudyAttempt.find({ student: req.user.id, submittedAt: { $type: 'date' } }).sort({ submittedAt: -1 }).limit(100); res.json({ success: true, data: rows.map(attemptView) }); });
exports.submit = handle(async (req, res) => { const attempt = await transaction(async session => {
  const row = await StudyAttempt.findOne({ _id: req.params.id, student: req.user.id, submittedAt: null }).session(session); if (!row) fail('This attempt is unavailable or already submitted. Open your saved result.');
  const grade = gradeStudy(row.snapshot, req.body.answers);
  if (row.access === 'public') { const current = await StudySet.findOneAndUpdate({ _id: row.studySet, state: 'published', deletedAt: null, revision: row.revision, approvedRevision: row.revision, publicationId: row.publicationId }, { $inc: { attemptGuard: 1 } }, { session }); if (!current) fail('This shared revision is no longer published. Start again from an available set.'); }
  const updated = await StudyAttempt.findOneAndUpdate({ _id: row._id, student: req.user.id, submittedAt: null }, { $set: { ...grade, answers: req.body.answers, submittedAt: new Date() } }, { returnDocument: 'after', session }); if (!updated) fail('This attempt was already submitted. Open your result.'); return updated;
}); res.json({ success: true, data: attemptView(attempt) }); });
module.exports.helpers = { transaction, handle, fail, owned, accessible, ownerView, idOf };
