// Explicit opt-in. Fixed disposable loopback database; never reads dotenv.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');
const CreditTransaction = require('../models/CreditTransaction');
const Notification = require('../models/Notification');
const SessionMessage = require('../models/SessionMessage');
const { validationErrorHandler } = require('../middleware/validation');

test('Moderator defense: real authenticated lifecycle, durable audit and settlement',
  { skip: process.env.ACADOVA_MODERATION_DB_TESTS !== '1' }, async t => {
    assert.notEqual(process.env.NODE_ENV, 'production');
    const database = `acadova_moderator_defense_${process.pid}`;
    const originalFetch = global.fetch;
    const envNames = ['JWT_SECRET', 'BREVO_API_KEY', 'MAIL_FROM', 'ONESIGNAL_APP_ID', 'ONESIGNAL_REST_API_KEY', 'ONESIGNAL_IDENTITY_SECRET'];
    const originalEnv = Object.fromEntries(envNames.map(key => [key, process.env[key]]));
    for (const key of envNames) delete process.env[key];
    process.env.JWT_SECRET = 'isolated-moderator-defense-test-secret';
    global.fetch = async () => assert.fail('External provider access forbidden');
    let server;
    t.after(async () => {
      if (server) await new Promise(resolve => server.close(resolve));
      if (mongoose.connection.readyState === 1) {
        assert.equal(mongoose.connection.host, '127.0.0.1');
        assert.equal(mongoose.connection.db.databaseName, database);
        await mongoose.connection.dropDatabase();
      }
      await mongoose.disconnect(); global.fetch = originalFetch;
      for (const key of envNames) { if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key]; }
    });
    await mongoose.connect(`mongodb://127.0.0.1:27029/${database}?replicaSet=acadovaPhase1`, { serverSelectionTimeoutMS: 5000 });
    assert.equal((await mongoose.connection.db.admin().command({ hello: 1 })).setName, 'acadovaPhase1');
    await Promise.all([User, Session, AuditLog, CreditTransaction, Notification, SessionMessage].map(model => model.init()));
    const [learner, tutor, staff, admin, outsider] = await User.create(['learner', 'tutor', 'moderator', 'admin', 'outsider'].map(name => ({
      name: `${name} Fixture`, email: `${name}@example.test`, role: ['moderator', 'admin'].includes(name) ? name : 'student',
      password: 'fixture-password', emailVerified: true, credits: 1000, skillsToTeach: ['Java'],
    })));
    const app = express();
    app.use(require('cors')({ origin: (origin, callback) => callback(null, !origin || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) }));
    app.use(express.json());
    app.use('/api/sessions', require('../routes/sessionRoutes'));
    app.use('/api/moderator', require('../routes/moderatorRoutes'));
    app.use('/api/admin', require('../routes/adminRoutes'));
    app.use('/api/users', require('../routes/userRoutes'));
    app.use('/api/notifications', require('../routes/notificationRoutes'));
    app.use(validationErrorHandler);
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}/`;
    // Deliberately forge the role claim: only the role loaded from User may authorize/audit.
    const token = actor => jwt.sign({ id: String(actor._id), role: actor.role === 'admin' ? 'student' : 'admin' }, process.env.JWT_SECRET);
    const call = async (path, actor = learner, method = 'GET', body) => {
      const result = await originalFetch(`${url}api${path}`, { method, headers: {
        ...(actor ? { authorization: `Bearer ${token(actor)}` } : {}), 'content-type': 'application/json',
      }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const text = await result.text();
      return { status: result.status, body: text.startsWith('{') ? JSON.parse(text) : {} };
    };
    const action = (row, suffix, actor, body = {}) => call(`/sessions/${row._id}/${suffix}`, actor, 'POST', body);
    const balance = async () => (await User.find({ _id: { $in: [learner._id, tutor._id] } }).sort({ _id: 1 }).lean()).map(row => row.credits);
    const audits = row => AuditLog.find({ targetType: 'Session', targetId: String(row._id), action: 'session.dispute_resolved' }).lean();
    const makeCase = async () => {
      const row = await Session.create({ lifecycleVersion: 1, learner: learner._id, tutor: tutor._id, subject: 'Java defense case',
        status: 'scheduled', scheduledAt: new Date(Date.now() + 60000), creditAmount: 20,
        meetingMethod: 'online', meetingLink: 'https://example.test/private-meeting' });
      assert.equal((await action(row, 'check-in', learner)).status, 200);
      assert.equal((await action(row, 'check-in', tutor)).status, 200);
      assert.equal((await action(row, 'finish', tutor)).status, 200);
      assert.equal((await action(row, 'dispute', learner, { reason: 'Please review the completed exercise and our disagreement.' })).status, 200);
      return Session.findById(row._id);
    };
    const decide = (row, actor, resolution = 'confirm_session', extra = {}) => call(`/moderator/sessions/${row._id}/resolve`, actor, 'POST', {
      resolution, resolutionNote: 'Reviewed the submitted work and participant accounts.', reviewVersion: row.reviewVersion, ...extra,
    });

    await t.test('new requests have a server marker; legacy acceptance cannot skip canonical validation', async () => {
      const request = { tutorId: String(tutor._id), subject: 'Java', scheduledAt: new Date(Date.now() + 300000).toISOString() };
      assert.equal((await call('/sessions', learner, 'POST', { ...request, lifecycleVersion: null })).status, 400);
      const created = await call('/sessions', learner, 'POST', request);
      assert.equal(created.status, 201); const row = created.body.data;
      assert.equal(row.lifecycleVersion, 1);
      const accepted = await call(`/sessions/${row._id}/status`, tutor, 'PATCH', { status: 'accepted' });
      assert.equal(accepted.status, 200); assert.equal(accepted.body.data.status, 'scheduled');
      assert.equal((await call(`/sessions/${row._id}/status`, tutor, 'PATCH', { status: 'completed' })).status, 400);
      assert.equal((await action(row, 'confirm', learner)).status, 409);
      assert.equal((await action(row, 'finish', tutor)).status, 400);
      assert.equal((await action(row, 'check-in', learner)).status, 200);
      assert.equal((await action(row, 'check-in', tutor)).status, 200);
      assert.equal((await action(row, 'finish', tutor)).status, 200);
      assert.equal((await action(row, 'confirm', learner)).status, 200);
      assert.equal(await CreditTransaction.countDocuments({ session: row._id }), 0);
      assert.equal((await action(row, 'confirm', tutor)).status, 200);
      assert.equal((await action(row, 'confirm', tutor)).status, 409);
      assert.equal(await CreditTransaction.countDocuments({ session: row._id }), 1);
    });

    for (const actor of [staff, admin]) for (const outcome of ['confirm_session', 'cancel_session']) {
      await t.test(`${actor.role} resolution ${outcome} persists authoritative audit and exact credit outcome`, async () => {
        const row = await makeCase(); const before = await balance(); const start = Date.now();
        const result = await decide(row, actor, outcome); assert.equal(result.status, 200);
        const logs = await audits(row); assert.equal(logs.length, 1);
        assert.equal(String(logs[0].actor), String(actor._id)); assert.equal(logs[0].actorRole, actor.role);
        assert.equal(logs[0].targetType, 'Session'); assert.equal(logs[0].metadata.resolution, outcome);
        assert.equal(logs[0].metadata.reason, 'Reviewed the submitted work and participant accounts.');
        assert.ok(logs[0].createdAt.getTime() >= start && logs[0].createdAt.getTime() <= Date.now());
        assert.deepEqual(Object.keys(logs[0].metadata).sort(), ['reason', 'resolution']);
        const stored = await Session.findById(row._id); assert.equal(stored.status, 'resolved');
        assert.equal(String(stored.resolvedBy), String(actor._id)); assert.equal(stored.learnerConfirmedAt, undefined);
        const payments = await CreditTransaction.find({ session: row._id }).lean();
        assert.equal(payments.length, outcome === 'confirm_session' ? 1 : 0);
        if (payments.length) { assert.equal(payments[0].amount, 20); assert.equal(String(payments[0].fromUser), String(learner._id)); }
        assert.deepEqual(await balance(), outcome === 'confirm_session' ? [before[0] - 20, before[1] + 20] : before);
        assert.equal((await decide(row, actor, outcome)).status, 409); assert.equal((await audits(row)).length, 1);
        const evidence = await call(`/moderator/sessions/${row._id}/evidence`, actor);
        assert.equal(evidence.status, 200); assert.equal(evidence.body.data.auditEntries[0].actorRole, actor.role);
        assert.equal(evidence.body.data.auditEntries[0].actor._id, String(actor._id));
        assert.equal(evidence.body.data.auditEntries[0].targetId, String(row._id));
      });
    }
    await t.test('unauthorized, self, forged fields, stale version and invalid state decisions have no side effects', async () => {
      const row = await makeCase(); const before = await balance();
      for (const actor of [learner, tutor, outsider, null]) assert.equal((await decide(row, actor)).status, actor ? 403 : 401);
      assert.equal((await decide(row, staff, 'confirm_session', { actorRole: 'admin', createdAt: new Date().toISOString() })).status, 400);
      assert.equal((await decide(row, staff, 'confirm_session', { resolutionNote: 'short' })).status, 400);
      assert.equal((await decide(row, staff, 'confirm_session', { reviewVersion: row.reviewVersion - 1 })).status, 409);
      const scheduled = await Session.create({ learner: learner._id, tutor: tutor._id, subject: 'Not disputed', status: 'scheduled', creditAmount: 20 });
      assert.equal((await decide(scheduled, staff)).status, 409);
      const self = await Session.create({ ...row.toObject(), _id: new mongoose.Types.ObjectId(), tutor: staff._id });
      assert.equal((await decide(self, staff)).status, 403);
      assert.equal((await audits(row)).length, 0); assert.deepEqual(await balance(), before);
      assert.equal(await CreditTransaction.countDocuments({ session: row._id }), 0);
    });
    await t.test('concurrent Moderator/Admin decisions have one settlement and one durable audit winner', async () => {
      const row = await makeCase(); const before = await balance();
      const results = await Promise.all([decide(row, staff), decide(row, admin)]);
      assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
      assert.equal((await audits(row)).length, 1); assert.equal(await CreditTransaction.countDocuments({ session: row._id }), 1);
      assert.deepEqual(await balance(), [before[0] - 20, before[1] + 20]);
    });
    await t.test('audit/ledger failure and insufficient funds roll back decisions, balances and required records', async () => {
      const row = await makeCase(); const before = await balance();
      const createAudit = AuditLog.create;
      AuditLog.create = async () => { throw new Error('Synthetic durable audit failure'); };
      try { for (const outcome of ['confirm_session', 'cancel_session']) assert.equal((await decide(row, staff, outcome)).status, 500); }
      finally { AuditLog.create = createAudit; }
      const createPayment = CreditTransaction.create;
      CreditTransaction.create = async () => { throw new Error('Synthetic ledger failure'); };
      try { assert.equal((await decide(row, admin)).status, 500); } finally { CreditTransaction.create = createPayment; }
      assert.deepEqual(await balance(), before);
      const learnerCredits = (await User.findById(learner._id)).credits;
      await User.updateOne({ _id: learner._id }, { $set: { credits: 0 } });
      try { assert.equal((await decide(row, staff)).status, 400); }
      finally { await User.updateOne({ _id: learner._id }, { $set: { credits: learnerCredits } }); }
      assert.equal((await Session.findById(row._id)).status, 'disputed');
      assert.equal((await audits(row)).length, 0); assert.equal(await CreditTransaction.countDocuments({ session: row._id }), 0);
      assert.deepEqual(await balance(), before);
    });
    await t.test('audit access stays case-scoped for Moderators, Admin-only globally, with no mutation API', async () => {
      const row = await makeCase(); assert.equal((await decide(row, admin, 'cancel_session')).status, 200);
      for (const actor of [learner, outsider, null]) assert.equal((await call(`/moderator/sessions/${row._id}/evidence`, actor)).status, actor ? 403 : 401);
      assert.equal((await call('/admin/audit-logs', staff)).status, 403);
      const result = await call(`/admin/audit-logs?targetType=Session&targetId=${row._id}`, admin);
      assert.equal(result.status, 200); assert.equal(result.body.data.length, 1);
      const entry = result.body.data[0];
      for (const method of ['PATCH', 'DELETE']) assert.equal((await call(`/admin/audit-logs/${entry._id}`, admin, method, { summary: 'Tampered' })).status, 404);
      // Deliberately tainted historical metadata must not leak through the scoped projection.
      await AuditLog.collection.updateOne({ _id: new mongoose.Types.ObjectId(entry._id) }, { $set: { 'metadata.meetingToken': 'PRIVATE_SENTINEL' } });
      const inspected = await call(`/moderator/sessions/${row._id}/evidence`, staff);
      assert.equal(JSON.stringify(inspected.body.data.auditEntries).includes('PRIVATE_SENTINEL'), false);
      assert.equal(JSON.stringify(inspected.body.data.auditEntries).includes('example.test'), false);
      assert.equal((await AuditLog.findById(entry._id)).summary, 'Session dispute resolved');
      const find = AuditLog.find; AuditLog.find = () => { throw new Error('Synthetic read failure'); };
      try { assert.equal((await call(`/moderator/sessions/${row._id}/evidence`, staff)).status, 503); } finally { AuditLog.find = find; }
    });
    await t.test('unmarked historical acceptance and paid completion remain compatible without invented markers', async () => {
      const row = await Session.create({ learner: learner._id, tutor: tutor._id, subject: 'Historical session', status: 'accepted',
        creditAmount: 2, meetingMethod: 'online', meetingLink: 'https://example.test/historical' });
      assert.equal(row.lifecycleVersion, undefined);
      assert.equal((await call(`/sessions/${row._id}/status`, tutor, 'PATCH', { status: 'completed' })).status, 200);
      assert.equal((await action(row, 'confirm', learner)).status, 200);
      const stored = await Session.findById(row._id); assert.equal(stored.lifecycleVersion, undefined); assert.equal(stored.learnerCheckedInAt, undefined);
      assert.equal((await action(row, 'confirm', learner)).status, 409);
      const paid = await Session.create({ learner: learner._id, tutor: tutor._id, subject: 'Already paid historical', status: 'completed', creditAmount: 2 });
      await CreditTransaction.create({ session: paid._id, fromUser: learner._id, toUser: tutor._id, amount: 2 });
      const before = await balance(); assert.equal((await action(paid, 'confirm', learner)).status, 200);
      assert.deepEqual(await balance(), before); assert.equal(await CreditTransaction.countDocuments({ session: paid._id }), 1);
    });
    await t.test('real Chrome Moderator/Admin dispute-to-audit demonstration', { skip: process.env.ACADOVA_MODERATION_BROWSER !== '1' }, async () => {
      const { spawn } = require('node:child_process'); const path = require('node:path'); const os = require('node:os');
      for (const [actor, width, resolution] of [[staff, 390, 'confirm_session'], [admin, 1366, 'cancel_session']]) {
        const row = await makeCase(); const before = await balance();
        await SessionMessage.create({ session: row._id, sender: learner._id, body: 'We discussed arrays; please review the exercise.' });
        const config = { url, token: token(actor), role: actor.role, sessionId: String(row._id), resolution };
        const child = spawn(process.execPath, ['tests/browser-demo.mjs', 'C:/Program Files/Google/Chrome/Application/chrome.exe',
          'browser-moderator-defense-live.jsx', String(width), path.join(os.tmpdir(), `acadova-moderator-defense-${width}.png`), width === 390 ? '844' : '900', '/none'],
        { cwd: path.resolve(__dirname, '../../acadova-frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ACADOVA_LOCAL_BROWSER_CONFIG: JSON.stringify(config) } });
        let output = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
        assert.equal(await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); }), 0, output);
        console.log(output.trim());
        assert.equal((await Session.findById(row._id)).resolution, resolution); assert.equal((await audits(row)).length, 1);
        assert.deepEqual(await balance(), resolution === 'confirm_session' ? [before[0] - 20, before[1] + 20] : before);
      }
    });
  });
