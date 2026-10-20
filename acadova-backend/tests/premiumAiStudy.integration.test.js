const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const StudySet = require('../models/StudySet');
const Preview = require('../models/AiStudyPreview');
const Quota = require('../models/AiStudyQuota');
const CreditTransaction = require('../models/CreditTransaction');
const { AcademicTerm, PersonalSubject, PersonalModule, AcademicResource } = require('../models/academic');
const { source, output } = require('./fixtures/strictStudyDocuments.cjs');

test('Premium module AI: real loopback replica-set transactions with synthetic source/provider', { skip: process.env.ACADOVA_PREMIUM_DB_TESTS !== '1', timeout: 60000 }, async t => {
  assert.notEqual(process.env.NODE_ENV, 'production');
  // Deliberately no dotenv/configured URI. Never accept an external URI override.
  const database = 'acadova_premium_ai_test_' + randomUUID().replaceAll('-', '');
  const secret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'premium-synthetic-test-only';
  t.after(async () => {
    if (mongoose.connection.readyState === 1) {
      assert.equal(mongoose.connection.host, '127.0.0.1');
      assert.equal(mongoose.connection.name, database);
      assert.match(database, /^acadova_premium_ai_test_[a-f0-9]{32}$/);
      await mongoose.connection.dropDatabase(); // Only this fresh test-owned UUID database.
    }
    await mongoose.disconnect();
    if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret;
  });
  await mongoose.connect('mongodb://127.0.0.1:27031/admin?directConnection=true', { serverSelectionTimeoutMS: 5000 });
  try { await mongoose.connection.db.admin().command({ replSetInitiate: { _id: 'acadovaAiQA', members: [{ _id: 0, host: '127.0.0.1:27031' }] } }); }
  catch (error) { if (error.codeName !== 'AlreadyInitialized') throw error; }
  await mongoose.disconnect();
  await mongoose.connect(`mongodb://127.0.0.1:27031/${database}?replicaSet=acadovaAiQA`, { serverSelectionTimeoutMS: 20000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  assert.equal(hello.setName, 'acadovaAiQA');
  assert.deepEqual(hello.hosts, ['127.0.0.1:27031']);
  for (const model of [User, StudySet, Preview, Quota, AcademicTerm, PersonalSubject, PersonalModule, AcademicResource, CreditTransaction]) await model.init();
  const [alice, bob, moderator] = await User.create(['Alice', 'Bob', 'Moderator'].map(name => ({ name, email: name + '@example.test', password: 'synthetic-test-only', emailVerified: true, role: name === 'Moderator' ? 'moderator' : 'student', credits: 100 })));
  const term = await AcademicTerm.create({ owner: alice._id, startYear: 2026, endYear: 2027, semester: 'First' });
  const subject = await PersonalSubject.create({ owner: alice._id, termId: term._id, name: 'Synthetic algorithms' });
  const module = await PersonalModule.create({ owner: alice._id, subjectId: subject._id, title: 'Synthetic source module' });
  const fixture = source();
  const resource = await AcademicResource.create({ owner: alice._id, subjectId: subject._id, moduleId: module._id, title: 'Synthetic slides', kind: 'pptx', fileName: 'synthetic.pptx', bytes: fixture.buffer.length, content: fixture.buffer });
  const duplicate = await AcademicResource.create({ owner: alice._id, subjectId: subject._id, moduleId: module._id, title: 'Renamed identical slides', kind: 'pptx', fileName: 'renamed.pptx', bytes: fixture.buffer.length, content: fixture.buffer });
  const config = require('../config/aiStudy').aiStudyConfig({ NODE_ENV: 'test', AI_STUDY_ENABLED: 'true', AI_STUDY_LOCAL_QA: 'true', GEMINI_API_KEY: 'mock-only' });
  let calls = 0, hold = true, release, invalid = false;
  const app = express(); app.use(express.json({ limit: '100kb' }));
  app.use('/api/ai-study', require('../routes/aiStudyRoutes').createAiStudyRouter({ configFor: () => config, provider: { generate: async ({ document, type }) => {
    calls++;
    if (hold) await new Promise(resolve => { release = resolve; });
    const data = output(document);
    if (type === 'quiz') data.flashcards = [];
    if (type === 'flashcards') data.questions = [];
    if (invalid) { if (data.flashcards[0]) data.flashcards[0].back = 'Unsupported'; if (data.questions[0]) data.questions[0].sourceRef = 99; }
    return data;
  } } }));
  app.use('/api/academic', require('../routes/academicWorkspaceRoutes'));
  app.use(require('../middleware/validation').validationErrorHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const root = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (path, method = 'GET', body, actor = alice, key) => {
    const result = await fetch(root + path, { method, headers: { authorization: `Bearer ${jwt.sign({ id: String(actor._id) }, process.env.JWT_SECRET)}`, 'content-type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: result.status, body: await result.json() };
  };
  const body = extra => ({ resourceId: String(resource._id), sourceId: fixture.sourceId, type: 'both', mode: 'strict_source', syntheticConsent: true, count: 1, autoSave: true, ...extra });
  let saved;
  await t.test('server gate, consent, stale sources and role/owner boundaries remain enforced', async () => {
    config.enabled = false; assert.equal((await call('/ai-study/generate-resource', 'POST', body(), alice, 'premium-disabled-01')).status, 503); config.enabled = true;
    assert.equal((await call('/ai-study/generate-resource', 'POST', body({ syntheticConsent: false }), alice, 'premium-consent-01')).status, 400);
    assert.equal((await call('/ai-study/generate-resource', 'POST', body(), bob, 'premium-foreign-01')).status, 404);
    assert.equal((await call('/ai-study/sources/' + resource._id, 'GET', undefined, moderator)).status, 403);
    assert.equal((await call('/ai-study/generate-resource', 'POST', body({ sourceId: 'f'.repeat(64) }), alice, 'premium-stale-001')).status, 409);
    assert.equal(calls, 0);
  });
  await t.test('simultaneous equivalent requests join; Both persists once and content reuse ignores filename', async () => {
    const first = call('/ai-study/generate-resource', 'POST', body(), alice, 'premium-concurrent-01');
    try {
      for (let i = 0; i < 300 && !release; i++) await new Promise(resolve => setTimeout(resolve, 10));
      assert.ok(release, 'Provider reached');
      const joined = await call('/ai-study/generate-resource', 'POST', body(), alice, 'premium-concurrent-02');
      assert.equal(joined.status, 200, JSON.stringify(joined)); assert.equal(joined.body.data.pending, true); assert.equal(calls, 1);
    } finally { hold = false; release?.(); }
    const result = await first; assert.equal(result.status, 200, JSON.stringify(result)); saved = result.body.data.savedSet;
    assert.ok(saved, JSON.stringify(result)); assert.equal(saved.flashcards.length, 1); assert.equal(saved.questions.length, 1);
    assert.equal(saved.subjectId, String(subject._id)); assert.equal(saved.moduleId, String(module._id)); assert.deepEqual(saved.sourceResourceIds, [String(resource._id)]);
    const before = await Quota.findById(alice._id);
    const reused = await call('/ai-study/generate-resource', 'POST', body({ resourceId: String(duplicate._id) }), alice, 'premium-duplicate-01');
    assert.equal(reused.body.data.savedSet.id, saved.id); assert.equal(reused.body.data.reused, true); assert.equal(calls, 1);
    assert.equal((await Quota.findById(alice._id)).used, before.used); assert.equal(await StudySet.countDocuments(), 1);
    assert.equal(await Preview.countDocuments(), 0);
  });
  await t.test('reload/reconnect read persisted Both; source metadata and subject counts reference the same record', async () => {
    const replay = await call('/ai-study/requests/premium-concurrent-01'); assert.equal(replay.body.data.result.savedSet.id, saved.id);
    const reload = (await call('/ai-study/sets/' + saved.id)).body.data;
    assert.equal(reload.questions[0].sourceQuote, saved.questions[0].sourceQuote);
    assert.equal((await call('/ai-study/sources/' + duplicate._id)).body.data.matches[0].id, saved.id);
    assert.equal((await call('/academic/subjects/' + subject._id)).body.data.studySets.length, 1);
    assert.equal((await call('/ai-study/sets/' + saved.id, 'GET', undefined, bob)).status, 404);
    assert.equal((await call('/ai-study/sets/' + saved.id + '/practice', 'POST', { answers: [0] })).body.data.score, 100);
  });
  await t.test('archive/restore are version checked and preserve content; unauthorized changes fail', async () => {
    assert.equal((await call('/ai-study/sets/' + saved.id + '/archive', 'POST', { version: 1, archived: true }, bob)).status, 409);
    const archive = await call('/ai-study/sets/' + saved.id + '/archive', 'POST', { version: 1, archived: true }); assert.ok(archive.body.data.archivedAt);
    assert.equal((await call('/academic/subjects/' + subject._id)).body.data.studySets[0].archivedAt, archive.body.data.archivedAt);
    assert.equal((await call('/ai-study/sets/' + saved.id + '/archive', 'POST', { version: 1, archived: false })).status, 409);
    saved = (await call('/ai-study/sets/' + saved.id + '/archive', 'POST', { version: 2, archived: false })).body.data;
    assert.equal(saved.archivedAt, null); assert.equal(saved.version, 3); assert.equal(await StudySet.countDocuments(), 1);
  });
  await t.test('autosave transaction rolls back on persistence error and retry saves without regeneration', async () => {
    const originalCreate = StudySet.create;
    StudySet.create = async (...args) => { await originalCreate.apply(StudySet, args); throw new Error('Synthetic failure after transactional insert'); };
    let generated;
    try { generated = await call('/ai-study/generate-resource', 'POST', body({ regenerateOf: saved.id, regenerateVersion: 3 }), alice, 'premium-regen-fail-01'); }
    finally { StudySet.create = originalCreate; }
    assert.equal(generated.body.data.saveFailed, true, JSON.stringify(generated)); assert.equal(await StudySet.countDocuments(), 1); assert.equal(await Preview.countDocuments(), 1);
    assert.equal((await Quota.findById(alice._id)).requests.at(-1).state, 'complete');
    const before = calls; const draft = { previewId: generated.body.data.previewId, title: 'Recovered new version' };
    const retries = await Promise.all([call('/ai-study/sets', 'POST', draft), call('/ai-study/sets', 'POST', draft)]);
    assert.deepEqual(retries.map(row => row.status), [201, 201], JSON.stringify(retries)); assert.equal(retries[0].body.data.id, retries[1].body.data.id);
    assert.equal(retries[0].body.data.ai.regeneratedFrom, saved.id); assert.equal(await StudySet.countDocuments(), 2); assert.equal(calls, before); assert.equal(await Preview.countDocuments(), 0);
    assert.equal((await StudySet.findById(saved.id)).version, 3);
  });
  await t.test('unsupported source evidence never saves; interrupted receipts never launch a hidden retry', async () => {
    invalid = true;
    const failed = await call('/ai-study/generate-resource', 'POST', body({ type: 'quiz' }), alice, 'premium-invalid-01');
    assert.equal(failed.status, 422, JSON.stringify(failed)); assert.equal(await StudySet.countDocuments(), 2); assert.equal(await Preview.countDocuments(), 0);
    const quota = await Quota.findById(alice._id); const last = quota.requests.at(-1); last.state = 'pending'; quota.activeKey = last.key; quota.activeUntil = new Date(0); await quota.save();
    const before = calls;
    assert.equal((await call('/ai-study/requests/' + last.key)).body.data.state, 'interrupted');
    const replay = await call('/ai-study/generate-resource', 'POST', body({ type: 'quiz' }), alice, 'premium-reconnect-01');
    assert.equal(replay.body.code, 'AI_STUDY_INTERRUPTED'); assert.equal(calls, before);
    assert.equal((await User.findById(alice._id)).credits, 100); assert.equal(await CreditTransaction.countDocuments(), 0);
  });
});
