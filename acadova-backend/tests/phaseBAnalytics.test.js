const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const User = require('../models/User');
const Session = require('../models/Session');
const CreditTransaction = require('../models/CreditTransaction');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const LearningUnlock = require('../models/LearningUnlock');
const StudyAttempt = require('../models/StudyAttempt');
const { calendarDate, analyticsWindow } = require('../utils/analyticsWindow');
const { apiIdentity } = require('../config/apiIdentity');

test('analytics ranges validate calendar dates, UTC end boundaries and bounded windows', () => {
  assert.equal(calendarDate('2024-02-29'), '2024-02-29');
  for (const input of ['2026-02-29', '2026-13-01', '2026-01-32', 'bad', ['2026-01-01']]) assert.throws(() => calendarDate(input));
  const inspect = query => {
    const req = { query }; let passed = false;
    const res = { code: 200, status(value) { this.code = value; return this; }, json() {} };
    analyticsWindow(req, res, () => { passed = true; });
    return { req, passed, status: res.code };
  };
  assert.equal(inspect({}).passed, true); // Legacy unfiltered endpoint remains available.
  for (const query of [{ from: '2026-01-01' }, { from: '2026-01-02', to: '2026-01-01' },
    { from: '2025-01-01', to: '2026-01-02' }, { from: '2026-01-01', to: '2026-01-01', secret: 'x' }]) assert.equal(inspect(query).status, 400);
  const one = inspect({ from: '2026-01-01', to: '2026-01-01' });
  assert.equal(one.req.analyticsWindow.end.toISOString(), '2026-01-02T00:00:00.000Z');
  assert.equal(inspect({ from: '2024-01-01', to: '2024-12-31' }).passed, true);
});

test('API identity exposes only a valid commit and static capabilities', t => {
  const previous = process.env.RENDER_GIT_COMMIT;
  t.after(() => { if (previous === undefined) delete process.env.RENDER_GIT_COMMIT; else process.env.RENDER_GIT_COMMIT = previous; });
  process.env.RENDER_GIT_COMMIT = 'do-not-expose-arbitrary-environment-values';
  assert.equal(apiIdentity().revision, null);
  process.env.RENDER_GIT_COMMIT = 'a'.repeat(40);
  assert.equal(apiIdentity().revision, 'a'.repeat(40));
  assert.ok(apiIdentity().capabilities.includes('study-sets'));
});

test('analytics APIs deny privileged-role claims by Students/Moderators and apply the chosen period', async t => {
  const roles = { '507f1f77bcf86cd799439011': 'student', '507f1f77bcf86cd799439012': 'moderator', '507f1f77bcf86cd799439013': 'admin' };
  const previous = process.env.JWT_SECRET; process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const models = [User, Session, CreditTransaction, AssessmentAttempt, LearningUnlock, StudyAttempt];
  const originals = models.map(model => model.aggregate); const find = User.findById;
  const calls = [];
  User.findById = id => ({ select: () => ({ lean: async () => ({ _id: id, role: roles[id], emailVerified: true }) }) });
  models.forEach(model => { model.aggregate = pipeline => ({ option(options) {
    assert.equal(options.maxTimeMS, 8000); calls.push({ model: model.modelName, pipeline });
    const rows = model === Session ? [{ counts: [{ _id: 'completed', count: 2 }], trend: [] }]
      : model === CreditTransaction ? [{ rows: [{ _id: { type: 'session_payment' }, count: 1, amount: 20 }], trend: [] }]
        : model === AssessmentAttempt ? [{ _id: 'official', count: 3, passed: 1, averageScore: 40 }, { _id: 'practice', count: 2, passed: 2 }]
          : model === User ? [{ _id: 'student', count: 5, suspended: 1, unverified: 1 }] : [];
    return Promise.resolve(rows);
  } }); });
  const app = express(); app.use('/api/analytics', require('../routes/analyticsRoutes'));
  app.use('/api/admin', require('../routes/adminRoutes'));
  // Exercise the same Study Set mount order and fallback as the actual server.
  app.use('/api/study-sets', require('../routes/studyRoutes'));
  app.use('/api/moderator/study-sets', require('../routes/studyModerationRoutes'));
  app.use('/api', require('../middleware/apiErrors').apiNotFound);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); models.forEach((model, i) => { model.aggregate = originals[i]; }); User.findById = find; if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  const call = async (path, id) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { headers: id ? { authorization: `Bearer ${jwt.sign({ id, role: 'admin' }, process.env.JWT_SECRET)}` } : {} });
    return { status: response.status, body: await response.json() };
  };
  const [student, moderator, admin] = Object.keys(roles);
  assert.equal((await call('/api/analytics/learning')).status, 401);
  for (const id of [student, moderator]) for (const endpoint of ['sessions', 'credits', 'learning']) assert.equal((await call('/api/analytics/' + endpoint, id)).status, 403);
  assert.equal(calls.length, 0);
  const learning = await call('/api/analytics/learning?from=2026-10-01&to=2026-10-02', admin);
  assert.equal(learning.status, 200); assert.equal(learning.body.data.officialPassRate, 33.3);
  for (const entry of calls) {
    const match = entry.pipeline[0].$match;
    const date = match.submittedAt || match.unlockedAt;
    assert.equal(date.$gte.toISOString(), '2026-10-01T00:00:00.000Z');
    assert.equal(date.$lt.toISOString(), '2026-10-03T00:00:00.000Z');
  }
  const sessions = await call('/api/analytics/sessions', admin); assert.equal(sessions.body.data.total, 2);
  const credits = await call('/api/analytics/credits', admin); assert.equal(credits.body.data.tutoringPayments, 1);
  const overview = await call('/api/admin/overview', admin); assert.equal(overview.body.data.total, 5);
  assert.deepEqual(Object.keys(overview.body.data).sort(), ['moderators', 'students', 'suspended', 'total', 'unverified']);
  assert.equal((await call('/api/admin/overview', student)).status, 403);
  assert.equal((await call('/api/analytics/learning?from=2026-10-01', admin)).status, 400);
  for (const path of ['/api/study-sets', '/api/moderator/study-sets']) assert.equal((await call(path)).status, 401, 'Known route reaches auth instead of route-not-found');
  assert.equal((await call('/api/unknown')).body.message, 'API route not found');
});
