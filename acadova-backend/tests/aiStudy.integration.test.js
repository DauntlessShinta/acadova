// Explicitly opted-in synthetic QA on a dedicated loopback replica set, never dotenv/production.
const test = require('node:test'); const assert = require('node:assert/strict');
const mongoose = require('mongoose'); const express = require('express'); const jwt = require('jsonwebtoken');
const User = require('../models/User'); const StudySet = require('../models/StudySet');
const Quota = require('../models/AiStudyQuota'); const Preview = require('../models/AiStudyPreview');
const CreditTransaction = require('../models/CreditTransaction'); const Assessment = require('../models/Assessment');
const AssessmentAttempt = require('../models/AssessmentAttempt'); const LessonCompletion = require('../models/LessonCompletion');
const StudyAttempt = require('../models/StudyAttempt'); const StudyReport = require('../models/StudyReport');
const { validationErrorHandler } = require('../middleware/validation');
const { aiStudyConfig } = require('../config/aiStudy'); const { pdf, pptx, output } = require('./fixtures/aiStudyDocuments.cjs');
test('AI study upload → private save → practice isolation with actual local MongoDB', { skip: process.env.ACADOVA_AI_DB_TESTS !== '1' }, async t => {
  assert.notEqual(process.env.NODE_ENV, 'production');
  await mongoose.connect('mongodb://127.0.0.1:27031/admin?directConnection=true', { serverSelectionTimeoutMS: 5000 });
  try { await mongoose.connection.db.admin().command({ replSetInitiate: { _id: 'acadovaAiQA', members: [{ _id: 0, host: '127.0.0.1:27031' }] } }); }
  catch (error) { if (error.codeName !== 'AlreadyInitialized') throw error; }
  await mongoose.disconnect();
  const database = `acadova_ai_test_${process.pid}`;
  await mongoose.connect(`mongodb://127.0.0.1:27031/${database}?replicaSet=acadovaAiQA`, { serverSelectionTimeoutMS: 20000 });
  assert.equal((await mongoose.connection.db.admin().command({ hello: 1 })).setName, 'acadovaAiQA');
  const config = { ...aiStudyConfig({ NODE_ENV: 'test', AI_STUDY_ENABLED: 'true', AI_STUDY_LOCAL_QA: 'true', GEMINI_API_KEY: 'mock-only' }), maxSets: 2 };
  const oldSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'ai-synthetic-jwt-test-only';
  const nativeFetch = global.fetch; global.fetch = async () => assert.fail('Provider network access forbidden in mocked QA');
  await Promise.all([User,StudySet,Quota,Preview,CreditTransaction,Assessment,AssessmentAttempt,LessonCompletion,StudyAttempt,StudyReport].map(model => model.init()));
  const [student, other, moderator, unverified, suspended] = await User.create(['student','other','moderator','unverified','suspended'].map((name, i) => ({ name: `AI Fixture ${name}`, email: `ai-${i}@example.test`, password: 'synthetic-fixture', role: name === 'moderator' ? 'moderator' : 'student', emailVerified: name !== 'unverified', credits: 100, ...(name === 'suspended' ? { suspendedAt: new Date() } : {}) })));
  let calls = 0; let failProvider = false; let badOutput = false; let gate; let release;
  const provider = { async generate({ document, type }) { calls++; if (gate) await gate; if (failProvider) throw Object.assign(new Error('Mock provider unavailable'), { status: 503 });
    assert.ok(document.buffer || document.slides); return { ...output(), ...(type === 'quiz' ? { flashcards: [] } : type === 'flashcards' ? { questions: [] } : {}), ...(badOutput ? { questions: [] } : {}), modelVersion: 'mocked-gemini' }; } };
  const { securityHeaders, corsMiddleware } = require('../middleware/httpSecurity');
  const app = express(); app.use(securityHeaders); app.use(corsMiddleware); app.use(express.json({ limit: '100kb' }));
  app.use('/api/ai-study', require('../routes/aiStudyRoutes').createAiStudyRouter({ provider, configFor: () => config }));
  app.use('/api/study-sets', require('../routes/studyRoutes')); app.use('/api/moderator/study-sets', require('../routes/studyModerationRoutes')); app.use(validationErrorHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); assert.equal(mongoose.connection.db.databaseName, database); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); global.fetch = nativeFetch; if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret; });
  const token = actor => jwt.sign({ id: String(actor._id) }, process.env.JWT_SECRET);
  const call = async (path, actor = student, method = 'GET', body) => {
    const r = await nativeFetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method, headers: { origin: 'http://localhost:5173', authorization: `Bearer ${token(actor)}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, body: await r.json() };
  };
  const generate = async (actor = student, key = 'synthetic-request-0001', buffer = pdf(), name = 'synthetic.pdf', type = 'both', consent = 'true') => {
    const body = new FormData(); body.append('document', new Blob([buffer]), name); body.append('type', type); body.append('syntheticConsent', consent);
    const r = await nativeFetch(`http://127.0.0.1:${server.address().port}/api/ai-study/generate`, { method: 'POST', headers: { origin: 'http://localhost:5173', authorization: `Bearer ${token(actor)}`, 'Idempotency-Key': key }, body }); assert.equal(r.headers.get('access-control-allow-origin'), 'http://localhost:5173'); return { status: r.status, body: await r.json() };
  };
  let previewId; let setId;
  await t.test('authentication, roles, disabled config, invalid size/signature and consent', async () => {
    const unauth = await nativeFetch(`http://127.0.0.1:${server.address().port}/api/ai-study/sets`); assert.equal(unauth.status, 401);
    for (const actor of [moderator, unverified, suspended]) assert.equal((await call('/ai-study/sets', actor)).status, 403);
    config.enabled = false; assert.equal((await generate()).status, 503); assert.equal((await call('/ai-study/sets')).status, 200); config.enabled = true;
    assert.equal((await generate(student, 'synthetic-bad-0001', pdf(), 'wrong.txt')).status, 400);
    assert.equal((await generate(student, 'synthetic-bad-0002', Buffer.alloc(5242881), 'huge.pdf')).status, 413);
    assert.equal((await generate(student, 'synthetic-bad-0003', pdf(), 'synthetic.pdf', 'both', 'false')).status, 400); assert.equal(calls, 0);
  });
  await t.test('repeated Generate calls replay once, and save retries create only one private set', async () => {
    const result = await generate(); assert.equal(result.status, 200, JSON.stringify(result.body)); previewId = result.body.data.previewId;
    const replay = await generate(); assert.equal(replay.body.data.previewId, previewId); assert.equal(calls, 1);
    assert.equal((await generate(student, 'synthetic-request-0001', pptx(), 'different.pptx')).status, 409);
    assert.equal((await Quota.findById(student._id)).used, 1);
    const saves = await Promise.all([call('/ai-study/sets', student, 'POST', { previewId, title: 'Private algorithms' }), call('/ai-study/sets', student, 'POST', { previewId, title: 'Private algorithms' })]);
    assert.deepEqual(saves.map(row => row.status), [201, 201]); setId = saves[0].body.data.id; assert.equal(saves[1].body.data.id, setId); assert.equal(await StudySet.countDocuments(), 1); assert.equal(await Preview.countDocuments(), 0);
    const row = await StudySet.findById(setId); assert.equal(row.origin, 'ai'); assert.equal(row.state, 'private'); assert.equal(row.flashcards.length, 2); assert.equal(row.ai.sourceName, 'synthetic.pdf'); assert.ok(!JSON.stringify(row).includes('buffer'));
  });
  await t.test('cross-user access and all generic publication/start/edit/staff paths are blocked', async () => {
    const path = '/ai-study/sets/' + setId;
    assert.equal((await call(path, other)).status, 404); assert.equal((await call(path, other, 'PATCH', { title: 'Intrusion', version: 1 })).status, 409);
    assert.equal((await call(path + '/delete', other, 'POST', { version: 1 })).status, 409); assert.equal((await call(path + '/practice', other, 'POST', { answers: [0] })).status, 404);
    assert.equal((await call('/ai-study/sets', other, 'POST', { previewId, title: 'Intrusion' })).status, 410);
    assert.equal((await call('/study-sets/' + setId, other)).status, 404); assert.equal((await call('/moderator/study-sets/' + setId, moderator)).status, 404);
    assert.equal((await call('/study-sets/' + setId + '/publication', student, 'POST', { version: 1 })).status, 403);
    assert.equal((await call('/study-sets/' + setId + '/start', student, 'POST', {})).status, 400);
    const content = { title: 'Edit', subject: 'Testing', description: '', questions: [] };
    assert.equal((await call('/study-sets/' + setId, student, 'PATCH', { ...content, version: 1 })).status, 409);
    assert.equal((await call('/study-sets/' + setId + '/delete', student, 'POST', { version: 1 })).status, 409);
    assert.equal((await call('/study-sets/shared', other)).body.data.length, 0); assert.equal((await call('/moderator/study-sets', moderator)).body.data.length, 0);
  });
  await t.test('rename, real reload, scoring, retakes, bounded history and complete credit/assessment/progress isolation', async () => {
    const path = '/ai-study/sets/' + setId;
    assert.equal((await call(path, student, 'PATCH', { title: 'Renamed practice', version: 1 })).status, 200); assert.equal((await call(path)).body.data.title, 'Renamed practice');
    assert.equal((await call(path, student, 'PATCH', { title: 'Stale edit', version: 1 })).status, 409);
    assert.equal((await call(path + '/practice', student, 'POST', { answers: [1] })).body.data.score, 0);
    for (let i = 0; i < 22; i++) { const result = await call(path + '/practice', student, 'POST', { answers: [0] }); assert.equal(result.status, 200); assert.equal(result.body.data.creditsAwarded, 0); }
    assert.equal((await StudySet.findById(setId)).practiceHistory.length, 20); assert.equal((await call('/ai-study/sets')).body.data.length, 1);
    assert.equal((await User.findById(student._id)).credits, 100);
    for (const model of [CreditTransaction,Assessment,AssessmentAttempt,LessonCompletion,StudyAttempt,StudyReport]) assert.equal(await model.countDocuments(), 0, model.modelName);
  });
  await t.test('one active generation across races, PPTX, daily durable quota and saved sets during outage', async () => {
    gate = new Promise(resolve => { release = resolve; });
    const active = generate(student, 'synthetic-request-0002', pptx(), 'synthetic.pptx');
    for (let i = 0; i < 100 && calls < 2; i++) await new Promise(resolve => setTimeout(resolve, 25));
    const races = await Promise.all([generate(student, 'synthetic-request-0002', pptx(), 'synthetic.pptx'), generate(student, 'synthetic-request-0003')]);
    assert.deepEqual(races.map(row => row.status), [409, 409]); release(); gate = null;
    const result = await active; assert.equal(result.status, 200); assert.equal(result.body.data.ai.sourceFormat, 'pptx');
    config.maxSets = 1; assert.equal((await call('/ai-study/sets', student, 'POST', { previewId: result.body.data.previewId, title: 'Slide practice' })).status, 429); config.maxSets = 2;
    assert.equal((await call('/ai-study/sets', student, 'POST', { previewId: result.body.data.previewId, title: 'Slide practice' })).status, 201);
    failProvider = true; assert.equal((await generate(student, 'synthetic-request-0003')).status, 503); assert.equal((await generate(student, 'synthetic-request-0003')).status, 409);
    assert.equal((await generate(student, 'synthetic-request-0004')).status, 429); assert.equal((await Quota.findById(student._id)).used, 3);
    config.enabled = false; assert.equal((await call('/ai-study/sets')).body.data.length, 2); assert.equal((await call('/ai-study/sets/' + setId)).status, 200); config.enabled = true; failProvider = false;
  });
  await t.test('invalid generated output never persists, expired preview cannot save, and delete removes owned data/history', async () => {
    badOutput = true; assert.equal((await generate(other, 'other-invalid-output-01')).status, 502); assert.equal(await Preview.countDocuments({ owner: other._id }), 0); badOutput = false;
    const result = await generate(other, 'other-expired-output-02'); assert.equal(result.status, 200);
    await Preview.updateOne({ _id: result.body.data.previewId }, { $set: { expiresAt: new Date(0) } });
    assert.equal((await call('/ai-study/sets', other, 'POST', { previewId: result.body.data.previewId, title: 'Expired' })).status, 410);
    const current = (await call('/ai-study/sets/' + setId)).body.data; assert.equal((await call('/ai-study/sets/' + setId + '/delete', student, 'POST', { version: current.version })).status, 200);
    assert.equal((await call('/ai-study/sets/' + setId)).status, 404); assert.equal(await StudySet.countDocuments({ _id: setId }), 0); assert.equal((await User.findById(student._id)).credits, 100);
  });
});
