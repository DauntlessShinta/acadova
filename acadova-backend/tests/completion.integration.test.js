// Opt-in, fixed loopback replica set only. No dotenv, configurable URI or live providers.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const Notification = require('../models/Notification');
const CreditTransaction = require('../models/CreditTransaction');
const AuditLog = require('../models/AuditLog');
const SessionMessage = require('../models/SessionMessage');
const sessions = require('../controllers/sessionController');
const participants = require('../controllers/completionController');
const moderator = require('../controllers/moderatorController');
const lifecycle = require('../services/completionLifecycle');
const notifications = require('../services/notificationService');
const { isSessionRatingEligible } = require('../utils/sessionLifecycleCompatibility');
const RealDate = Date;
const hour = 3600000;
async function withClock(now, action) {
  global.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [now.getTime()])); }
    static now() { return now.getTime(); }
  };
  try { return await action(); } finally { global.Date = RealDate; }
}
test('genuine isolated completion deadlines, privacy, referrals and settlement races',
  { skip: process.env.ACADOVA_COMPLETION_DB_TESTS !== '1' }, async (t) => {
    assert.notEqual(process.env.NODE_ENV, 'production');
    const dbName = `acadova_completion_tests_${process.pid}`;
    const nativeFetch = global.fetch;
    const envNames = ['JWT_SECRET', 'BREVO_API_KEY', 'MAIL_FROM', 'ONESIGNAL_APP_ID', 'ONESIGNAL_REST_API_KEY', 'ONESIGNAL_IDENTITY_SECRET',
      'SESSION_VALIDATION_DEADLINE_HOURS', 'SESSION_REVIEW_TARGET_HOURS'];
    const beforeEnv = Object.fromEntries(envNames.map((key) => [key, process.env[key]]));
    for (const key of envNames) delete process.env[key];
    process.env.JWT_SECRET = 'completion-local-test-secret';
    global.fetch = async () => assert.fail('A local test must not contact an external provider or evidence link');
    await mongoose.connect(`mongodb://127.0.0.1:27029/${dbName}?replicaSet=acadovaPhase1`, { serverSelectionTimeoutMS: 5000 });
    assert.equal((await mongoose.connection.db.admin().command({ hello: 1 })).setName, 'acadovaPhase1');
    let server;
    t.after(async () => {
      if (server) await new Promise((resolve) => server.close(resolve));
      assert.equal(mongoose.connection.host, '127.0.0.1'); assert.equal(mongoose.connection.db.databaseName, dbName);
      await mongoose.connection.dropDatabase(); await mongoose.disconnect(); global.fetch = nativeFetch; global.Date = RealDate;
      for (const key of envNames) { if (beforeEnv[key] === undefined) delete process.env[key]; else process.env[key] = beforeEnv[key]; }
    });
    await Promise.all([User.init(), Session.init(), Notification.init(), CreditTransaction.init(), AuditLog.init(), SessionMessage.init()]);
    const [learner, tutor, staff, admin, outsider] = await User.create([
      ['Learner Fixture', 'learner', 'student'], ['Tutor Fixture', 'tutor', 'student'], ['Moderator Fixture', 'staff', 'moderator'],
      ['Admin Fixture', 'admin', 'admin'], ['Outsider Fixture', 'outsider', 'student'],
    ].map(([name, email, role]) => ({ name, email: `${email}@example.test`, role, credits: 1000, emailVerified: true, password: 'fixture-password' })));
    const t0 = new RealDate('2026-10-01T01:00:00Z');
    const at = (hours, delta = 0) => new RealDate(t0.getTime() + hours * hour + delta);
    const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
    const invoke = async (handler, row, actor, body = {}) => {
      const res = response(); await handler({ params: { id: String(row._id) }, user: { id: String(actor._id), role: actor.role }, body }, res); return res;
    };
    const live = (overrides = {}) => Session.create({ learner: learner._id, tutor: tutor._id, subject: 'Completion fixture',
      status: 'in_progress', scheduledAt: at(-1), learnerCheckedInAt: at(-1), tutorCheckedInAt: at(-1), startedAt: at(-1), creditAmount: 20, ...overrides });
    const finish = async (row) => withClock(t0, () => invoke(sessions.finishSession, row, tutor));
    const awaiting = async () => { const row = await live(); assert.equal((await finish(row)).statusCode, 200); return Session.findById(row._id); };
    const evidenceBody = { summary: '<script>Plain text summary</script>', completedWork: 'Worked through arrays and solved the practice examples.', links: ['https://example.test/work'] };
    const refer = (row, now = at(72)) => lifecycle.referForReview(row._id, { now });
    const resolve = async (row, outcome = 'confirm_session', version) => {
      const current = await Session.findById(row._id);
      return invoke(moderator.resolveSessionDispute, row, staff, { resolution: outcome,
        resolutionNote: 'Reviewed the actual session evidence.', reviewVersion: version ?? current.reviewVersion ?? 0 });
    };
    await t.test('new finish snapshots 72 hours once; neither finish nor repeat requests confirms or pays', async () => {
      const row = await live(); const before = await User.findById(learner._id);
      assert.equal((await finish(row)).statusCode, 200);
      const stored = await Session.findById(row._id); assert.equal(stored.validationDeadlineAt.getTime(), at(72).getTime());
      assert.equal(stored.awaitingValidationAt.getTime(), t0.getTime()); assert.equal(stored.tutorConfirmedAt, undefined);
      assert.equal(stored.creditsSettledAt, undefined); assert.equal((await User.findById(learner._id)).credits, before.credits);
      assert.equal(await CreditTransaction.countDocuments({ session: row._id }), 0);
      assert.equal((await withClock(at(5), () => invoke(sessions.finishSession, row, tutor))).statusCode, 400);
      assert.equal((await Session.findById(row._id)).validationDeadlineAt.getTime(), at(72).getTime());
      assert.equal(await Notification.countDocuments({ relatedId: row._id, type: 'session.awaiting_validation' }), 2);
      process.env.SESSION_VALIDATION_DEADLINE_HOURS = '96';
      const custom = await awaiting(); assert.equal(custom.validationDeadlineAt.getTime(), at(96).getTime());
      delete process.env.SESSION_VALIDATION_DEADLINE_HOURS;
    });
    await t.test('initial in-app persistence failure rolls finish back; push provider failure preserves committed completion intent', async () => {
      const row = await live(); const originalCreate = Notification.create;
      Notification.create = async () => { throw new Error('Synthetic notification persistence failure'); };
      try { assert.equal((await finish(row)).statusCode, 500); } finally { Notification.create = originalCreate; }
      assert.equal((await Session.findById(row._id)).status, 'in_progress'); assert.equal((await Session.findById(row._id)).validationDeadlineAt, undefined);
      assert.equal((await finish(row)).statusCode, 200);
      const intent = await Notification.findOne({ relatedId: row._id, recipient: learner._id });
      const blockedFetch = global.fetch;
      process.env.ONESIGNAL_APP_ID = 'fixture'; process.env.ONESIGNAL_REST_API_KEY = 'fixture'; process.env.ONESIGNAL_IDENTITY_SECRET = 'fixture-identity-secret-longer-than-32-characters';
      global.fetch = async (url) => { assert.equal(url, 'https://api.onesignal.com/notifications'); return { ok: false, json: async () => ({}) }; };
      try { assert.equal(await notifications.deliverPush(intent._id), false); }
      finally { global.fetch = blockedFetch; delete process.env.ONESIGNAL_APP_ID; delete process.env.ONESIGNAL_REST_API_KEY; delete process.env.ONESIGNAL_IDENTITY_SECRET; }
      assert.equal((await Notification.findById(intent._id)).pushStatus, 'failed'); assert.equal((await Session.findById(row._id)).status, 'awaiting_validation');
      assert.equal(await CreditTransaction.countDocuments({ session: row._id }), 0);
    });
    await t.test('deadline and 24/48-hour boundaries use controlled time and repeated scans never duplicate reminders', async () => {
      await Notification.updateMany({}, { $set: { pushStatus: 'skipped' } });
      const row = await awaiting();
      await lifecycle.scanCompletion(at(24, -1)); assert.equal(await Notification.countDocuments({ relatedId: row._id, type: 'session.validation_reminder' }), 0);
      await Promise.all([lifecycle.scanCompletion(at(24)), lifecycle.scanCompletion(at(24))]);
      assert.equal(await Notification.countDocuments({ relatedId: row._id, type: 'session.validation_reminder' }), 2);
      assert.equal((await invoke(sessions.confirmSession, row, learner)).statusCode, 200);
      await lifecycle.scanCompletion(at(48)); await lifecycle.scanCompletion(at(48));
      const reminders = await Notification.find({ relatedId: row._id, type: 'session.validation_reminder' });
      assert.equal(reminders.length, 3); assert.equal(reminders.filter((r) => String(r.recipient) === String(learner._id)).length, 1);
      await lifecycle.scanCompletion(at(72, -1)); assert.equal((await Session.findById(row._id)).reviewReferral, undefined);
      await Promise.all([lifecycle.scanCompletion(at(72)), lifecycle.scanCompletion(at(72))]);
      const overdue = await Session.findById(row._id); assert.equal(overdue.status, 'awaiting_validation');
      assert.equal(overdue.reviewReferral.source, 'system_overdue'); assert.equal(overdue.disputedBy, undefined); assert.equal(overdue.reviewReferral.requestedBy, undefined);
      await lifecycle.scanCompletion(at(80)); assert.equal(await Notification.countDocuments({ relatedId: row._id, type: 'session.validation_reminder' }), 3);
      assert.equal(await Notification.countDocuments({ relatedId: row._id, type: 'session.review_referred' }), 4, 'Two participants and two authorized staff, one event each');
      assert.equal(await CreditTransaction.countDocuments({ session: row._id }), 0);
    });
    await t.test('evidence is participant-authored, bounded, private, HTTPS-only and never fetched', async () => {
      const row = await awaiting();
      assert.equal((await invoke(participants.submitEvidence, row, outsider, evidenceBody)).statusCode, 403);
      assert.equal((await invoke(participants.getEvidence, row, outsider)).statusCode, 403);
      for (const links of [['http://example.test'], ['https://user:password@example.test'], Array(6).fill('https://example.test')]) {
        assert.equal((await invoke(participants.submitEvidence, row, tutor, { ...evidenceBody, links })).statusCode, 400);
      }
      for (let i = 0; i < 5; i++) assert.equal((await invoke(participants.submitEvidence, row, tutor, evidenceBody)).statusCode, 200);
      assert.equal((await invoke(participants.submitEvidence, row, tutor, evidenceBody)).statusCode, 409);
      assert.equal((await invoke(participants.submitEvidence, row, learner, evidenceBody)).statusCode, 200);
      const own = await invoke(participants.getEvidence, row, learner); assert.equal(own.body.data.evidence.length, 6);
      assert.equal(String(own.body.data.evidence[0].submittedBy), String(tutor._id)); assert.ok(own.body.data.evidence[0].submittedAt);
      assert.equal(own.body.data.evidence[0].summary, evidenceBody.summary, 'Plain text stored, rendered safely by React');
      assert.equal(await CreditTransaction.countDocuments({ session: row._id }), 0);
    });
    await t.test('Tutor request needs evidence, is eligible exactly at deadline, and races with automatic referral as one case', async () => {
      const row = await awaiting();
      const request = () => invoke(participants.requestReview, row, tutor, { reason: 'My peer has not yet responded.' });
      assert.equal((await withClock(at(71), request)).statusCode, 409);
      assert.equal((await withClock(at(72), request)).statusCode, 400);
      assert.equal((await invoke(participants.submitEvidence, row, tutor, evidenceBody)).statusCode, 200);
      const results = await withClock(at(72), () => Promise.all([request(), refer(row)]));
      assert.ok(results.some((r) => r?.statusCode === 200 || r?.reviewReferral));
      const stored = await Session.findById(row._id); assert.ok(stored.reviewReferral.id); assert.equal(stored.status, 'awaiting_validation');
      assert.equal(stored.disputedAt, undefined); assert.equal((await withClock(at(73), request)).statusCode, 409);
      assert.equal(await Notification.countDocuments({ relatedId: row._id, type: 'session.review_referred' }), 4);
    });
    await t.test('historical canonical finishes get no automatic deadline/referral and retain voluntary Tutor review', async () => {
      const row = await live({ status: 'awaiting_validation', awaitingValidationAt: t0 });
      await lifecycle.scanCompletion(at(200)); const untouched = await Session.findById(row._id);
      assert.equal(untouched.validationDeadlineAt, undefined); assert.equal(untouched.reviewReferral, undefined);
      await invoke(participants.submitEvidence, row, tutor, evidenceBody);
      const result = await invoke(participants.requestReview, row, tutor, { reason: 'Voluntary review of this historical finished session.' });
      assert.equal(result.statusCode, 200); assert.equal(result.body.data.reviewReferral.source, 'legacy_tutor_request');
      assert.equal(result.body.data.validationDeadlineAt, undefined);
    });
    await t.test('staff rejection records a reason/audit, resolves without transfer and denies stale repeats', async () => {
      const row = await awaiting(); await refer(row);
      const before = (await User.findById(learner._id)).credits;
      assert.equal((await resolve(row, 'cancel_session')).statusCode, 200);
      const stored = await Session.findById(row._id); assert.equal(stored.status, 'resolved'); assert.equal(stored.disputedBy, undefined);
      assert.equal(stored.reviewReferral.closure, 'staff_resolution'); assert.equal(stored.creditsSettledAt, undefined);
      assert.equal((await User.findById(learner._id)).credits, before); assert.equal(await CreditTransaction.countDocuments({ session: row._id }), 0);
      const audit = await AuditLog.findOne({ targetId: String(row._id) }); assert.equal(audit.action, 'session.completion_review_resolved');
      assert.equal(audit.metadata.reason, 'Reviewed the actual session evidence.');
      assert.equal((await resolve(row)).statusCode, 409);
    });
    await t.test('staff approval transfers once and real referral evidence preserves review eligibility', async () => {
      const row = await awaiting(); await refer(row);
      assert.equal((await resolve(row)).statusCode, 200);
      const stored = await Session.findById(row._id); const ledger = await CreditTransaction.find({ session: row._id });
      assert.equal(ledger.length, 1); assert.equal(isSessionRatingEligible(stored, ledger), true);
      assert.equal(stored.disputedAt, undefined); assert.equal((await resolve(row)).statusCode, 409);
    });
    await t.test('evidence/clarification changes invalidate stale staff decisions and clarification is audited/private', async () => {
      const row = await awaiting(); await refer(row); let stored = await Session.findById(row._id);
      const oldVersion = stored.reviewVersion;
      await invoke(participants.submitEvidence, row, learner, evidenceBody);
      assert.equal((await resolve(row, 'confirm_session', oldVersion)).statusCode, 409);
      stored = await Session.findById(row._id);
      const clarified = await invoke(moderator.requestSessionClarification, row, staff, { reason: 'Please explain which exercises were completed.', reviewVersion: stored.reviewVersion });
      assert.equal(clarified.statusCode, 200); assert.equal(clarified.body.data.reviewClarifications.length, 1);
      assert.equal((await resolve(row, 'confirm_session', stored.reviewVersion)).statusCode, 409);
      assert.equal(await AuditLog.countDocuments({ targetId: String(row._id), action: 'session.review_clarification_requested' }), 1);
      assert.equal(await Notification.countDocuments({ relatedId: row._id, type: 'session.review_clarification' }), 2);
    });
    await t.test('late positive confirmation closes referral and races staff approval/rejection with one terminal winner', async () => {
      for (const outcome of ['confirm_session', 'cancel_session']) for (let i = 0; i < 6; i++) {
        const row = await awaiting(); await invoke(sessions.confirmSession, row, tutor); await refer(row);
        const version = (await Session.findById(row._id)).reviewVersion;
        const results = await Promise.all([invoke(sessions.confirmSession, row, learner), resolve(row, outcome, version)]);
        assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
        const stored = await Session.findById(row._id); const payments = await CreditTransaction.find({ session: row._id });
        assert.equal(payments.length, stored.status === 'completed' || stored.resolution === 'confirm_session' ? 1 : 0);
        assert.ok(stored.reviewReferral.closedAt); assert.ok(['participant_completion', 'staff_resolution'].includes(stored.reviewReferral.closure));
        assert.equal((await resolve(row)).statusCode, 409);
      }
    });
    await t.test('insufficient credits and audit failures roll back status, balance and ledger atomically', async () => {
      const row = await awaiting(); await refer(row); const before = (await User.findById(learner._id)).credits;
      await User.updateOne({ _id: learner._id }, { $set: { credits: 0 } });
      const blocked = await resolve(row); assert.equal(blocked.statusCode, 400); assert.match(blocked.body.message, /Learner.*insufficient/);
      assert.equal((await Session.findById(row._id)).status, 'awaiting_validation'); assert.equal(await CreditTransaction.countDocuments({ session: row._id }), 0);
      await User.updateOne({ _id: learner._id }, { $set: { credits: before } });
      const original = AuditLog.create; AuditLog.create = async () => { throw new Error('Synthetic audit failure'); };
      try { assert.equal((await resolve(row)).statusCode, 500); } finally { AuditLog.create = original; }
      assert.equal((await User.findById(learner._id)).credits, before); assert.equal((await Session.findById(row._id)).status, 'awaiting_validation');
      assert.equal(await CreditTransaction.countDocuments({ session: row._id }), 0);
    });
    await t.test('staff response target emits one capped Admin escalation and never adjudicates silence', async () => {
      const row = await awaiting(); await refer(row); const target = (await Session.findById(row._id)).reviewReferral.targetAt;
      await lifecycle.scanCompletion(new RealDate(target.getTime() - 1));
      assert.equal(await Notification.countDocuments({ relatedId: row._id, type: 'session.review_escalated' }), 0);
      await lifecycle.scanCompletion(target); await lifecycle.scanCompletion(at(300));
      assert.equal(await Notification.countDocuments({ relatedId: row._id, type: 'session.review_escalated' }), 1);
      assert.equal((await Session.findById(row._id)).status, 'awaiting_validation');
      assert.equal(await CreditTransaction.countDocuments({ session: row._id }), 0);
    });
    await t.test('an explicit dispute after referral stays honest and retains the same capped staff escalation target', async () => {
      const row = await awaiting(); await refer(row);
      const result = await invoke(sessions.disputeSession, row, learner, { reason: 'I explicitly disagree with the session completion.' });
      assert.equal(result.statusCode, 200);
      const stored = await Session.findById(row._id); assert.equal(stored.status, 'disputed'); assert.equal(String(stored.disputedBy), String(learner._id));
      await lifecycle.scanCompletion(stored.reviewReferral.targetAt); await lifecycle.scanCompletion(at(300));
      assert.equal(await Notification.countDocuments({ relatedId: row._id, type: 'session.review_escalated' }), 1);
      assert.equal(await CreditTransaction.countDocuments({ session: row._id }), 0);
    });
    await t.test('real authenticated APIs enforce evidence privacy, server-owned stamps and staff authority', async () => {
      const app = express(); app.use(express.json()); app.use('/api/sessions', require('../routes/sessionRoutes')); app.use('/api/moderator', require('../routes/moderatorRoutes'));
      server = await new Promise((resolve) => { const started = app.listen(0, '127.0.0.1', () => resolve(started)); });
      const row = await awaiting(); await refer(row); await SessionMessage.create({ session: row._id, sender: learner._id, body: 'Relevant private session message.' });
      const request = (actor, path, body) => nativeFetch(`http://127.0.0.1:${server.address().port}${path}`, {
        method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ id: String(actor._id) }, process.env.JWT_SECRET)}` },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      assert.equal((await request(outsider, `/api/sessions/${row._id}/evidence`)).status, 403);
      assert.equal((await request(learner, `/api/moderator/sessions/${row._id}/evidence`)).status, 403);
      assert.equal((await request(learner, `/api/sessions/${row._id}/evidence`, { ...evidenceBody, submittedBy: String(tutor._id), submittedAt: t0 })).status, 400);
      const reviewed = await request(staff, `/api/moderator/sessions/${row._id}/evidence`); assert.equal(reviewed.status, 200);
      assert.equal((await reviewed.json()).data.messages.length, 1);
      assert.equal((await request(admin, `/api/moderator/sessions/${row._id}/evidence`)).status, 200);
      assert.equal((await request(learner, `/api/moderator/sessions/${row._id}/resolve`, { resolution: 'confirm_session', resolutionNote: 'Forged approval attempt.' })).status, 403);
      const liveRow = await live(); assert.equal((await request(staff, `/api/moderator/sessions/${liveRow._id}/evidence`)).status, 403);
    });
    await t.test('check-in expected schedule detects delayed consent while legacy empty payload remains supported', async () => {
      const time = new RealDate(RealDate.now() + 5 * 60000);
      const row = await live({ status: 'scheduled', scheduledAt: time, startedAt: undefined, learnerCheckedInAt: undefined, tutorCheckedInAt: undefined });
      assert.equal((await invoke(sessions.checkIn, row, learner, { expectedScheduledAt: at(5).toISOString() })).statusCode, 409);
      assert.equal((await invoke(sessions.checkIn, row, learner, { expectedScheduledAt: time.toISOString() })).statusCode, 200);
      assert.equal((await invoke(sessions.checkIn, row, tutor)).statusCode, 200);
      assert.equal((await Session.findById(row._id)).status, 'in_progress');
    });
  });
