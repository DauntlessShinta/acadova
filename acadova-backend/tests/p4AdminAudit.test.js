const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Rating = require('../models/Rating');
const moderator = require('../controllers/moderatorController');
const { recordAudit, ACTIONS } = require('../services/auditService');
const admin = require('../controllers/adminController');
const audit = require('../controllers/adminAuditController');
const { authenticateToken } = require('../middleware/authMiddleware');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const auth = require('../controllers/authController');

const adminId = '507f1f77bcf86cd799439011';
const studentId = '507f1f77bcf86cd799439012';
const response = () => ({ statusCode: 200, status(value) { this.statusCode = value; return this; },
  json(value) { this.body = value; return this; } });

test('audit writer persists only whitelisted metadata and rejects unauthenticated actors', async () => {
  const original = AuditLog.create;
  const writes = [];
  AuditLog.create = async ([value]) => { writes.push(value); return [value]; };
  try {
    await recordAudit({ actor: { id: adminId, role: 'admin' }, action: ACTIONS.suspended,
      targetType: 'User', targetId: studentId, summary: 'Account suspended',
      metadata: { newStatus: 'suspended', password: 'secret', token: 'secret', nested: { secret: true } } });
    assert.deepEqual(writes[0].metadata, { newStatus: 'suspended' });
    assert.equal(JSON.stringify(writes).includes('secret'), false);
    await assert.rejects(recordAudit({ actor: { id: studentId, role: 'student' }, action: ACTIONS.suspended,
      targetType: 'User', targetId: studentId, summary: 'Invalid' }));
  } finally { AuditLog.create = original; }
});

test('Admin role and status changes are stale-safe, audited, and preserve account data', async () => {
  const original = { start: mongoose.startSession, findById: User.findById,
    update: User.findOneAndUpdate, auditCreate: AuditLog.create };
  const user = { _id: studentId, name: 'Student', email: 'student@example.test', role: 'student',
    credits: 88, emailVerified: true, suspendedAt: null, sessions: ['historical-session'] };
  const logs = [];
  mongoose.startSession = async () => ({ async withTransaction(callback) {
    const before = { ...user }; const count = logs.length;
    try { await callback(); } catch (error) { Object.assign(user, before); logs.length = count; throw error; }
  }, async endSession() {} });
  User.findById = () => ({ select() { return this; }, session() { return this; }, lean: async () => ({ ...user }) });
  User.findOneAndUpdate = (filter, update) => ({ select: async () => {
    if (filter.role !== user.role || (filter.suspendedAt !== undefined
      && String(filter.suspendedAt) !== String(user.suspendedAt))) return null;
    Object.assign(user, update.$set); return { ...user };
  } });
  AuditLog.create = async ([entry]) => { logs.push(entry); return [entry]; };
  const request = (body, id = studentId) => ({ params: { id }, body,
    user: { id: adminId, role: 'admin' }, originalUrl: '/api/admin/users/:id' });
  try {
    const grant = response(); await admin.updateUserRole(request({ role: 'moderator' }), grant);
    assert.equal(grant.statusCode, 200);
    assert.equal(user.role, 'moderator'); assert.equal(user.credits, 88);
    assert.deepEqual(user.sessions, ['historical-session']);
    assert.equal(logs[0].action, ACTIONS.role);
    const repeat = response(); await admin.updateUserRole(request({ role: 'moderator' }), repeat);
    assert.equal(repeat.statusCode, 409); assert.equal(logs.length, 1);
    const revoke = response(); await admin.updateUserRole(request({ role: 'student' }), revoke);
    assert.equal(revoke.statusCode, 200); assert.equal(logs[1].metadata.newRole, 'student');
    const suspend = response(); await admin.updateUserStatus(request({ status: 'suspended',
      reason: 'Repeated verified abuse' }), suspend);
    assert.equal(suspend.statusCode, 200); assert.ok(user.suspendedAt);
    assert.equal(logs[2].action, ACTIONS.suspended);
    assert.equal(JSON.stringify(logs).includes('Repeated verified abuse'), false);
    const self = response(); await admin.updateUserStatus(request({ status: 'suspended',
      reason: 'Repeated verified abuse' }, adminId), self);
    assert.equal(self.statusCode, 400);
    const reactivate = response(); await admin.updateUserStatus(request({ status: 'active' }), reactivate);
    assert.equal(reactivate.statusCode, 200); assert.equal(user.suspendedAt, null);
    assert.equal(logs[3].action, ACTIONS.reactivated);
    assert.equal(user.credits, 88); assert.deepEqual(user.sessions, ['historical-session']);
    AuditLog.create = async () => { throw new Error('Audit unavailable'); };
    const failed = response(); await admin.updateUserRole(request({ role: 'moderator' }), failed);
    assert.equal(failed.statusCode, 503); assert.equal(user.role, 'student');
  } finally {
    mongoose.startSession = original.start; User.findById = original.findById;
    User.findOneAndUpdate = original.update; AuditLog.create = original.auditCreate;
  }
});

test('suspended account cannot obtain a fresh login token', async () => {
  const oldFind = User.findOne;
  User.findOne = () => ({ select() { return this; }, lean: async () => ({ _id: studentId, role: 'student',
    password: bcrypt.hashSync('correct-password', 4), emailVerified: true, suspendedAt: new Date() }) });
  try {
    const res = response(); await auth.login({ body: { email: 'student@example.test',
      password: 'correct-password' } }, res);
    assert.equal(res.statusCode, 403); assert.equal(res.body.code, 'ACCOUNT_SUSPENDED');
    assert.equal(res.body.data?.token, undefined);
  } finally { User.findOne = oldFind; }
});

test('suspension blocks an already-issued JWT on the next protected request', async () => {
  const oldFind = User.findById; const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'p4-test-secret';
  User.findById = () => ({ select: () => ({ lean: async () => ({ _id: studentId, role: 'student',
    emailVerified: true, suspendedAt: new Date() }) }) });
  try {
    const res = response(); let proceeded = false;
    await authenticateToken({ headers: { authorization: `Bearer ${jwt.sign({ id: studentId }, process.env.JWT_SECRET)}` } },
      res, () => { proceeded = true; });
    assert.equal(res.statusCode, 403); assert.equal(res.body.code, 'ACCOUNT_SUSPENDED');
    assert.equal(proceeded, false);
  } finally { User.findById = oldFind; process.env.JWT_SECRET = oldSecret; }
});

test('Admin audit listing bounds pages, filters and sorts newest first', async () => {
  const originalCount = AuditLog.countDocuments; const originalFind = AuditLog.find;
  let captured;
  AuditLog.countDocuments = async (filter) => { captured = filter; return 2; };
  AuditLog.find = () => ({ select() { return this; }, sort(value) { this.order = value; return this; },
    skip(value) { this.offset = value; return this; }, limit(value) { this.pageSize = value; return this; },
    populate() { return this; }, lean: async function () { assert.deepEqual(this.order, { createdAt: -1, _id: -1 });
      assert.equal(this.offset, 1); assert.equal(this.pageSize, 1); return [{ action: ACTIONS.role }]; } });
  try {
    const res = response(); await audit.listAuditLogs({ query: { page: '2', limit: '1',
      action: ACTIONS.role, actor: adminId, targetType: 'User' } }, res);
    assert.equal(res.statusCode, 200); assert.deepEqual(captured,
      { action: ACTIONS.role, actor: adminId, targetType: 'User' });
    assert.equal(res.body.pagination.total, 2);
    const invalid = response(); await audit.listAuditLogs({ query: { limit: '1000' } }, invalid);
    assert.equal(invalid.statusCode, 400);
  } finally { AuditLog.countDocuments = originalCount; AuditLog.find = originalFind; }
});

test('review hide/restore preserves evidence and writes transactional audit records', async () => {
  const old = { start: mongoose.startSession, find: Rating.findById, update: Rating.findOneAndUpdate,
    aggregate: Rating.aggregate, userUpdate: User.findByIdAndUpdate, auditCreate: AuditLog.create };
  const reviewId = '507f1f77bcf86cd799439013';
  const review = { _id: reviewId, toUser: studentId, fromUser: adminId, rating: 4,
    comment: 'Original evidence', isHidden: false };
  const entries = [];
  mongoose.startSession = async () => ({ async withTransaction(callback) { await callback(); }, async endSession() {} });
  Rating.findById = () => ({ session() { return this; }, lean: async () => ({ ...review }),
    populate() { return this; }, then(resolve) { resolve({ ...review }); } });
  Rating.findOneAndUpdate = async (filter, update) => {
    if (filter.isHidden === true && review.isHidden !== true) return null;
    if (filter.isHidden?.$ne === true && review.isHidden === true) return null;
    Object.assign(review, update.$set); return { ...review };
  };
  Rating.aggregate = () => ({ session: async () => [{ average: 4 }] });
  User.findByIdAndUpdate = async () => ({});
  AuditLog.create = async ([entry]) => { entries.push(entry); return [entry]; };
  try {
    const request = (hidden) => ({ params: { id: reviewId }, body: { hidden },
      user: { id: adminId, role: 'moderator' }, originalUrl: '/api/moderator/ratings' });
    const hide = response(); await moderator.updateRatingVisibility(request(true), hide);
    assert.equal(hide.statusCode, 200); assert.equal(review.isHidden, true);
    assert.equal(review.comment, 'Original evidence'); assert.equal(entries[0].action, ACTIONS.review);
    const duplicate = response(); await moderator.updateRatingVisibility(request(true), duplicate);
    assert.equal(duplicate.statusCode, 409); assert.equal(entries.length, 1);
    const restore = response(); await moderator.updateRatingVisibility(request(false), restore);
    assert.equal(restore.statusCode, 200); assert.equal(review.isHidden, false);
    assert.equal(entries.length, 2);
  } finally {
    mongoose.startSession = old.start; Rating.findById = old.find; Rating.findOneAndUpdate = old.update;
    Rating.aggregate = old.aggregate; User.findByIdAndUpdate = old.userUpdate; AuditLog.create = old.auditCreate;
  }
});
