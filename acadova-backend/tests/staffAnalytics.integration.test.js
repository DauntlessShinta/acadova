// Owned loopback replica only. Never loads dotenv or accepts an external database URI.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');
const LearningResource = require('../models/LearningResource');
const StudySet = require('../models/StudySet');
const StudyReport = require('../models/StudyReport');
const StudyCircle = require('../models/StudyCircle');
const CreditTransaction = require('../models/CreditTransaction');
const { ACTIONS } = require('../services/auditService');
test('staff dashboard aggregates use actual isolated records and database roles', { skip: process.env.ACADOVA_STAFF_ANALYTICS_DB_TESTS !== '1' }, async t => {
  assert.equal(process.env.NODE_ENV, 'test');
  const database = 'acadova_staff_analytics_' + randomBytes(12).toString('hex');
  await mongoose.connect(`mongodb://127.0.0.1:27029/${database}?replicaSet=acadovaPhase1`, { serverSelectionTimeoutMS: 10000 });
  assert.equal(mongoose.connection.host, '127.0.0.1');
  assert.equal((await mongoose.connection.db.admin().command({ hello: 1 })).setName, 'acadovaPhase1');
  const oldSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = randomBytes(32).toString('hex');
  let server;
  t.after(async () => { if (server) await new Promise(resolve => server.close(resolve)); assert.equal(mongoose.connection.name, database); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret; });
  await Promise.all([User, Session, AuditLog, LearningResource, StudySet, StudyReport, StudyCircle, CreditTransaction].map(model => model.init()));
  const [admin, moderator, student] = await User.create(['admin', 'moderator', 'student'].map(role => ({ name: 'Synthetic ' + role, email: role + '@example.test', role, password: randomBytes(16).toString('hex'), emailVerified: true, credits: 100 })));
  const oid = () => new mongoose.Types.ObjectId(), ago = days => new Date(Date.now() - days * 86400000);
  const first = new Date('2026-10-01T00:00:00Z'), last = new Date('2026-10-02T23:59:59.999Z');
  await LearningResource.collection.insertMany([{ reviewStatus: 'submitted', title: 'PRIVATE_RESOURCE', createdAt: ago(1) }, { reviewStatus: 'submitted', createdAt: ago(3) }, { reviewStatus: 'published', createdAt: ago(1) }]);
  await StudySet.collection.insertMany([{ state: 'pending', deletedAt: null, submittedAt: ago(7), title: 'PRIVATE_STUDY', questions: [{ prompt: 'PRIVATE_QUESTION' }] }, { state: 'pending', deletedAt: new Date() }, { state: 'private', owner: student._id }]);
  await StudyReport.collection.insertMany([{ studySet: oid(), reporter: student._id, state: 'open', createdAt: first, reason: 'PRIVATE_REPORT' }, { studySet: oid(), reporter: student._id, state: 'closed', createdAt: last }, { studySet: oid(), reporter: student._id, state: 'closed', createdAt: new Date('2026-10-03T00:00:00Z') }]);
  await Session.collection.insertMany([{ status: 'disputed', createdAt: ago(9) }, { status: 'awaiting_validation', reviewReferral: { id: oid(), createdAt: ago(1), closedAt: null } }, { status: 'awaiting_validation', createdAt: ago(1) }, { status: 'completed', createdAt: ago(1) }]);
  await StudyCircle.collection.insertMany([{ title: 'PRIVATE_CIRCLE', meetingUrl: 'https://meet.google.com/private', reports: [{ reporter: student._id, open: true, at: ago(10), reason: 'PRIVATE_REASON' }, { open: false, at: ago(20) }] }, { reports: [{ open: false, at: ago(10) }] }]);
  const event = (action, at, metadata = {}, actorRole = 'moderator') => ({ action, createdAt: at, actor: moderator._id, actorRole, targetType: 'LearningResource', targetId: String(oid()), summary: 'Synthetic recorded action', metadata: { ...metadata, reason: 'PRIVATE_AUDIT_REASON', token: 'PRIVATE_TOKEN' } });
  await AuditLog.collection.insertMany([
    event(ACTIONS.resourcePublished, first), event(ACTIONS.resourceRejected, last), event(ACTIONS.studyDecision, last, { newStatus: 'published' }),
    event(ACTIONS.resourceArchived, last), event(ACTIONS.circleReview, last), event(ACTIONS.resourcePublished, new Date('2026-10-03T00:00:00Z')),
    event(ACTIONS.resourcePublished, first, {}, 'system'), event(ACTIONS.role, first), event(ACTIONS.loginCooldownStarted, first, {}, 'system'),
  ]);
  await User.collection.insertMany([{ name: 'PRIVATE_SIGNUP', email: 'private@example.test', role: 'student', createdAt: first }, { email: 'synthetic-last@example.test', role: 'student', createdAt: last }, { email: 'synthetic-outside@example.test', role: 'student', createdAt: new Date('2026-10-03T00:00:00Z') }]);
  const app = express(); app.use('/api/moderator', require('../routes/moderatorRoutes')); app.use('/api/admin', require('../routes/adminRoutes'));
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const call = async (path, actor = moderator) => { const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { headers: actor ? { authorization: 'Bearer ' + jwt.sign({ id: String(actor._id), role: 'admin' }, process.env.JWT_SECRET) } : {} }); return { status: response.status, body: await response.json() }; };
  const range = '?from=2026-10-01&to=2026-10-02';
  await t.test('moderator analytics separates current queues, dated events and explicit outcomes', async () => {
    const { status, body } = await call('/moderator/analytics' + range); assert.equal(status, 200); const data = body.data;
    assert.equal(data.pendingQueue, 7); assert.equal(data.reviewDecisions, 5); assert.equal(data.approvalRate, 66.7); assert.equal(data.reportsCreated, 2); assert.equal(data.sessionIssues, 2);
    assert.deepEqual(data.queue.map(row => row.value), [2, 1, 1, 2, 1]); assert.deepEqual(data.outcomes.map(row => row.value), [2, 1, 2]);
    assert.equal(data.trend.reduce((sum, row) => sum + row.count, 0), 5); assert.equal(data.from, '2026-10-01'); assert.equal(data.to, '2026-10-02');
    assert.equal(data.aging.reduce((sum, row) => sum + row.value, 0), 7);
    assert.doesNotMatch(JSON.stringify(body), /PRIVATE_|@|meetingUrl|reporter|actor|student|targetId|questions|reason/i);
  });
  await t.test('empty period means no decisions, not zero-percent fabricated performance', async () => {
    const { body } = await call('/moderator/analytics?from=2020-01-01&to=2020-01-02');
    assert.equal(body.data.approvalRate, null); assert.equal(body.data.reviewDecisions, 0); assert.equal(body.data.pendingQueue, 7);
  });
  await t.test('missing submission dates remain an explicit unknown age', async () => {
    await LearningResource.collection.insertOne({ reviewStatus: 'submitted' });
    const { body } = await call('/moderator/analytics' + range); assert.equal(body.data.aging.find(row => row.label === 'unknown').value, 1);
  });
  await t.test('admin dashboard dates count real registrations and curated staff activity only', async () => {
    const { status, body } = await call('/admin/dashboard' + range, admin); assert.equal(status, 200);
    assert.deepEqual(body.data.signups, [{ _id: '2026-10-01', count: 1 }, { _id: '2026-10-02', count: 1 }]);
    assert.equal(body.data.moderation.reduce((sum, row) => sum + row.count, 0), 5); assert.ok(body.data.recent.length <= 5);
    assert.doesNotMatch(JSON.stringify(body), /PRIVATE_|metadata|@|password|email|token/i);
  });
  await t.test('custom moderator Overview dates preserve its original role and queue contract', async () => {
    const { status, body } = await call('/moderator/overview' + range); assert.equal(status, 200); assert.equal(body.data.from, '2026-10-01'); assert.equal(body.data.to, '2026-10-02'); assert.equal(body.data.counts.pendingReviews, 4);
    assert.equal((await call('/moderator/overview?days=7')).status, 200);
  });
  await t.test('database roles override forged token claims; Admin stays Admin-only', async () => {
    assert.equal((await call('/moderator/analytics' + range, student)).status, 403); assert.equal((await call('/moderator/analytics' + range, null)).status, 401);
    assert.equal((await call('/moderator/analytics' + range, admin)).status, 200); assert.equal((await call('/admin/dashboard' + range, moderator)).status, 403); assert.equal((await call('/admin/dashboard' + range, student)).status, 403);
  });
  await t.test('invalid, oversized, partial and unrelated query values are rejected server-side', async () => {
    for (const suffix of ['?from=2026-02-29&to=2026-03-01', '?from=2026-10-02&to=2026-10-01', '?from=2024-01-01&to=2026-01-01', '?from=2026-10-01', range + '&studentId=' + student._id]) assert.equal((await call('/moderator/analytics' + suffix)).status, 400);
  });
  await t.test('Decisions Today stays on the actual UTC day when a past activity range is selected', async () => {
    await AuditLog.collection.insertOne(event(ACTIONS.resourcePublished, new Date()));
    const { body } = await call('/moderator/overview' + range);
    assert.equal(body.data.counts.decisionsToday, 1);
    assert.equal(body.data.trend.decisions.reduce((sum, row) => sum + row.reviews + row.sessions, 0), 5);
  });
  await t.test('read-only analytics never changes balances, credit history or audit records', async () => {
    assert.equal((await User.findById(student._id)).credits, 100); assert.equal(await CreditTransaction.countDocuments(), 0); assert.equal(await AuditLog.countDocuments(), 10);
  });
});
