// Dedicated loopback test database; no dotenv, provider or production URI.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Session = require('../models/Session');
const LearningResource = require('../models/LearningResource');
const StudySet = require('../models/StudySet');
const StudyReport = require('../models/StudyReport');
const CreditTransaction = require('../models/CreditTransaction');
const { validationErrorHandler } = require('../middleware/validation');

test('B.3 real read-only dashboard and audit queries in isolated MongoDB', { skip: process.env.ACADOVA_PHASEB3_DB_TESTS !== '1' }, async t => {
  assert.notEqual(process.env.NODE_ENV, 'production');
  const database = `acadova_phaseb3_${process.pid}`;
  await mongoose.connect(`mongodb://127.0.0.1:27029/${database}?replicaSet=acadovaPhase1`, { serverSelectionTimeoutMS: 10000 });
  assert.equal((await mongoose.connection.db.admin().command({ hello: 1 })).setName, 'acadovaPhase1');
  const previous = process.env.JWT_SECRET; process.env.JWT_SECRET = randomBytes(32).toString('hex'); let server;
  t.after(async () => { if (server) await new Promise(resolve => server.close(resolve)); assert.equal(mongoose.connection.db.databaseName, database); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  const models = [User, AuditLog, Session, LearningResource, StudySet, StudyReport, CreditTransaction]; await Promise.all(models.map(model => model.init()));
  const [admin, moderator, student] = await User.create(['admin', 'moderator', 'student'].map(role => ({ name: role === 'moderator' ? 'Maria Moderator' : `${role} Dashboard Fixture`, email: `${role}@example.test`, password: randomBytes(16).toString('hex'), role, emailVerified: true, credits: 100 })));
  await User.updateOne({ _id: student._id }, { loginCooldownUntil: new Date(Date.now() + 300000) });
  const oid = () => new mongoose.Types.ObjectId(); const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const earlier = new Date(today.getTime() - 3600000); const now = new Date(Date.now() - 1000);
  const pending = oid(); const published = oid();
  await StudySet.collection.insertMany([{ _id: pending, owner: student._id, state: 'pending', deletedAt: null, title: 'Pending arrays', submittedAt: earlier, questions: [{ prompt: 'PRIVATE_QUESTION' }] }, { _id: published, owner: student._id, state: 'published', deletedAt: null, title: 'Reported arrays' }, { owner: student._id, state: 'pending', deletedAt: now }]);
  await LearningResource.collection.insertMany([{ title: 'Resource one', reviewStatus: 'submitted', createdAt: earlier }, { title: 'Resource two', reviewStatus: 'submitted', createdAt: now }, { title: 'Published resource', reviewStatus: 'published', createdAt: now }]);
  await StudyReport.collection.insertMany([{ studySet: published, reporter: student._id, state: 'open', createdAt: earlier, reason: 'PRIVATE_REPORT' }, { studySet: published, reporter: admin._id, state: 'open', createdAt: now }, { studySet: published, reporter: moderator._id, state: 'closed', createdAt: now }]);
  await Session.collection.insertMany([{ subject: 'Explicit dispute', status: 'disputed', disputedAt: earlier, privateEvidence: 'PRIVATE_EVIDENCE' }, { subject: 'Explicit referral', status: 'awaiting_validation', reviewReferral: { id: 'referral', createdAt: now, closedAt: null } }, { subject: 'Normal confirmation', status: 'awaiting_validation', createdAt: now }, { subject: 'Closed referral', status: 'awaiting_validation', reviewReferral: { id: 'closed', createdAt: now, closedAt: now } }]);
  const events = [
    { actor: moderator._id, actorRole: 'moderator', action: 'study.publication_decided', targetType: 'StudySet', targetId: String(pending), summary: 'Study set published', metadata: { newStatus: 'published', reason: 'AUTHORIZED_ADMIN_REASON', reference: 'synthetic-reference', creditCost: 50, token: 'PRIVATE_TOKEN' } },
    { actor: moderator._id, actorRole: 'moderator', action: 'learning.resource_approved', targetType: 'LearningResource', targetId: String(oid()), summary: 'Resource approved' },
    { actor: moderator._id, actorRole: 'moderator', action: 'session.dispute_resolved', targetType: 'Session', targetId: String(oid()), summary: 'Session resolved', metadata: { resolution: 'cancel_session', reason: 'PRIVATE_DECISION_REASON' } },
    { actor: admin._id, actorRole: 'admin', action: 'user.role_changed', targetType: 'User', targetId: String(student._id), summary: 'Role changed' },
    { actor: admin._id, actorRole: 'admin', action: 'credit.admin_adjustment', targetType: 'CreditTransaction', targetId: String(oid()), summary: 'Credit adjustment' },
    { actorRole: 'system', action: 'security.login_cooldown_started', targetType: 'User', targetId: String(student._id), summary: 'Account cooldown started' },
  ];
  await AuditLog.collection.insertMany(events.map(event => ({ ...event, createdAt: now })));
  await AuditLog.collection.insertOne({ actor: moderator._id, actorRole: 'moderator', action: 'study.report_closed', targetType: 'StudyReport', targetId: String(oid()), summary: 'Older decision', createdAt: new Date(today.getTime() - 8 * 86400000) });
  const app = express();
  app.use(require('cors')({ origin: (origin, callback) => callback(null, !origin || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) }));
  app.use(express.json());
  app.use('/api/admin', require('../routes/adminRoutes')); app.use('/api/moderator', require('../routes/moderatorRoutes'));
  app.use('/api/users', require('../routes/userRoutes')); app.use('/api/auth', require('../routes/authRoutes'));
  app.use('/api/analytics', require('../routes/analyticsRoutes')); app.use('/api/credits', require('../routes/creditRoutes'));
  app.use('/api/notifications', require('../routes/notificationRoutes')); app.use(validationErrorHandler);
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const call = async (path, actor = admin) => { const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { headers: { authorization: `Bearer ${jwt.sign({ id: String(actor._id), role: 'admin' }, process.env.JWT_SECRET)}` } }); return { status: response.status, body: await response.json() }; };
  await t.test('Moderator counts use actual global states; normal confirmation stays outside exception review', async () => {
    const result = await call('/moderator/overview?days=7', moderator); assert.equal(result.status, 200);
    assert.deepEqual(result.body.data.counts, { pendingReviews: 3, pendingResources: 2, pendingStudySets: 1, reportedContent: 2, sessionDisputes: 1, decisionsToday: 3 });
    const titles = result.body.data.queue.map(row => row.title); assert.ok(titles.includes('Explicit referral')); assert.ok(!titles.includes('Normal confirmation') && !titles.includes('Closed referral'));
    assert.ok(result.body.data.queue.length <= 12); assert.ok(!JSON.stringify(result.body).includes('PRIVATE_'));
  });
  await t.test('moderation feed and date trends omit Admin account/security actions and confidential reasons', async () => {
    const short = (await call('/moderator/overview?days=7', moderator)).body.data;
    assert.ok(short.recent.every(row => !row.action.startsWith('user.') && !row.action.startsWith('credit.') && !row.action.startsWith('security.')));
    assert.ok(short.recent.every(row => !row.actor?.email));
    assert.equal(short.trend.decisions.reduce((sum, row) => sum + row.reviews + row.sessions, 0), 3);
    const long = (await call('/moderator/overview?days=30', moderator)).body.data; assert.equal(long.trend.decisions.reduce((sum, row) => sum + row.reviews + row.sessions, 0), 4);
    assert.equal(short.trend.reports.reduce((sum, row) => sum + row.reports, 0), 3);
  });
  await t.test('Trust summary reports recorded protection, role and account/credit actions accurately', async () => {
    const result = await call('/admin/trust-summary'); assert.equal(result.status, 200);
    assert.equal(result.body.data.protectionEvents, 1); assert.equal(result.body.data.roleChanges, 1); assert.equal(result.body.data.adminActions, 2); assert.equal(result.body.data.activeCooldowns, 1);
  });
  await t.test('canonical audit queries page, search staff names and separate activity from security', async () => {
    const first = await call('/admin/audit-logs?scope=activity&q=MaRiA&limit=1'); assert.equal(first.status, 200); assert.equal(first.body.pagination.total, 4); assert.equal(first.body.data.length, 1);
    const second = await call('/admin/audit-logs?scope=activity&q=MaRiA&limit=1&page=2'); assert.notEqual(first.body.data[0]._id, second.body.data[0]._id);
    const security = await call('/admin/audit-logs?scope=security&securityCategory=cooldown'); assert.equal(security.body.pagination.total, 1); assert.equal(security.body.data[0].actorRole, 'system');
    const rolling = await call('/admin/audit-logs?scope=security&period=24h'); assert.equal(rolling.status, 200); assert.equal(rolling.body.pagination.total, 1);
    const byActor = await call('/admin/audit-logs?scope=activity&actor=' + moderator._id); assert.equal(byActor.body.pagination.total, 4);
    const byTarget = await call('/admin/audit-logs?scope=activity&targetId=' + pending); assert.equal(byTarget.body.pagination.total, 1); assert.equal(byTarget.body.data[0].metadata.reason, 'AUTHORIZED_ADMIN_REASON'); assert.equal(byTarget.body.data[0].metadata.reference, 'synthetic-reference'); assert.equal(byTarget.body.data[0].metadata.creditCost, 50); assert.equal(byTarget.body.data[0].metadata.token, undefined); assert.equal(byTarget.body.data[0].actor.email, undefined);
  });
  await t.test('UTC day filters and literal search text return actual matching rows', async () => {
    const date = today.toISOString().slice(0, 10); const result = await call('/admin/audit-logs?scope=activity&from=' + date + '&to=' + date); assert.equal(result.body.pagination.total, 5);
    assert.equal((await call('/admin/audit-logs?scope=activity&q=Maria.*')).body.pagination.total, 0);
    assert.equal((await call('/admin/audit-logs?scope=activity&from=2026-02-29&to=2026-03-01')).status, 400);
    assert.equal((await call('/moderator/overview?days=365', moderator)).status, 400);
  });
  await t.test('database roles deny forged privileged claims and summaries mutate nothing', async () => {
    assert.equal((await call('/moderator/overview', student)).status, 403);
    assert.equal((await call('/admin/trust-summary', moderator)).status, 403);
    assert.equal((await call('/admin/audit-logs?scope=security', moderator)).status, 403);
    assert.equal((await call('/admin/security', student)).status, 403);
    assert.equal(await CreditTransaction.countDocuments(), 0); assert.equal((await User.findById(student._id)).credits, 100); assert.equal(await AuditLog.countDocuments(), 7);
  });
  await t.test('Chrome dashboards, Admin disputes and draft editor use the real isolated API and database', { skip: process.env.ACADOVA_PHASEB3_BROWSER !== '1' }, async () => {
    const path = require('node:path'); const { spawn } = require('node:child_process');
    const password = 'IsolatedDashboardFixture1!';
    await User.updateOne({ _id: moderator._id }, { password: await require('bcryptjs').hash(password, 4) });
    // Seed a recorded movement, without deriving or changing wallet balances.
    await CreditTransaction.collection.insertOne({ type: 'assessment_reward', amount: 20, toUser: student._id, assessment: oid(), createdAt: now });
    const config = { url: `http://127.0.0.1:${server.address().port}/`, token: jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET), moderatorEmail: moderator.email, password, studentName: student.name, moderatorName: moderator.name };
    const frontend = path.resolve(__dirname, '../../acadova-frontend');
    const child = spawn(process.execPath, ['tests/browser-demo.mjs', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'browser-staff-live.jsx', '1366', path.join(require('node:os').tmpdir(), 'acadova-b3-live-api.png'), '900', '/none'], { cwd: frontend, windowsHide: true, env: { ...process.env, ACADOVA_LOCAL_BROWSER_CONFIG: JSON.stringify(config) }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
    const exit = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    assert.equal(exit, 0, output); assert.match(output, /PASS: Real local/); console.log(output.trim());
    assert.equal((await User.findById(student._id)).credits, 100); assert.equal(await CreditTransaction.countDocuments(), 1);
    const savedDraft = await require('../models/Assessment').findOne({ title: 'Isolated C1 assessment draft' }).lean();
    assert.equal(savedDraft.status, 'draft'); assert.equal(savedDraft.questions.length, 3);
    assert.equal(await AuditLog.countDocuments({ action: 'learning.assessment_created', targetId: String(savedDraft._id) }), 1);
  });
});
