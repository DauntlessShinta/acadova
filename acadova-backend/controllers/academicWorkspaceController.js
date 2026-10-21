const { InvalidInput } = require('../middleware/validation');
const models = require('../models/academic');
const User = require('../models/User');
const StudySet = require('../models/StudySet');
const StudyAttempt = require('../models/StudyAttempt');
const StudyPlanItem = require('../models/StudyPlanItem');
const { schemas, parse, resourceUrl, associations } = require('../utils/academicValidation');
const { owned, withOwner, fail, validateAssociations } = require('../services/academicWorkspaceService');
const { validateFile, extractDocument } = require('../services/aiDocumentService');
const { aiStudyConfig } = require('../config/aiStudy');
const { AcademicTerm, PersonalSubject, ExaminationPeriod, PersonalModule, AcademicResource } = models;
const types = { terms: AcademicTerm, subjects: PersonalSubject, periods: ExaminationPeriod, modules: PersonalModule, resources: AcademicResource };
const limits = { terms: 100, subjects: 200, periods: 1000, modules: 2000, resources: 1000 };
const view = row => { const value = row.toObject ? row.toObject() : { ...row }; delete value.content; delete value.owner; delete value.__v; return { ...value, id: String(value._id), ...(value.startYear ? { displayName: `SY ${value.startYear}–${value.endYear} • ${value.semester}` } : {}) }; };
const handle = action => async (req, res) => {
  try { await action(req, res); } catch (error) {
    const status = error instanceof InvalidInput || error.name === 'ValidationError' ? 400 : error.code === 11000 ? 409 : error.status || 503;
    res.status(status).json({ success: false, message: error.code === 11000 ? 'This academic year and semester already exists.' : status < 500 ? error.message : 'Workspace unavailable. Refresh and retry.' });
  } finally { if (req.file?.buffer) req.file.buffer.fill(0); }
};
async function relationships(type, owner, body, session) {
  if (type === 'subjects') await owned(AcademicTerm, owner, body.termId, session);
  if (['periods', 'modules', 'resources'].includes(type)) await owned(PersonalSubject, owner, body.subjectId, session);
  if (type === 'modules' && body.periodId) { const period = await owned(ExaminationPeriod, owner, body.periodId, session); if (String(period.subjectId) !== String(body.subjectId)) fail('Period belongs to another subject.'); }
  if (type === 'resources' && body.moduleId) { const module = await owned(PersonalModule, owner, body.moduleId, session); if (String(module.subjectId) !== String(body.subjectId)) fail('Module belongs to another subject.'); }
}
function resourceContent(body) {
  if (['pdf', 'pptx'].includes(body.kind)) { if (body.url || body.note) fail('Uploaded files cannot contain a URL or note.'); return; }
  if (body.kind === 'note') { if (!body.note || body.url) fail('Notes require text only.'); }
  else { if (body.note) fail('Link resources cannot contain a note.'); body.url = resourceUrl(body.kind, body.url); }
}
exports.state = handle(async (req, res) => {
  const owner = req.user.id; const user = await User.findById(owner).select('currentTermId').lean();
  const terms = await AcademicTerm.find({ owner }).sort({ startYear: -1, createdAt: 1 }).lean();
  const currentTermId = terms.some(row => String(row._id) === String(user.currentTermId)) ? user.currentTermId : null;
  const subjects = currentTermId ? await PersonalSubject.find({ owner, termId: currentTermId }).sort({ order: 1, createdAt: 1 }).lean() : [];
  const ids = subjects.map(row => row._id);
  const modules = await PersonalModule.find({ owner, subjectId: { $in: ids } }).sort({ updatedAt: -1 }).lean();
  const sets = await StudySet.find({ owner, subjectId: { $in: ids }, deletedAt: null }).select('_id title origin subjectId moduleId practiceHistory').lean();
  const attempts = await StudyAttempt.find({ student: owner, studySet: { $in: sets.map(row => row._id) }, submittedAt: { $type: 'date' } }).select('studySet score submittedAt').sort({ submittedAt: -1 }).lean();
  const weakSets = sets.flatMap(row => {
    const latest = row.origin === 'ai' ? row.practiceHistory?.at(-1) : attempts.find(attempt => String(attempt.studySet) === String(row._id));
    return latest && latest.score < 70 ? [{ id: String(row._id), title: row.title, origin: row.origin, score: latest.score, subjectId: row.subjectId }] : [];
  });
  res.json({ success: true, data: { terms: terms.map(view), currentTermId,
    subjects: subjects.map(subject => { const own = modules.filter(row => String(row.subjectId) === String(subject._id)); return { ...view(subject), moduleCount: own.length, completedCount: own.filter(row => row.status === 'completed').length }; }),
    continueModule: modules.filter(row => subjects.some(subject => !subject.archived && String(subject._id) === String(row.subjectId))).find(row => row.status === 'in_progress') || null,
    incompleteCount: modules.filter(row => row.status !== 'completed' && subjects.some(s => !s.archived && String(s._id) === String(row.subjectId))).length,
    needsReview: weakSets,
  } });
});
exports.selectTerm = handle(async (req, res) => {
  const result = await withOwner(req.user.id, async (session, user) => {
    if (req.body.currentTermId) await owned(AcademicTerm, req.user.id, req.body.currentTermId, session);
    await User.updateOne({_id:user._id},{$set:{currentTermId:req.body.currentTermId}},{session,runValidators:true}); return req.body.currentTermId;
  }); res.json({ success: true, data: { currentTermId: result } });
});
exports.subject = handle(async (req, res) => {
  const owner = req.user.id; const subject = await owned(PersonalSubject, owner, req.params.id);
  const query = { owner, subjectId: subject._id };
  const [periods, modules, resources, studySets] = await Promise.all([
    ExaminationPeriod.find(query).sort({ order: 1, createdAt: 1 }), PersonalModule.find(query).sort({ order: 1, createdAt: 1 }),
    AcademicResource.find(query).sort({ createdAt: 1 }), StudySet.find({ ...query, deletedAt: null }).select('_id title origin moduleId sourceResourceIds state archivedAt').sort({ updatedAt: -1 }),
  ]);
  res.json({ success: true, data: { subject: view(subject), periods: periods.map(view), modules: modules.map(view), resources: resources.map(view), studySets: studySets.map(view) } });
});
exports.create = type => handle(async (req, res) => {
  const body = parse(req.body, schemas[type]); if (type === 'terms') body.endYear = body.startYear + 1;
  if (type === 'resources') resourceContent(body);
  const row = await withOwner(req.user.id, async (session, user) => {
    await relationships(type, req.user.id, body, session);
    if (await types[type].countDocuments({ owner: req.user.id }).session(session) >= limits[type]) fail(`Workspace limit reached for ${type}.`, 429);
    const result = (await types[type].create([{ ...body, owner: req.user.id }], { session }))[0];
    if (type === 'terms' && !user.currentTermId) await User.updateOne({_id:user._id},{$set:{currentTermId:result._id}},{session,runValidators:true});
    return result;
  }); res.status(201).json({ success: true, data: view(row) });
});
exports.edit = type => handle(async (req, res) => {
  const body = parse(req.body, schemas[type], true);
  const row = await withOwner(req.user.id, async session => {
    const row = await owned(types[type], req.user.id, req.params.id, session);
    // Parents stay stable; move a module between periods within its subject instead.
    for (const key of ['termId', 'subjectId', 'moduleId']) if (body[key] !== undefined && String(body[key]) !== String(row[key])) fail('The parent association cannot be changed.');
    if (type === 'resources' && body.kind !== undefined && body.kind !== row.kind) fail('Resource type cannot be changed.');
    Object.assign(row, body); if (type === 'terms') row.endYear = row.startYear + 1;
    await relationships(type, req.user.id, row, session); if (type === 'resources') resourceContent(row);
    if (type === 'modules' && Object.hasOwn(body, 'status')) row.lastReviewedAt = new Date();
    await row.save({ session }); return row;
  }); res.json({ success: true, data: view(row) });
});
exports.remove = type => handle(async (req, res) => {
  await withOwner(req.user.id, async (session, user) => {
    const row = await owned(types[type], req.user.id, req.params.id, session); const owner = req.user.id;
    if (['subjects', 'modules'].includes(type) && await StudyPlanItem.exists({ owner, [type === 'subjects' ? 'subjectId' : 'moduleId']: row._id }).session(session)) fail('Remove associated study plan entries before deleting this record.', 409);
    const checks = type === 'terms' ? [[PersonalSubject, { termId: row._id }]] : type === 'subjects' ? [[ExaminationPeriod, { subjectId: row._id }], [PersonalModule, { subjectId: row._id }], [AcademicResource, { subjectId: row._id }], [StudySet, { subjectId: row._id, deletedAt: null }]] : type === 'periods' ? [[PersonalModule, { periodId: row._id }]] : type === 'modules' ? [[AcademicResource, { moduleId: row._id }], [StudySet, { moduleId: row._id, deletedAt: null }]] : [[StudySet, { sourceResourceIds: row._id, deletedAt: null }]];
    for (const [Model, query] of checks) if (await Model.exists({ owner, ...query }).session(session)) fail('Move or remove child records and detach study sets before deleting this record.', 409);
    await types[type].deleteOne({ _id: row._id, owner }, { session });
    if (type === 'terms' && String(user.currentTermId) === String(row._id)) await User.updateOne({_id:user._id},{$set:{currentTermId:null}},{session,runValidators:true});
  }); res.json({ success: true });
});
exports.associate = handle(async (req, res) => {
  const input = parse(req.body, associations, true);
  const row = await withOwner(req.user.id, async session => {
    const row = await StudySet.findOne({ _id: req.params.id, owner: req.user.id, deletedAt: null }).session(session);
    if (!row) fail('Study set not found.', 404);
    if (row.ai?.sourceResourceId && input.sourceResourceIds && !input.sourceResourceIds.some(value => String(value) === String(row.ai.sourceResourceId))) fail('A Strict Source set keeps its original source reference. Delete the set before removing its source file.', 409);
    const values = await validateAssociations(req.user.id, { subjectId: row.subjectId, moduleId: row.moduleId, sourceResourceIds: row.sourceResourceIds, ...input }, session);
    Object.assign(row, values); await row.save({ session }); return row;
  }); res.json({ success: true, data: { id: String(row._id), subjectId: row.subjectId, moduleId: row.moduleId, sourceResourceIds: row.sourceResourceIds } });
});
exports.upload = handle(async (req, res) => {
  const body = parse(req.body, { subjectId: schemas.resources.subjectId, moduleId: schemas.resources.moduleId, title: schemas.resources.title });
  const config = aiStudyConfig(); const file = validateFile(req.file, config);
  await owned(PersonalSubject, req.user.id, body.subjectId); // Reject unauthorized work before parsing.
  await extractDocument(req.file, config); // Reuse signature, worker, archive, page, slide, text and time limits.
  const row = await withOwner(req.user.id, async session => {
    await relationships('resources', req.user.id, body, session);
    const resources = await AcademicResource.find({ owner: req.user.id }).select('bytes').session(session);
    if (resources.length >= limits.resources || resources.reduce((sum, row) => sum + row.bytes, 0) + req.file.buffer.length > 50 * 1024 * 1024) fail('Private resource storage limit is 50 MB per student.', 429);
    return (await AcademicResource.create([{ ...body, owner: req.user.id, kind: file.format, fileName: file.name, bytes: req.file.buffer.length, content: req.file.buffer }], { session }))[0];
  }); res.status(201).json({ success: true, data: view(row) });
});
exports.download = handle(async (req, res) => {
  const row = await AcademicResource.findOne({ _id: req.params.id, owner: req.user.id }).select('+content');
  if (!row?.content || !['pdf', 'pptx'].includes(row.kind)) fail('Private file not found.', 404);
  res.set({ 'Content-Type': row.kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'Content-Disposition': `attachment; filename="resource.${row.kind}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  res.send(Buffer.from(row.content));
});
module.exports.types = types;
