// Fixed, isolated loopback database; does not load dotenv or accept a remote URI.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const CreditTransaction = require('../models/CreditTransaction');
const Rating = require('../models/Rating');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const LearningUnlock = require('../models/LearningUnlock');
const StudyAttempt = require('../models/StudyAttempt');
const AuditLog = require('../models/AuditLog');

test('Phase B analytics against real isolated MongoDB records', { skip: process.env.ACADOVA_PHASEB_DB_TESTS !== '1' }, async t => {
  assert.notEqual(process.env.NODE_ENV, 'production');
  const database = `acadova_phaseb_analytics_${process.pid}`;
  await mongoose.connect(`mongodb://127.0.0.1:27029/${database}?replicaSet=acadovaPhase1`, { serverSelectionTimeoutMS: 10000 });
  assert.equal((await mongoose.connection.db.admin().command({ hello: 1 })).setName, 'acadovaPhase1');
  const previous = process.env.JWT_SECRET; process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const models = [User, Session, CreditTransaction, Rating, AssessmentAttempt, LearningUnlock, StudyAttempt, AuditLog];
  await Promise.all(models.map(model => model.init()));
  const [admin, student, moderator] = await User.create(['admin', 'student', 'moderator'].map(role => ({ name: `${role} Analytics Fixture`, email: `${role}@example.test`, role, password: randomBytes(16).toString('hex'), emailVerified: true })));
  await User.collection.insertMany([{ name: 'Historical Fixture', role: 'student', email: 'historical@example.test' }, { name: 'Unverified Fixture', role: 'student', email: 'unverified@example.test', emailVerified: false, suspendedAt: new Date() }]);
  const at = value => new Date(value + 'Z'); const oid = () => new mongoose.Types.ObjectId();
  const start = at('2026-10-01T00:00:00'); const end = at('2026-10-02T23:59:59.999');
  await Session.collection.insertMany([
    { subject: 'Java', status: 'completed', createdAt: start }, // Stored legacy completion with no payment.
    { subject: 'Java', status: 'awaiting_validation', createdAt: end },
    { subject: 'Python', status: 'scheduled', createdAt: at('2026-10-02T06:00:00') },
    { subject: 'Outside', status: 'completed', createdAt: at('2026-10-03T00:00:00') },
    { subject: 'Historical', status: 'completed' },
  ]);
  await CreditTransaction.collection.insertMany([
    { type: 'session_payment', session: oid(), amount: 20, createdAt: end },
    { type: 'assessment_reward', assessment: oid(), toUser: student._id, amount: 30, createdAt: start },
    { type: 'initial_grant', toUser: student._id, amount: 100, createdAt: start },
    { type: 'learning_unlock', fromUser: student._id, resource: oid(), amount: 25, createdAt: start },
    { type: 'admin_adjustment', adjustmentReference: 'local-phaseb-debit', adjustmentDirection: 'debit', amount: 5, createdAt: start },
    { type: 'session_payment', session: oid(), amount: 90, createdAt: at('2026-10-03T00:00:00') },
  ]);
  await AssessmentAttempt.collection.insertMany([
    { submittedAt: start, score: 90, passed: true }, // Missing historical mode remains official.
    { mode: 'official', submittedAt: end, score: 40, passed: false },
    { mode: 'practice', submittedAt: end, score: 100, passed: true },
    { mode: 'official', submittedAt: at('2026-10-03T00:00:00'), score: 100, passed: true },
  ]);
  await LearningUnlock.collection.insertMany([{ student: student._id, resource: oid(), unlockedAt: start }, { student: student._id, module: oid(), unlockedAt: end }]);
  await StudyAttempt.collection.insertMany([{ submittedAt: start }, { startedAt: start }, { submittedAt: at('2026-10-03T00:00:00') }]);
  await Rating.collection.insertMany([{ session: oid(), fromUser: student._id, rating: 4, createdAt: start }, { session: oid(), fromUser: student._id, rating: 5, isHidden: true, createdAt: end }, { session: oid(), fromUser: student._id, rating: 1, createdAt: at('2026-10-03T00:00:00') }]);
  await AuditLog.collection.insertMany([{ action: 'study.publication_decided', targetType: 'StudySet', targetId: oid(), summary: 'Synthetic study decision', createdAt: start }, { action: 'user.role_changed', targetType: 'User', targetId: student._id, summary: 'Synthetic role decision', createdAt: start }]);
  const app = express(); app.use('/api/analytics', require('../routes/analyticsRoutes')); app.use('/api/admin', require('../routes/adminRoutes'));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); assert.equal(mongoose.connection.db.databaseName, database); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  const call = async (path, actor = admin) => { const result = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { headers: { authorization: `Bearer ${jwt.sign({ id: String(actor._id), role: 'admin' }, process.env.JWT_SECRET)}` } }); return { status: result.status, body: await result.json() }; };
  const period = '?from=2026-10-01&to=2026-10-02';
  await t.test('date-filtered demand and trend include both UTC boundary days, exclude undated/outside records', async () => {
    const result = await call('/analytics/sessions' + period); assert.equal(result.status, 200); assert.equal(result.body.data.total, 3);
    assert.deepEqual(result.body.data.trend, [{ _id: '2026-10-01', count: 1 }, { _id: '2026-10-02', count: 2 }]);
    const subjects = await call('/analytics/subjects' + period); assert.deepEqual(subjects.body.data, [{ subject: 'Java', requestCount: 2 }, { subject: 'Python', requestCount: 1 }]);
    assert.equal((await call('/analytics/sessions')).body.data.total, 5);
    assert.equal((await call('/analytics/sessions?from=2026-10-01&to=2026-10-01')).body.data.total, 1);
  });
  await t.test('credits use ledger events once, not stored completion status or two participant sides', async () => {
    const result = await call('/analytics/credits' + period); assert.equal(result.body.data.tutoringPayments, 1); assert.equal(result.body.data.totalTransactions, 5);
    assert.deepEqual(result.body.data.breakdown, { sessionTransferred: 20, initialGranted: 100, assessmentAwarded: 30, learningSpent: 25, adminAdded: 0, adminRemoved: 5 });
    assert.equal(result.body.data.trend[0]._id, '2026-10-02'); assert.equal(result.body.data.trend[0].count, 1);
  });
  await t.test('official outcomes exclude practice; free quizzes and paid unlocks are separate', async () => {
    const result = await call('/analytics/learning' + period); assert.equal(result.status, 200);
    assert.deepEqual(result.body.data, { officialAttempts: 2, officialPassed: 1, officialPassRate: 50, averageOfficialScore: 65, practiceAttempts: 1, studyAttempts: 1, resourceUnlocks: 1, moduleUnlocks: 1, unlocks: 2 });
    const empty = await call('/analytics/learning?from=2025-01-01&to=2025-01-01'); assert.equal(empty.body.data.officialPassRate, null); assert.equal(empty.body.data.studyAttempts, 0);
  });
  await t.test('hidden/outside reviews are excluded and empty periods remain unrated', async () => {
    const result = await call('/analytics/ratings' + period); assert.equal(result.body.data.averageRating, 4); assert.equal(result.body.data.totalRatings, 1);
    assert.equal((await call('/analytics/ratings?from=2025-01-01&to=2025-01-01')).body.data.averageRating, null);
  });
  await t.test('summary preserves missing historical verification and reports aggregate counts only', async () => {
    const result = await call('/admin/overview'); assert.deepEqual(result.body.data, { total: 5, students: 3, moderators: 1, suspended: 1, unverified: 1 });
    assert.doesNotMatch(JSON.stringify(result.body), /@|password|email/i);
  });
  await t.test('categories filter audit records and reject mismatched actions', async () => {
    const result = await call('/admin/audit-logs?category=study'); assert.equal(result.body.pagination.total, 1); assert.equal(result.body.data[0].action, 'study.publication_decided');
    assert.equal((await call('/admin/audit-logs?category=study&action=user.role_changed')).status, 400);
  });
  await t.test('database roles overrule forged privilege claims for every aggregate', async () => {
    for (const actor of [student, moderator]) for (const name of ['sessions', 'subjects', 'credits', 'learning', 'ratings']) assert.equal((await call('/analytics/' + name + period, actor)).status, 403);
    assert.equal((await call('/admin/overview', student)).status, 403);
  });
  await t.test('large subject cardinality returns a bounded top 20, never raw Sessions', async () => {
    await Session.collection.insertMany(Array.from({ length: 25 }, (_, i) => ({ subject: `Bounded ${i}`, createdAt: start, status: 'pending' })));
    assert.equal((await call('/analytics/subjects' + period)).body.data.length, 20);
    assert.equal((await call('/analytics/subjects' + period)).body.data[0].subject, 'Java');
  });
});
