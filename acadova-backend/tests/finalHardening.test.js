const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Session = require('../models/Session');
const Rating = require('../models/Rating');
const CreditConfig = require('../models/CreditConfig');
const AuditLog = require('../models/AuditLog');
const CreditTransaction = require('../models/CreditTransaction');
const notifications = require('../services/notificationService');
const sessions = require('../controllers/sessionController');
const users = require('../controllers/userController');
const admin = require('../controllers/adminController');
const { availableStudentFilter, isAvailableStudent } = require('../utils/peerEligibility');
const { configureProxyTrust } = require('../utils/proxyTrust');
const { createRateLimiter } = require('../middleware/rateLimiter');
const { publicReputation } = require('../utils/ratingReputation');
const { inFlightParticipantFilter } = require('../utils/sessionRoleGuard');
const learning = require('../controllers/learningController');
const LearningModule = require('../models/LearningModule');
const LearningResource = require('../models/LearningResource');
const LearningTopic = require('../models/LearningTopic');
const LearningUnlock = require('../models/LearningUnlock');
const learner = '507f1f77bcf86cd799439011';
const tutor = '507f1f77bcf86cd799439012';
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
function replace(t, object, key, value) { const old = object[key]; object[key] = value; t.after(() => { object[key] = old; }); }

test('peer eligibility excludes explicit false/suspension/staff and allows verified or historical Students', () => {
  for (const user of [{ role: 'student' }, { role: 'student', emailVerified: true, suspendedAt: null }]) assert.equal(isAvailableStudent(user), true);
  for (const user of [null, { role: 'admin' }, { role: 'moderator' }, { role: 'student', emailVerified: false }, { role: 'student', suspendedAt: new Date() }]) assert.equal(isAvailableStudent(user), false);
  assert.deepEqual(availableStudentFilter(), { role: 'student', suspendedAt: null, emailVerified: { $ne: false } });
});

test('new requests independently lock/check both eligible Students, reject unavailable peers/self/past, and store a future UTC instant', async (t) => {
  let peer = { role: 'student', emailVerified: true };
  const stored = []; const locks = [];
  replace(t, Session, 'find', () => ({ session() { return this; }, lean: async () => [] }));
  replace(t, CreditConfig, 'findById', () => ({ lean: async () => null }));
  replace(t, mongoose, 'startSession', async () => ({ withTransaction: async (fn) => fn(), endSession: async () => {} }));
  replace(t, User, 'findOneAndUpdate', (filter, update, options) => ({ select: async () => {
    assert.deepEqual({ role: filter.role, suspendedAt: filter.suspendedAt, emailVerified: filter.emailVerified }, availableStudentFilter());
    assert.ok(options.session); assert.deepEqual(update, { $currentDate: { updatedAt: true } });
    locks.push(filter._id);
    return filter._id === learner || isAvailableStudent(peer) ? { _id: filter._id } : null;
  } }));
  replace(t, Session, 'create', async ([data], options) => { assert.ok(options.session); stored.push(data); return [{ ...data, populate: async () => {} }]; });
  replace(t, notifications, 'notifySession', async () => {});
  const now = Date.now(); replace(t, Date, 'now', () => now);
  const request = (scheduledAt, tutorId = tutor) => ({ user: { id: learner, credits: 100 }, body: { tutorId, scheduledAt, subject: 'Java', meetingMethod: 'online', requestMessage: 'Help with arrays.' } });
  for (const time of [now - 1, now, now - 86400000]) {
    const res = response(); await sessions.createSession(request(new Date(time).toISOString()), res);
    assert.equal(res.statusCode, 400); assert.match(res.body.message, /future/);
  }
  assert.equal(locks.length, 0);
  for (const bad of [{ role: 'student', suspendedAt: new Date() }, { role: 'student', emailVerified: false }, { role: 'moderator' }, null]) {
    peer = bad; const res = response(); await sessions.createSession(request(new Date(now + 1).toISOString()), res);
    assert.equal(res.statusCode, 409); assert.equal(stored.length, 0);
  }
  peer = { role: 'student' }; const legacy = response();
  await sessions.createSession(request(new Date(now + 1).toISOString()), legacy); assert.equal(legacy.statusCode, 201);
  peer.emailVerified = true; const valid = response();
  const offset = new Date(now + 86400000).toISOString().replace('Z', '+00:00');
  await sessions.createSession(request(offset), valid); assert.equal(valid.statusCode, 201);
  assert.equal(stored.at(-1).scheduledAt.toISOString(), new Date(now + 86400000).toISOString());
  const self = response(); await sessions.createSession(request(offset, learner.toUpperCase()), self);
  assert.equal(self.statusCode, 400); assert.match(self.body.message, /yourself/); assert.equal(stored.length, 2);
});

test('proxy trust rejects unsafe config; direct requests ignore forwarding, trusted chains separate clients and stop at the first untrusted hop', async (t) => {
  for (const value of ['true', '1', '*', 'loopback', '0.0.0.0/0', '::/0', '127.0.0.1/33', '127.0.0.1,', '::1/129', '127.0.0.1/not-a-prefix']) {
    assert.throws(() => configureProxyTrust(express(), value), /TRUST_PROXY_CIDRS/);
  }
  async function start(trust) {
    const app = express(); configureProxyTrust(app, trust);
    app.use(createRateLimiter({ windowMs: 60000, max: 2 })); app.get('/', (req, res) => res.json({ ip: req.ip }));
    const server = await new Promise((resolve) => { const started = app.listen(0, '127.0.0.1', () => resolve(started)); });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    return (forwarded) => fetch(`http://127.0.0.1:${server.address().port}/`, { headers: { 'X-Forwarded-For': forwarded } });
  }
  const direct = await start(''); assert.equal((await (await direct('198.51.100.1')).json()).ip, '127.0.0.1');
  assert.equal((await direct('198.51.100.2')).status, 200); assert.equal((await direct('198.51.100.3')).status, 429);
  const trusted = await start('127.0.0.1/32,::1/128');
  assert.equal((await (await trusted('198.51.100.1')).json()).ip, '198.51.100.1');
  assert.equal((await trusted('198.51.100.2')).status, 200);
  assert.equal((await (await trusted('203.0.113.99,198.51.100.1')).json()).ip, '198.51.100.1');
  assert.equal((await trusted('203.0.113.98,198.51.100.1')).status, 429);
});

test('promotion guards both participant sides and in-flight/legacy states before any role or audit write; terminal history allows promotion', async (t) => {
  let history = null; let writes = 0; let audits = 0; let locked = false;
  let ledger = [];
  replace(t, mongoose, 'startSession', async () => ({ withTransaction: async (fn) => fn(), endSession: async () => {} }));
  replace(t, User, 'findById', () => ({ select() { return this; }, session() { return this; }, lean: async () => ({ _id: tutor, role: 'student' }) }));
  replace(t, User, 'updateOne', async () => { locked = true; return { matchedCount: 1 }; });
  replace(t, Session, 'exists', (filter) => ({ session: async () => {
    assert.ok(locked); assert.deepEqual(filter, inFlightParticipantFilter(tutor));
    if (!history || ![history.learner, history.tutor].includes(tutor)) return null;
    return filter.$and[1].status.$in.includes(history.status) ? { _id: 'active' } : null;
  } }));
  replace(t, Session, 'find', (filter) => ({ select() { return this; }, session(value) { assert.ok(value); return this; }, lean: async () => {
    assert.deepEqual(filter.$and[0], { $or: [{ learner: tutor }, { tutor }] });
    assert.deepEqual(filter.$and[1], { status: 'completed', confirmedAt: null });
    return history?.status === 'completed' && history.confirmedAt == null ? [history] : [];
  } }));
  replace(t, CreditTransaction, 'find', () => ({ select() { return this; }, session(value) { assert.ok(value); return this; }, lean: async () => ledger }));
  replace(t, User, 'findOneAndUpdate', () => ({ select: async () => { writes++; return { role: 'moderator' }; } }));
  replace(t, AuditLog, 'create', async ([entry]) => { audits++; return [entry]; });
  const req = { params: { id: tutor }, body: { role: 'moderator' }, user: { id: learner, role: 'admin' } };
  for (const side of ['learner', 'tutor']) for (const status of ['pending', 'accepted', 'scheduled', 'in_progress', 'awaiting_validation', 'no_show', 'disputed', 'completed']) {
    history = { [side]: tutor, status }; const res = response(); await admin.updateUserRole(req, res);
    assert.equal(res.statusCode, 409, `${side}/${status}`); assert.match(res.body.message, /completed, cancelled, or resolved/);
    assert.equal(writes, 0); assert.equal(audits, 0);
  }
  for (const status of ['declined', 'rejected', 'cancelled', 'resolved', 'completed']) {
    history = { learner: tutor, status, confirmedAt: new Date() }; const res = response();
    await admin.updateUserRole(req, res); assert.equal(res.statusCode, 200, status);
  }
  assert.equal(writes, 5); assert.equal(audits, 5);
  // A historical payment can establish terminal completion before newer flags.
  history = { _id: learner, learner: tutor, tutor: learner, status: 'completed', creditAmount: 20 };
  ledger = [{ session: learner, fromUser: tutor, toUser: learner, amount: 20, type: 'session_payment' }];
  const settled = response(); await admin.updateUserRole(req, settled);
  assert.equal(settled.statusCode, 200); assert.equal(writes, 6); assert.equal(audits, 6);
  // Wrong amount or duplicate historical evidence is not safe terminal truth.
  for (const bad of [[{ ...ledger[0], amount: 10 }], [ledger[0], ledger[0]]]) {
    ledger = bad; const res = response(); await admin.updateUserRole(req, res);
    assert.equal(res.statusCode, 409); assert.equal(writes, 6); assert.equal(audits, 6);
  }
});

test('public reputation ignores cached five-star defaults and follows visible review counts through hide/restore', async (t) => {
  let rows = [];
  replace(t, Rating, 'aggregate', (pipeline) => {
    assert.equal(String(pipeline[0].$match.toUser), tutor); assert.deepEqual(pipeline[0].$match.isHidden, { $ne: true });
    assert.deepEqual(pipeline[1].$group.count, { $sum: 1 });
    const visible = rows.filter((row) => row.isHidden !== true);
    return Promise.resolve(visible.length ? [{ average: visible.reduce((n, row) => n + row.rating, 0) / visible.length, count: visible.length }] : []);
  });
  assert.deepEqual(await publicReputation(tutor), { rating: null, ratingCount: 0 });
  rows = [{ rating: 4 }]; assert.deepEqual(await publicReputation(tutor), { rating: 4, ratingCount: 1 });
  rows.push({ rating: 2, isHidden: false }); assert.deepEqual(await publicReputation(tutor), { rating: 3, ratingCount: 2 });
  rows[1].isHidden = true; rows[0].isHidden = true; assert.deepEqual(await publicReputation(tutor), { rating: null, ratingCount: 0 });
  rows[0].isHidden = false; assert.deepEqual(await publicReputation(tutor), { rating: 4, ratingCount: 1 });
  replace(t, User, 'findOne', (filter) => ({ select: async () => { assert.deepEqual(filter, { _id: tutor, ...availableStudentFilter() }); return { _id: tutor, role: 'student', rating: 5 }; } }));
  const profile = response(); await users.getUserById({ params: { id: tutor } }, profile);
  assert.equal(profile.body.data.rating, 4); assert.equal(profile.body.data.ratingCount, 1);
  replace(t, User, 'aggregate', async (pipeline) => {
    assert.deepEqual(pipeline[0].$match.emailVerified, { $ne: false }); assert.equal(pipeline[0].$match.suspendedAt, null);
    assert.equal(String(pipeline[0].$match._id.$ne), learner);
    assert.equal(pipeline[1].$lookup.from, Rating.collection.name);
    assert.deepEqual(pipeline[1].$lookup.pipeline[0].$match.isHidden, { $ne: true });
    assert.ok(pipeline.findIndex((row) => row.$set) < pipeline.findIndex((row) => row.$sort));
    assert.deepEqual(pipeline.at(-3), { $sort: { rating: -1, ratingCount: -1, _id: 1 } });
    assert.deepEqual(pipeline.at(-2), { $limit: 50 });
    assert.deepEqual(Object.keys(pipeline.at(-1).$project).sort(), ['name', 'rating', 'ratingCount', 'role', 'skillsToTeach']);
    return [{ _id: tutor, rating: null, ratingCount: 0 }];
  });
  const discovery = response(); await users.searchTutors({ user: { id: learner }, validatedQuery: { subject: 'Java' } }, discovery);
  assert.equal(discovery.statusCode, 200); assert.equal(discovery.body.data[0].ratingCount, 0);
});

test('accessible modules report missing published resources without exposing archived bodies or modifying entitlements', async (t) => {
  replace(t, LearningUnlock, 'find', () => ({ select() { return this; }, lean: async () => [] }));
  replace(t, LearningModule, 'findOne', () => ({ lean: async () => ({ _id: tutor, topic: learner, title: 'Module', creditCost: 0, resources: [learner, tutor] }) }));
  replace(t, LearningTopic, 'exists', async () => true);
  replace(t, LearningUnlock, 'exists', async () => null);
  replace(t, LearningResource, 'find', (filter) => ({ lean: async () => {
    assert.equal(filter.reviewStatus, 'published'); return [{ _id: learner, title: 'Available lesson', resourceType: 'text', textContent: 'Public material', creditCost: 0 }];
  } }));
  const res = response(); await learning.getModule({ params: { id: tutor }, user: { id: learner } }, res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.data.unavailableResourceCount, 1);
  assert.equal(res.body.data.resources.length, 1); assert.equal(res.body.data.resources[0].title, 'Available lesson');
});
