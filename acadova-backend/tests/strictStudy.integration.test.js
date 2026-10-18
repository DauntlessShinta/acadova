const test = require('node:test'); const assert = require('node:assert/strict');
const mongoose = require('mongoose'); const express = require('express'); const jwt = require('jsonwebtoken');
const User = require('../models/User'); const StudySet = require('../models/StudySet'); const Preview = require('../models/AiStudyPreview'); const Quota = require('../models/AiStudyQuota');
const { AcademicTerm, PersonalSubject, PersonalModule, AcademicResource } = require('../models/academic');
const CreditTransaction = require('../models/CreditTransaction'); const Session = require('../models/Session');
const { source, output } = require('./fixtures/strictStudyDocuments.cjs'); const { sourceId } = require('../services/strictStudySource');
test('Strict Source: private stored source, evidence validation, preview edits, stale checks and idempotent saves', { skip: process.env.ACADOVA_BUNDLE_B_DB_TESTS !== '1' }, async t => {
  assert.notEqual(process.env.NODE_ENV, 'production');
  const database = `acadova_bundle_b_strict_test_${process.pid}`; const secret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'bundle-b-synthetic-fixtures-only';
  await mongoose.connect('mongodb://127.0.0.1:27031/admin?directConnection=true', { serverSelectionTimeoutMS: 5000 });
  try { await mongoose.connection.db.admin().command({ replSetInitiate: { _id: 'acadovaAiQA', members: [{ _id: 0, host: '127.0.0.1:27031' }] } }); } catch (error) { if (error.codeName !== 'AlreadyInitialized') throw error; }
  await mongoose.disconnect(); await mongoose.connect(`mongodb://127.0.0.1:27031/${database}?replicaSet=acadovaAiQA`, { serverSelectionTimeoutMS: 20000 });
  assert.equal((await mongoose.connection.db.admin().command({ hello: 1 })).setName, 'acadovaAiQA');
  await Promise.all([User, StudySet, Preview, Quota, AcademicTerm, PersonalSubject, PersonalModule, AcademicResource, CreditTransaction, Session].map(model => model.init()));
  t.after(async () => { assert.equal(mongoose.connection.name, database); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret; });
  const [alice, bob, moderator] = await User.create(['Alice', 'Bob', 'Moderator'].map(name => ({ name, email: name + '@example.test', password: 'synthetic-fixture', emailVerified: true, role: name === 'Moderator' ? 'moderator' : 'student', credits: 100 })));
  const term = await AcademicTerm.create({ owner: alice._id, startYear: 2026, endYear: 2027, semester: 'First' });
  const subject = await PersonalSubject.create({ owner: alice._id, termId: term._id, name: 'Synthetic algorithms' });
  const module = await PersonalModule.create({ owner: alice._id, subjectId: subject._id, title: 'Synthetic module' });
  const fixture = source();
  const createResource = () => AcademicResource.create({ owner: alice._id, subjectId: subject._id, moduleId: module._id, title: 'Synthetic slides', kind: 'pptx', fileName: 'synthetic.pptx', bytes: fixture.buffer.length, content: fixture.buffer });
  const resource = await createResource(); let calls = 0; let invalidOutput = false;
  const config = require('../config/aiStudy').aiStudyConfig({ NODE_ENV: 'test', AI_STUDY_ENABLED: 'true', AI_STUDY_LOCAL_QA: 'true', GEMINI_API_KEY: 'mock-only' });
  const app = express(); app.use(express.json({ limit: '100kb' }));
  app.use('/api/ai-study', require('../routes/aiStudyRoutes').createAiStudyRouter({ configFor: () => config, provider: { generate: async ({ document, mode }) => {
    calls++; assert.equal(mode, 'strict_source'); assert.equal(document.buffer, undefined); assert.equal(document.slides, undefined);
    const result = output(document); if (invalidOutput) { result.flashcards[0].back = 'Invented'; result.questions[0].sourceRef = 99; } return result;
  } } }));
  app.use('/api/academic', require('../routes/academicWorkspaceRoutes')); app.use(require('../middleware/validation').validationErrorHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const root = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (path, method = 'GET', body, actor = alice, key) => { const response = await fetch(root + path, { method, headers: { authorization: `Bearer ${jwt.sign({ id: String(actor._id) }, process.env.JWT_SECRET)}`, 'content-type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }); return { status: response.status, body: await response.json() }; };
  const body = id => ({ resourceId: String(id), sourceId: fixture.sourceId, type: 'both', mode: 'strict_source', syntheticConsent: true, count: 1 });
  let preview, saved;
  await t.test('unchanged provider policy, required consent, exact identity and cross-user source boundaries', async () => {
    config.enabled = false; assert.equal((await call('/ai-study/generate-resource', 'POST', body(resource._id), alice, 'strict-disabled-0001')).status, 503); config.enabled = true;
    assert.equal((await call('/ai-study/generate-resource', 'POST', { ...body(resource._id), syntheticConsent: false }, alice, 'strict-consent-0001')).status, 400);
    assert.equal((await call('/ai-study/sources/' + resource._id, 'GET', undefined, bob)).status, 404);
    assert.equal((await call('/ai-study/sources/' + resource._id, 'GET', undefined, moderator)).status, 403);
    assert.equal((await call('/ai-study/generate-resource', 'POST', body(resource._id), bob, 'strict-foreign-0001')).status, 404);
    assert.equal((await call('/ai-study/generate-resource', 'POST', { ...body(resource._id), sourceId: 'a'.repeat(64) }, alice, 'strict-stale-0001')).status, 409);
    assert.equal(calls, 0);
  });
  await t.test('owned metadata and generation/replay contain proof snippets but no whole source or binary', async () => {
    const metadata = await call('/ai-study/sources/' + resource._id); assert.equal(metadata.body.data.sourceId, fixture.sourceId); assert.equal(metadata.body.data.name, 'synthetic.pptx');
    const result = await call('/ai-study/generate-resource', 'POST', body(resource._id), alice, 'strict-valid-00001'); assert.equal(result.status, 200, JSON.stringify(result)); preview = result.body.data;
    assert.equal(preview.ai.validationVersion, 'exact_cloze_v1'); assert.equal(preview.questions[0].sourceQuote, fixture.segments[0].text); assert.equal(preview.questions[0].sourceId, fixture.sourceId);
    assert.ok(!JSON.stringify(preview).includes('segments')); assert.ok(!JSON.stringify(preview).includes('buffer'));
    assert.equal((await Preview.findById(preview.previewId)).strictSource, undefined);
    const replay = await call('/ai-study/generate-resource', 'POST', body(resource._id), alice, 'strict-valid-00001'); assert.equal(replay.body.data.previewId, preview.previewId); assert.equal(calls, 1);
  });
  await t.test('invalid edits and foreign preview saves fail; valid edits are revalidated and immutable proof survives reload', async () => {
    const content = { flashcards: JSON.parse(JSON.stringify(preview.flashcards)), questions: JSON.parse(JSON.stringify(preview.questions)) };
    content.flashcards[0].back = 'Unsupported paraphrase';
    assert.equal((await call('/ai-study/sets', 'POST', { previewId: preview.previewId, title: 'My strict set', content })).status, 400);
    assert.equal(await StudySet.countDocuments(), 0);
    assert.equal((await call('/ai-study/sets', 'POST', { previewId: preview.previewId, title: 'Foreign save' }, bob)).status, 410);
    content.flashcards[0].back = preview.flashcards[0].back;
    const saves = await Promise.all([call('/ai-study/sets', 'POST', { previewId: preview.previewId, title: 'My strict set', content }), call('/ai-study/sets', 'POST', { previewId: preview.previewId, title: 'My strict set', content })]);
    assert.deepEqual(saves.map(value => value.status), [201, 201], JSON.stringify(saves)); saved = saves[0].body.data; assert.equal(saved.id, saves[1].body.data.id);
    assert.equal(saved.subjectId, String(subject._id)); assert.deepEqual(saved.sourceResourceIds, [String(resource._id)]); assert.equal(saved.ai.sourceId, fixture.sourceId);
    const reloaded = (await call('/ai-study/sets/' + saved.id)).body.data; assert.equal(reloaded.flashcards[0].sourceQuote, preview.flashcards[0].sourceQuote);
    assert.equal((await call('/ai-study/sets/' + saved.id, 'GET', undefined, bob)).status, 404);
    const replay = await call('/ai-study/generate-resource', 'POST', body(resource._id), alice, 'strict-valid-00001'); assert.equal(replay.body.data.savedSet.id, saved.id); assert.equal(calls, 1);
    assert.equal((await call('/ai-study/sets/' + saved.id + '/practice', 'POST', { answers: [0] })).body.data.score, 100);
    assert.equal((await call('/academic/study-sets/' + saved.id + '/associations', 'PATCH', { sourceResourceIds: [] })).status, 409);
    assert.equal((await call('/academic/resources/' + resource._id, 'DELETE', {})).status, 409);
  });
  await t.test('stale/deleted stored resources cannot be saved from an old preview', async () => {
    const temporary = await createResource(); const result = await call('/ai-study/generate-resource', 'POST', body(temporary._id), alice, 'strict-temporary-01'); assert.equal(result.status, 200); const id = result.body.data.previewId;
    const changed = Buffer.from(source('pdf').buffer); assert.notEqual(sourceId(changed), fixture.sourceId);
    await AcademicResource.updateOne({ _id: temporary._id }, { $set: { content: changed } });
    assert.equal((await call('/ai-study/sets', 'POST', { previewId: id, title: 'Stale source' })).status, 409);
    await AcademicResource.updateOne({ _id: temporary._id }, { $set: { content: fixture.buffer } });
    assert.equal((await call('/academic/resources/' + temporary._id, 'DELETE', {})).status, 200);
    assert.equal((await call('/ai-study/sets', 'POST', { previewId: id, title: 'Deleted source' })).status, 404);
  });
  await t.test('unsupported provider output returns an explicit insufficient-source state and no saved set', async () => {
    invalidOutput = true; const result = await call('/ai-study/generate-resource', 'POST', body(resource._id), alice, 'strict-invalid-001'); assert.equal(result.status, 422, JSON.stringify(result)); assert.equal(result.body.code, 'AI_STUDY_INSUFFICIENT_SOURCE'); assert.equal(result.body.details.reasons.length, 2);
    assert.equal(await StudySet.countDocuments(), 1); assert.equal(await CreditTransaction.countDocuments(), 0); assert.equal(await Session.countDocuments(), 0);
    assert.equal((await User.findById(alice._id)).credits, 100);
  });
});
