// Explicit local-only, disposable synthetic database. Never loads dotenv or uses a supplied database URI.
const test = require('node:test'); const assert = require('node:assert/strict');
const mongoose = require('mongoose'); const express = require('express'); const jwt = require('jsonwebtoken');
const User = require('../models/User'); const StudySet = require('../models/StudySet'); const StudyAttempt = require('../models/StudyAttempt');
const CreditTransaction = require('../models/CreditTransaction'); const Session = require('../models/Session');
const models = require('../models/academic'); const Preview = require('../models/AiStudyPreview'); const Quota = require('../models/AiStudyQuota');
const StudyReport = require('../models/StudyReport');
const { pdf, pptx, output } = require('./fixtures/aiStudyDocuments.cjs');
test('Bundle A: independent student terms, private workspace and compatible AI sets', { skip: process.env.ACADOVA_BUNDLE_A_DB_TESTS !== '1' }, async t => {
  assert.notEqual(process.env.NODE_ENV, 'production');
  const oldSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'bundle-a-synthetic-tests-only';
  const database = `acadova_bundle_a_test_${process.pid}`;
  await mongoose.connect('mongodb://127.0.0.1:27031/admin?directConnection=true', { serverSelectionTimeoutMS: 5000 });
  try { await mongoose.connection.db.admin().command({ replSetInitiate: { _id: 'acadovaAiQA', members: [{ _id: 0, host: '127.0.0.1:27031' }] } }); } catch (error) { if (error.codeName !== 'AlreadyInitialized') throw error; }
  await mongoose.disconnect();
  await mongoose.connect(`mongodb://127.0.0.1:27031/${database}?replicaSet=acadovaAiQA`, { serverSelectionTimeoutMS: 20000 });
  assert.equal((await mongoose.connection.db.admin().command({ hello: 1 })).setName, 'acadovaAiQA');
  await Promise.all([User, StudySet, StudyAttempt, StudyReport, CreditTransaction, Session, Preview, Quota, ...Object.values(models)].map(model => model.init()));
  t.after(async () => { assert.equal(mongoose.connection.name, database); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret; });
  const [alice, bob, moderator, unverified, suspended, legacy] = await User.create(['Alice', 'Bob', 'Moderator', 'Unverified', 'Suspended', 'Legacy'].map(name => ({ name, email: `${name}@example.test`, password: 'synthetic', credits: 100, role: name === 'Moderator' ? 'moderator' : 'student', emailVerified: name !== 'Unverified', ...(name === 'Suspended' ? { suspendedAt: new Date() } : {}) })));
  await User.updateOne({ _id: legacy._id }, { $unset: { emailVerified: 1 } });
  const { validationErrorHandler } = require('../middleware/validation');
  const config = { ...require('../config/aiStudy').aiStudyConfig({ NODE_ENV: 'test', AI_STUDY_ENABLED: 'true', AI_STUDY_LOCAL_QA: 'true', GEMINI_API_KEY: 'mock-only' }) };
  let providerCalls = 0;
  const app = express(); app.use(express.json({ limit: '100kb' }));
  app.use('/api/academic', require('../routes/academicWorkspaceRoutes'));
  app.use('/api/ai-study', require('../routes/aiStudyRoutes').createAiStudyRouter({ configFor: () => config, provider: { generate: async () => { providerCalls++; return output(); } } }));
  app.use('/api/study-sets', require('../routes/studyRoutes')); app.use('/api/moderator/study-sets', require('../routes/studyModerationRoutes')); app.use(validationErrorHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const root = `http://127.0.0.1:${server.address().port}/api`;
  const headers = actor => ({ authorization: `Bearer ${jwt.sign({ id: String(actor._id) }, process.env.JWT_SECRET)}` });
  const call = async (path, method = 'GET', body, actor = alice) => { const response = await fetch(root + path, { method, headers: { ...headers(actor), 'content-type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }); return { status: response.status, body: await response.json() }; };
  const create = async (type, body, actor = alice) => { const result = await call('/academic/' + type, 'POST', body, actor); assert.equal(result.status, 201, JSON.stringify(result)); return result.body.data; };
  const upload = async (moduleId, actor = alice, buffer = pdf(), name = 'module.pdf') => { const body = new FormData(); body.append('document', new Blob([buffer]), name); body.append('subjectId', subject.id); body.append('moduleId', moduleId); body.append('title', 'Private source'); const response = await fetch(root + '/academic/resources/upload', { method: 'POST', headers: headers(actor), body }); return { status: response.status, body: await response.json() }; };
  let term, secondTerm, bobTerm, subject, secondSubject, period, module, resource, source, standalone, generated;
  await t.test('auth controls and legacy verified-field compatibility remain intact', async () => {
    assert.equal((await fetch(root + '/academic/state')).status, 401);
    for (const actor of [moderator, unverified, suspended]) assert.equal((await call('/academic/state', 'GET', undefined, actor)).status, 403);
    assert.equal((await call('/academic/state', 'GET', undefined, legacy)).status, 200);
    assert.equal((await call('/academic/state')).body.data.currentTermId, null);
    assert.equal((await call('/academic/state?owner=other')).status, 400);
  });
  await t.test('different students own independent years and selection; switching keeps historical subjects', async () => {
    term = await create('terms', { startYear: 2026, semester: 'First Semester' });
    secondTerm = await create('terms', { startYear: 2025, semester: 'Summer term' });
    bobTerm = await create('terms', { startYear: 2024, semester: 'Second Semester' }, bob);
    subject = await create('subjects', { termId: term.id, name: 'Database systems', courseCode: 'ITE 314' });
    secondSubject = await create('subjects', { termId: secondTerm.id, name: 'Historical subject' });
    assert.equal((await call('/academic/state')).body.data.subjects[0].id, subject.id);
    assert.equal((await call('/academic/current-term', 'PATCH', { currentTermId: secondTerm.id })).status, 200);
    assert.deepEqual((await call('/academic/state')).body.data.subjects.map(row => row.id), [secondSubject.id]);
    assert.equal((await call('/academic/state', 'GET', undefined, bob)).body.data.currentTermId, bobTerm.id);
    assert.equal((await call('/academic/current-term', 'PATCH', { currentTermId: bobTerm.id })).status, 404);
    assert.equal((await call('/academic/current-term', 'PATCH', { currentTermId: term.id })).status, 200);
    assert.equal((await call('/academic/terms', 'POST', { startYear: 2026, semester: 'First Semester' })).status, 409);
    assert.equal((await call(`/academic/terms/${term.id}`, 'DELETE', {})).status, 409);
  });
  await t.test('custom periods, arbitrary module counts, grouping, reorder and explicit status', async () => {
    period = await create('periods', { subjectId: subject.id, label: 'Laboratory practical', order: 10 });
    module = await create('modules', { subjectId: subject.id, periodId: period.id, title: 'Module 12', order: 12 });
    assert.equal(module.status, 'not_started');
    assert.equal((await call(`/academic/modules/${module.id}`, 'PATCH', { status: 'in_progress', order: 2 })).status, 200);
    assert.equal((await call(`/academic/modules/${module.id}`, 'PATCH', { subjectId: secondSubject.id })).status, 400);
    assert.equal((await call(`/academic/periods/${period.id}`, 'DELETE', {})).status, 409);
    const wrongPeriod = await create('periods', { subjectId: secondSubject.id, label: 'Final' });
    assert.equal((await call(`/academic/modules/${module.id}`, 'PATCH', { periodId: wrongPeriod.id })).status, 400);
    const state = (await call('/academic/state')).body.data; assert.equal(state.continueModule._id, module.id); assert.equal(state.subjects[0].completedCount, 0);
  });
  await t.test('private Forms/Drive bookmarks and notes; no external scores or completion', async () => {
    resource = await create('resources', { subjectId: subject.id, moduleId: module.id, kind: 'google_form_link', title: 'Teacher quiz', url: 'https://forms.gle/abc' });
    await create('resources', { subjectId: subject.id, kind: 'google_drive_link', title: 'Slides', url: 'https://docs.google.com/presentation/d/abc/edit' });
    await create('resources', { subjectId: subject.id, moduleId: module.id, kind: 'note', title: 'My notes', note: 'Review normalization.' });
    assert.equal((await call('/academic/resources', 'POST', { subjectId: subject.id, title: 'Bad', kind: 'google_form_link', url: 'https://forms.gle.evil.test/x' })).status, 400);
    const result = (await call(`/academic/subjects/${subject.id}`)).body.data;
    assert.ok(result.resources.every(row => row.visibility === 'private' && !('content' in row) && !('score' in row)));
    assert.equal(result.modules[0].status, 'in_progress');
  });
  await t.test('private PDFs/PPTX reuse the bounded parser, authenticated download and metadata privacy', async () => {
    let result = await upload(module.id); assert.equal(result.status, 201, JSON.stringify(result)); source = result.body.data;
    assert.ok(!('content' in source));
    const url = root + `/academic/resources/${source.id}/file`;
    const response = await fetch(url, { headers: headers(alice) }); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/); assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdf());
    assert.equal((await fetch(url, { headers: headers(bob) })).status, 404);
    assert.equal((await fetch(url)).status, 401);
    result = await upload(module.id, alice, pptx(), 'slides.pptx'); assert.equal(result.status, 201, JSON.stringify(result));
    assert.equal((await upload(module.id, alice, pdf(''), 'scanned.pdf')).status, 400);
    assert.equal((await upload(module.id, alice, pdf(), 'mismatch.pptx')).status, 400);
    assert.equal((await upload(module.id, alice, Buffer.alloc(5242881), 'huge.pdf')).status, 413);
    assert.equal((await upload(module.id, bob)).status, 404);
    assert.equal((await call(`/academic/resources/${source.id}`, 'PATCH', { url: 'javascript:alert(1)' })).status, 400);
  });
  await t.test('direct-ID cross-user reads, writes, reassignment, parent and file access are denied', async () => {
    assert.equal((await call(`/academic/subjects/${subject.id}`, 'GET', undefined, bob)).status, 404);
    for (const [type, row, body] of [['terms', term, { semester: 'Stolen' }], ['subjects', subject, { name: 'Stolen' }], ['periods', period, { label: 'Stolen' }], ['modules', module, { title: 'Stolen' }], ['resources', resource, { title: 'Stolen' }]]) {
      assert.equal((await call(`/academic/${type}/${row.id}`, 'PATCH', body, bob)).status, 404);
      assert.equal((await call(`/academic/${type}/${row.id}`, 'DELETE', {}, bob)).status, 404);
    }
    assert.equal((await call('/academic/subjects', 'POST', { termId: term.id, name: 'Stolen' }, bob)).status, 404);
    assert.equal((await call('/academic/modules', 'POST', { subjectId: subject.id, title: 'Stolen' }, bob)).status, 404);
    assert.equal((await call('/academic/resources', 'POST', { subjectId: secondSubject.id, moduleId: module.id, title: 'Wrong parent', kind: 'note', note: 'Text' })).status, 400);
  });
  await t.test('old standalone sets and attempts survive optional owner-checked associations', async () => {
    standalone = await StudySet.create({ owner: alice._id, title: 'Legacy quiz', subject: 'Database systems', questions: [{ prompt: 'Which input is required?', options: ['Sorted', 'Unsorted'], correctIndex: 0 }] });
    assert.equal((await call(`/study-sets/${standalone._id}`)).status, 200);
    let result = await call(`/academic/study-sets/${standalone._id}/associations`, 'PATCH', { subjectId: subject.id, moduleId: module.id, sourceResourceIds: [source.id] }); assert.equal(result.status, 200, JSON.stringify(result));
    await StudySet.updateOne({ _id: standalone._id }, { $set: { state: 'pending' } });
    const moderation = await call(`/moderator/study-sets/${standalone._id}`, 'GET', undefined, moderator); assert.equal(moderation.status, 200, JSON.stringify(moderation));
    for (const field of ['subjectId', 'moduleId', 'sourceResourceIds']) assert.ok(!(field in moderation.body.data), 'Private academic associations stay out of staff publication review');
    await StudySet.updateOne({ _id: standalone._id }, { $set: { state: 'private' } });
    assert.equal((await call(`/academic/study-sets/${standalone._id}/associations`, 'PATCH', { subjectId: subject.id }, bob)).status, 404);
    assert.equal((await call(`/academic/study-sets/${standalone._id}/associations`, 'PATCH', { subjectId: secondSubject.id, moduleId: null, sourceResourceIds: [source.id] })).status, 400);
    assert.equal((await call(`/academic/resources/${source.id}`, 'DELETE', {})).status, 409);
    const start = await call(`/study-sets/${standalone._id}/start`, 'POST', {}); assert.equal(start.status, 201, JSON.stringify(start));
    const attemptId = start.body.data.id; assert.equal((await call(`/study-sets/attempts/${attemptId}/submit`, 'POST', { answers: [1] })).status, 200);
    assert.equal((await call(`/study-sets/attempts/${attemptId}`, 'GET', undefined, bob)).status, 404);
    assert.equal((await call('/academic/state')).body.data.needsReview[0].score, 0);
    assert.equal((await call(`/academic/study-sets/${standalone._id}/associations`, 'PATCH', { subjectId: null, moduleId: null, sourceResourceIds: [] })).status, 200);
    assert.equal((await call(`/study-sets/attempts/${attemptId}`)).body.data.score, 0);
  });
  await t.test('existing mocked AI upload/preview/save attaches to a module and retains private practice history', async () => {
    const body = new FormData(); body.append('document', new Blob([pdf()]), 'synthetic.pdf'); body.append('type', 'both'); body.append('syntheticConsent', 'true');
    const response = await fetch(root + '/ai-study/generate', { method: 'POST', headers: { ...headers(alice), 'Idempotency-Key': 'bundle-a-synthetic-0001' }, body }); assert.equal(response.status, 200); const preview = (await response.json()).data;
    const bobSubject = await create('subjects', { termId: bobTerm.id, name: 'Bob only' }, bob);
    let result = await call('/ai-study/sets', 'POST', { previewId: preview.previewId, title: 'AI module practice', subjectId: bobSubject.id }); assert.equal(result.status, 404);
    result = await call('/ai-study/sets', 'POST', { previewId: preview.previewId, title: 'AI module practice', subjectId: subject.id, moduleId: module.id, sourceResourceIds: [source.id] }); assert.equal(result.status, 201, JSON.stringify(result)); generated = result.body.data;
    assert.equal(generated.moduleId, module.id); assert.equal(providerCalls, 1);
    assert.equal((await call(`/ai-study/sets/${generated.id}/practice`, 'POST', { answers: [1] })).status, 200);
    assert.equal((await call('/academic/state')).body.data.needsReview[0].score, 0);
    assert.equal((await call(`/ai-study/sets/${generated.id}`, 'GET', undefined, bob)).status, 404);
    assert.equal((await call(`/academic/subjects/${subject.id}`)).body.data.studySets[0].id, generated.id);
  });
  await t.test('selection and concurrent deletion/association serialize without dangling references; unrelated ledgers unchanged', async () => {
    const empty = await create('terms', { startYear: 2028, semester: 'Temporary' });
    const results = await Promise.all([call('/academic/current-term', 'PATCH', { currentTermId: empty.id }), call(`/academic/terms/${empty.id}`, 'DELETE', {})]);
    assert.ok(results.every(row => [200, 404].includes(row.status)), JSON.stringify(results));
    assert.equal(await models.AcademicTerm.countDocuments({ _id: empty.id }), 0); assert.notEqual(String((await User.findById(alice._id)).currentTermId), empty.id);
    const temporaryModule = await create('modules', { subjectId: subject.id, title: 'Temporary concurrent module' });
    const temporarySet = await StudySet.create({ owner: alice._id, title: 'Concurrent draft' });
    const race = await Promise.all([call('/academic/study-sets/' + temporarySet._id + '/associations', 'PATCH', { subjectId: subject.id, moduleId: temporaryModule.id }), call('/academic/modules/' + temporaryModule.id, 'DELETE', {})]);
    assert.ok(race.every(row => [200, 404, 409].includes(row.status)), JSON.stringify(race));
    const linked = await StudySet.findById(temporarySet._id);
    if (linked.moduleId) assert.ok(await models.PersonalModule.exists({ _id: linked.moduleId, owner: alice._id }));
    for (const actor of [alice, bob]) assert.equal((await User.findById(actor._id)).credits, 100);
    assert.equal(await CreditTransaction.countDocuments(), 0); assert.equal(await Session.countDocuments(), 0);
  });
});
