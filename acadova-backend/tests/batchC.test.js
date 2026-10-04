const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');
const { ACTIONS, recordLoginSecurityAudit } = require('../services/auditService');
const { validateBody, schemas } = require('../middleware/validation');

const ids = { student: '507f1f77bcf86cd799439011', moderator: '507f1f77bcf86cd799439012',
  admin: '507f1f77bcf86cd799439013' };

test('new-account policy and onboarding metadata are server-owned', () => {
  const inspect = (schema, body) => {
    let called = false;
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json() {} };
    validateBody(schema)({ body }, res, () => { called = true; });
    return { called, status: res.statusCode };
  };
  const base = { name: 'New Student', email: 'student@example.test', password: 'Password1!' };
  assert.equal(inspect(schemas.register, base).called, false);
  assert.equal(inspect(schemas.register, { ...base, policyAccepted: false }).status, 400);
  assert.equal(inspect(schemas.register, { ...base, policyAccepted: true }).called, true);
  assert.equal(inspect(schemas.profile, { onboardingFinishedAt: new Date().toISOString() }).status, 400);
  assert.equal(inspect(schemas.profile, { policyAcceptedAt: new Date().toISOString() }).status, 400);
  assert.ok(User.schema.path('onboardingFinishedAt'));
  assert.ok(User.schema.path('policyAcceptedAt'));
});

test('Moderator queue and Admin Security Center enforce roles; own onboarding is idempotent', async (t) => {
  const original = { findById: User.findById, findOneAndUpdate: User.findOneAndUpdate,
    findOne: User.findOne, count: User.countDocuments, sessionFind: Session.find,
    auditFind: AuditLog.find, auditCount: AuditLog.countDocuments,
    secret: process.env.JWT_SECRET };
  t.after(() => {
    Object.assign(User, { findById: original.findById, findOneAndUpdate: original.findOneAndUpdate,
      findOne: original.findOne, countDocuments: original.count });
    Session.find = original.sessionFind; AuditLog.find = original.auditFind;
    AuditLog.countDocuments = original.auditCount;
    if (original.secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original.secret;
  });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  User.findById = (id) => ({ select: () => ({ lean: async () => {
    const role = Object.keys(ids).find((key) => ids[key] === String(id));
    return role ? { _id: id, role, emailVerified: true, name: 'Test', credits: 0 } : null;
  } }) });
  let saved = false;
  User.findOneAndUpdate = (filter, update) => ({ select: async () => {
    assert.equal(String(filter._id), ids.student);
    assert.equal(filter.role, 'student');
    assert.deepEqual(Object.keys(update.$set), ['onboardingFinishedAt']);
    if (saved) return null;
    saved = true;
    return { _id: ids.student, role: 'student', onboardingFinishedAt: update.$set.onboardingFinishedAt };
  } });
  User.findOne = () => ({ select: async () => ({ _id: ids.student, role: 'student', onboardingFinishedAt: new Date() }) });
  User.countDocuments = async () => 2;
  const event = { _id: ids.admin, action: ACTIONS.loginCooldownStarted,
    targetType: 'User', targetId: ids.student, createdAt: new Date(),
    metadata: { password: 'must-not-leak' } };
  AuditLog.find = () => ({ select() { return this; }, sort() { return this; },
    limit() { return this; }, lean: async () => [event] });
  AuditLog.countDocuments = async () => 1;
  Session.find = () => ({ select() { return this; }, populate() { return this; },
    sort() { return this; }, limit() { return this; }, lean: async () => [] });
  const app = express(); app.use(express.json());
  app.use('/api/admin', require('../routes/adminRoutes'));
  app.use('/api/moderator', require('../routes/moderatorRoutes'));
  app.use('/api/users', require('../routes/userRoutes'));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  t.after(() => server.close());
  const call = async (role, path, method = 'GET') => {
    const result = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method, headers: { authorization: 'Bearer ' + jwt.sign({ id: ids[role], role }, process.env.JWT_SECRET),
        'content-type': 'application/json' }, ...(method === 'POST' ? { body: '{}' } : {}),
    });
    return { status: result.status, body: await result.json() };
  };
  assert.equal((await call('student', '/api/moderator/sessions/resolved')).status, 403);
  assert.equal((await call('student', '/api/admin/security')).status, 403);
  assert.equal((await call('moderator', '/api/admin/security')).status, 403);
  assert.equal((await call('moderator', '/api/moderator/sessions/resolved')).status, 200);
  const security = await call('admin', '/api/admin/security');
  assert.equal(security.status, 200);
  assert.equal(security.body.data.events[0].action, ACTIONS.loginCooldownStarted);
  assert.doesNotMatch(JSON.stringify(security.body), /must-not-leak|password|token/i);
  assert.equal((await call('admin', '/api/admin/security?account=bad')).status, 400);
  assert.equal((await call('moderator', '/api/users/me/onboarding', 'POST')).status, 403);
  assert.equal((await call('student', '/api/users/me/onboarding', 'POST')).status, 200);
  assert.equal((await call('student', '/api/users/me/onboarding', 'POST')).status, 200);
});

test('suspended-account security audit stores no credential fields', async (t) => {
  const original = AuditLog.create;
  t.after(() => { AuditLog.create = original; });
  let recorded;
  AuditLog.create = async ([entry]) => { recorded = entry; return [entry]; };
  await recordLoginSecurityAudit({ userId: ids.student,
    action: ACTIONS.suspendedLoginAttempt, failureCount: 0 });
  assert.deepEqual(recorded.metadata, {});
  assert.equal(recorded.actorRole, 'system');
  assert.equal(recorded.targetId, ids.student);
});
