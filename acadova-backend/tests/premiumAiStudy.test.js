// Exercises real controller/strict validators with model stubs. This is NOT a MongoDB concurrency proof.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../models/User');
const SetModel = require('../models/StudySet');
const Quota = require('../models/AiStudyQuota');
const Preview = require('../models/AiStudyPreview');
const { PersonalSubject, PersonalModule, AcademicResource } = require('../models/academic');
const { createAiStudyController } = require('../controllers/aiStudyController');
const { aiStudyConfig } = require('../config/aiStudy');
const { source, output } = require('./fixtures/strictStudyDocuments.cjs');
const owner = '507f1f77bcf86cd799439011', other = '507f1f77bcf86cd799439012';
const subject = '507f1f77bcf86cd799439021', moduleId = '507f1f77bcf86cd799439022';
const rid = '507f1f77bcf86cd799439023', duplicateRid = '507f1f77bcf86cd799439024';
const query = fn => { const q = { select: () => q, session: () => q, sort: () => q, limit: () => q, lean: () => q, then: (resolve, reject) => Promise.resolve().then(fn).then(resolve, reject) }; return q; };
const get = (row, path) => path.split('.').reduce((value, key) => value?.[key], row);
const matches = (row, filter) => row && Object.entries(filter).every(([key, value]) => {
  const actual = get(row, key);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    if ('$exists' in value) return (actual !== undefined) === value.$exists;
    if ('$ne' in value) return actual !== value.$ne;
    if ('$in' in value) return value.$in.includes(actual);
    if ('$gt' in value) return actual > value.$gt;
  }
  return value === null ? actual == null : String(actual) === String(value);
});
const res = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('module autosave, content reuse, reconnect, archive and failure contracts (stubbed transactions)', async t => {
  const originals = [];
  const replace = (object, key, value) => { originals.push(() => { object[key] = value; }); object[key] = value; };
  t.after(() => originals.reverse().forEach(restore => restore()));
  const fixture = source(); let rows = [], previews = [], quota, calls = 0, sequence = 30, failSave = false, invalid = false, release, held = false;
  const resources = [rid, duplicateRid].map((id, index) => ({ _id: id, owner, subjectId: subject, moduleId, kind: 'pptx', fileName: index ? 'different-name.pptx' : 'source.pptx', content: fixture.buffer, bytes: fixture.buffer.length }));
  let tail = Promise.resolve();
  replace(mongoose, 'startSession', async () => ({ endSession: async () => {}, withTransaction: async fn => { const previous = tail; let done; tail = new Promise(resolve => { done = resolve; }); await previous; try { return await fn(); } finally { done(); } } }));
  replace(User, 'findOneAndUpdate', async filter => [owner, other].includes(filter._id) ? { _id: filter._id, role: 'student' } : null);
  replace(PersonalSubject, 'findOne', filter => query(() => matches({ _id: subject, owner }, filter) ? { _id: subject, owner } : null));
  replace(PersonalModule, 'findOne', filter => query(() => matches({ _id: moduleId, owner, subjectId: subject }, filter) ? { _id: moduleId, owner, subjectId: subject } : null));
  replace(AcademicResource, 'findOne', filter => query(() => resources.find(row => matches(row, filter)) || null));
  replace(Quota, 'findById', () => query(() => quota));
  replace(Quota, 'findOneAndUpdate', () => query(() => quota));
  replace(Quota, 'updateOne', async (filter, update) => {
    if (!quota) {
      quota = new Quota({ _id: owner, day: '', used: 0, activeUntil: new Date(0), requests: [] });
      quota.save = async () => {};
    }
    const request = quota.requests.find(row => row.key === (filter['requests.key'] || filter.activeKey) || row.previewId === filter['requests.previewId']);
    for (const [key, value] of Object.entries(update.$set || {})) { if (key.startsWith('requests.$.')) { if (request) request[key.slice(11)] = value; } else quota[key] = value; }
    for (const key of Object.keys(update.$unset || {})) delete quota[key];
  });
  replace(SetModel, 'findOne', filter => query(() => [...rows].reverse().find(row => matches(row, filter)) || null));
  replace(SetModel, 'find', filter => query(() => rows.filter(row => matches(row, filter))));
  replace(SetModel, 'countDocuments', filter => query(() => rows.filter(row => matches(row, filter)).length));
  replace(SetModel, 'create', async ([draft]) => { if (failSave) throw new Error('Synthetic persistence outage'); const row = { ...draft, _id: String(++sequence).padStart(24, '0'), version: 1, archivedAt: null, createdAt: new Date(), practiceHistory: [] }; rows.push(row); return [row]; });
  replace(SetModel, 'findOneAndUpdate', filter => query(() => {
    const row = rows.find(row => matches(row, filter)); if (!row) return null;
    row.archivedAt = row.archivedAt ? null : new Date(); row.version++; return row;
  }));
  replace(Preview, 'create', async ([row]) => { previews.push(row); return [row]; });
  replace(Preview, 'findOne', filter => query(() => previews.find(row => matches(row, filter)) || null));
  replace(Preview, 'deleteOne', async filter => { previews = previews.filter(row => !matches(row, filter)); });
  const config = aiStudyConfig({ NODE_ENV: 'test', AI_STUDY_ENABLED: 'true', AI_STUDY_LOCAL_QA: 'true', GEMINI_API_KEY: 'mock-only' });
  const controller = createAiStudyController({ configFor: () => config, extract: async () => fixture, provider: { generate: async ({ document }) => { calls++; if (held) await new Promise(resolve => { release = resolve; }); const result = output(document); if (invalid) { result.flashcards[0].back = 'Unsupported'; result.questions[0].sourceRef = 99; } return result; } } });
  const call = async (action, body = {}, key = 'premium-request-0001', actor = owner, params = {}) => { const response = res(); await controller[action]({ user: { id: actor }, sourceRequest: true, params, body, get: () => key }, response); return response; };
  const body = extra => ({ resourceId: rid, sourceId: fixture.sourceId, type: 'both', count: 1, mode: 'strict_source', syntheticConsent: true, autoSave: true, ...extra });
  await t.test('concurrent equivalents join one provider call; Both autosaves and replay costs no quota', async () => {
    held = true; const first = call('generate', body());
    for (let i = 0; i < 100 && !release; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.ok(release);
    const joined = await call('generate', body(), 'premium-request-0002');
    if (!joined.body.data?.pending) { release(); held = false; await first; }
    assert.equal(joined.body.data?.pending, true, JSON.stringify(joined.body)); assert.equal(calls, 1); assert.equal(quota.used, 1);
    release(); held = false; const saved = await first;
    assert.equal(saved.statusCode, 200); assert.equal(rows.length, 1); assert.ok(saved.body.data.savedSet);
    assert.equal(rows[0].subjectId, subject); assert.equal(rows[0].moduleId, moduleId); assert.deepEqual(rows[0].sourceResourceIds, [rid]);
    assert.equal(rows[0].flashcards.length, 1); assert.equal(rows[0].questions.length, 1);
    const reused = await call('generate', body({ resourceId: duplicateRid }), 'premium-request-0003');
    assert.equal(reused.body.data.reused, true); assert.equal(reused.body.data.savedSet.id, String(rows[0]._id)); assert.equal(calls, 1); assert.equal(quota.used, 1);
    const recovered = await call('progress', {}, '', owner, { key: 'premium-request-0001' });
    assert.equal(recovered.body.data.result.savedSet.id, String(rows[0]._id));
  });
  await t.test('archive/restore preserve one record and reject stale versions or other owners', async () => {
    const id = String(rows[0]._id);
    assert.equal((await call('archive', { archived: true, version: 1 }, '', other, { id })).statusCode, 409);
    assert.equal((await call('get', {}, '', other, { id })).statusCode, 404);
    assert.equal((await call('generate', body(), 'premium-foreign-0001', other)).statusCode, 404);
    const archived = await call('archive', { archived: true, version: 1 }, '', owner, { id }); assert.ok(archived.body.data.archivedAt);
    assert.equal((await call('archive', { archived: false, version: 1 }, '', owner, { id })).statusCode, 409);
    const restored = await call('archive', { archived: false, version: 2 }, '', owner, { id }); assert.equal(restored.body.data.archivedAt, null); assert.equal(rows.length, 1);
    const regen = await call('generate', body({ regenerateOf: id, regenerateVersion: 3 }), 'premium-regenerate-01');
    assert.equal(regen.statusCode, 200); assert.equal(rows.length, 2); assert.equal(String(rows[1].ai.regeneratedFrom), id); assert.equal(rows[0].version, 3);
  });
  await t.test('save outage retains a validated preview, retry saves once without a provider call', async () => {
    quota = null; rows = []; previews = []; failSave = true;
    const generated = await call('generate', body(), 'premium-savefail-01');
    assert.equal(generated.body.data.saveFailed, true); assert.equal(rows.length, 0); assert.equal(previews.length, 1); assert.equal(quota.requests[0].state, 'complete');
    failSave = false; const before = calls;
    const draft = { previewId: generated.body.data.previewId, title: 'Recovered material', subjectId: subject, moduleId };
    assert.equal((await call('save', draft)).statusCode, 201); assert.equal((await call('save', draft)).statusCode, 201);
    assert.equal(rows.length, 1); assert.equal(calls, before);
  });
  await t.test('unsupported evidence never saves; expired pending execution is not silently retried', async () => {
    quota = null; rows = []; previews = []; invalid = true;
    const failed = await call('generate', body(), 'premium-invalid-01'); assert.equal(failed.statusCode, 422); assert.equal(rows.length, 0); assert.equal(previews.length, 0);
    invalid = false; const request = quota.requests[0]; request.state = 'pending'; quota.activeKey = request.key; quota.activeUntil = new Date(0);
    const before = calls;
    assert.equal((await call('generate', body(), 'premium-reconnect-01')).body.code, 'AI_STUDY_INTERRUPTED'); assert.equal(calls, before);
    const status = await call('progress', {}, '', owner, { key: request.key }); assert.equal(status.body.data.state, 'interrupted');
  });
});
