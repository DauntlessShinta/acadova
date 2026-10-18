const { randomBytes, createHash } = require('node:crypto');
const StudySet = require('../models/StudySet');
const { handle, fail, idOf } = require('./studyController').helpers;
const { withOwner } = require('../services/academicWorkspaceService');
const { studyContent, contentOf } = require('../utils/studyQuiz');
const hash = token => createHash('sha256').update(token).digest('hex');
const tokenValid = token => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
const settings = row => ({ id: idOf(row), version: row.version, visibility: row.state === 'published' ? 'public' : row.unlistedActive && row.state === 'private' ? 'unlisted' : 'private', state: row.state, shareable: row.origin !== 'ai' });
exports.settings = handle(async (req, res) => { const row = await StudySet.findOne({ _id: req.params.id, owner: req.user.id, deletedAt: null }); if (!row) fail('Study set unavailable.', 404); res.json({ success: true, data: settings(row) }); });
exports.change = handle(async (req, res) => { let token;
  const row = await withOwner(req.user.id, async session => {
    const current = await StudySet.findOne({ _id: req.params.id, owner: req.user.id, deletedAt: null }).session(session);
    if (!current) fail('Study set unavailable.', 404); if (current.version !== req.body.version) fail('Sharing settings changed. Refresh before trying again.');
    const unlisted = req.body.visibility === 'unlisted';
    if (unlisted && current.origin === 'ai') fail('AI-generated sets stay private. Source permission and a safe publication contract are not implemented.', 403);
    if (unlisted && current.state !== 'private') fail('Make an eligible draft private before creating an unlisted link. Removed content must be edited first.');
    if (unlisted && req.body.rightsAcknowledged !== true) fail('Confirm that you have the right to distribute this content.', 400);
    if (unlisted) { studyContent(contentOf(current), true); token = randomBytes(32).toString('hex'); }
    return StudySet.findOneAndUpdate({ _id: current._id, owner: req.user.id, version: current.version, deletedAt: null }, {
      $set: { unlistedActive: unlisted, ...(unlisted ? { unlistedHash: hash(token) } : {}), ...(['pending', 'published'].includes(current.state) ? { state: 'private' } : {}) },
      $inc: { version: 1 }, $unset: { ...(!unlisted ? { unlistedHash: 1 } : {}), publicationId: 1, approvedRevision: 1 },
    }, { returnDocument: 'after', session });
  }); if (!row) fail('Sharing settings changed. Refresh before trying again.'); res.json({ success: true, data: { ...settings(row), ...(token ? { token } : {}) } });
});
exports.open = handle(async (req, res) => {
  if (!tokenValid(req.body.token)) fail('Shared set unavailable.', 404);
  const row = await StudySet.findOne({ _id: req.params.id, deletedAt: null, origin: { $ne: 'ai' }, state: 'private', unlistedActive: true, unlistedHash: hash(req.body.token) }).populate('owner', 'name');
  if (!row) fail('Shared set unavailable.', 404);
  res.json({ success: true, data: { id: idOf(row), title: row.title, subject: row.subject, description: row.description, questions: row.questions.map(q => ({ prompt: q.prompt, options: [...q.options], correctIndex: q.correctIndex, explanation: q.explanation })),
    flashcards: (row.flashcards || []).map(c => ({ front: c.front, back: c.back })), authorName: row.owner?.name || 'Acadova Student', revision: row.revision, visibility: 'unlisted', readOnly: true, creditsAwarded: 0 } });
});
exports.report = handle(async (req, res) => { if (!tokenValid(req.body.token)) fail('Shared set unavailable.', 404); req.unlistedHash = hash(req.body.token); return require('./studyModerationController').report(req, res); });
module.exports.hash = hash;
