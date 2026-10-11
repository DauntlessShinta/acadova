// Explicit opt-in only. Never loads dotenv or accepts a configurable database URI.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const User = require('../models/User');
const Session = require('../models/Session');
const Notification = require('../models/Notification');
const CreditTransaction = require('../models/CreditTransaction');
const controller = require('../controllers/sessionController');
const users = require('../controllers/userController');
const lifecycle = require('../services/rescheduleLifecycle');
const reminders = require('../services/notificationReminderService');
const notifications = require('../services/notificationService');
const enabled = process.env.ACADOVA_PHASE1_DB_TESTS === '1';

test('isolated replica-set Session integrity and delivery integration', { skip: !enabled }, async (t) => {
  assert.notEqual(process.env.NODE_ENV, 'production');
  const dbName = `acadova_phase1_tests_${process.pid}`;
  const nativeFetch = global.fetch;
  const envNames = ['JWT_SECRET', 'BREVO_API_KEY', 'MAIL_FROM', 'FRONTEND_URL',
    'ONESIGNAL_APP_ID', 'ONESIGNAL_REST_API_KEY', 'ONESIGNAL_IDENTITY_SECRET'];
  const oldEnv = Object.fromEntries(envNames.map((key) => [key, process.env[key]]));
  for (const key of envNames) delete process.env[key];
  process.env.JWT_SECRET = 'local-session-integrity-fixture-secret';
  process.env.FRONTEND_URL = 'http://localhost:5173';
  let mailFails = true; let providerCalls = 0;
  global.fetch = async (url) => {
    assert.equal(url, 'https://api.brevo.com/v3/smtp/email', 'No unapproved provider request');
    providerCalls += 1;
    return { ok: !mailFails, json: async () => ({ messageId: 'fixture' }) };
  };
  await mongoose.connect(`mongodb://127.0.0.1:27029/${dbName}?replicaSet=acadovaPhase1`, { serverSelectionTimeoutMS: 5000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  assert.equal(hello.setName, 'acadovaPhase1'); assert.equal(hello.isWritablePrimary, true);
  assert.equal(mongoose.connection.db.databaseName, dbName);
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    assert.equal(mongoose.connection.host, '127.0.0.1');
    assert.match(mongoose.connection.db.databaseName, /^acadova_phase1_tests_\d+$/);
    await mongoose.connection.dropDatabase(); // Only this per-process synthetic database.
    await mongoose.disconnect(); global.fetch = nativeFetch;
    for (const key of envNames) { if (oldEnv[key] === undefined) delete process.env[key]; else process.env[key] = oldEnv[key]; }
  });
  await Promise.all([User.init(), Session.init(), Notification.init(), CreditTransaction.init()]);
  const [learner, tutor, stranger, moderator, unverified] = await User.create([
    { name: 'Learner Fixture', email: 'learner@example.test', skillsToTeach: ['Math'] },
    { name: 'Tutor Fixture', email: 'tutor@example.test', skillsToTeach: ['Java Arrays', 'Python'] },
    { name: 'Stranger Fixture', email: 'stranger@example.test' },
    { name: 'Moderator Fixture', email: 'moderator@example.test', role: 'moderator' },
    { name: 'Unverified Fixture', email: 'unverified@example.test', emailVerified: false },
  ].map((row) => ({ role: 'student', password: 'fixture-password', credits: 100, emailVerified: true, ...row })));
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  const invoke = async (handler, row, actor, body = {}) => {
    const res = response(); await handler({ params: { id: String(row._id) }, user: { id: String(actor._id), role: actor.role, credits: 100 }, body }, res); return res;
  };
  const future = (minutes = 120) => new Date(Date.now() + minutes * 60000);
  const make = (overrides = {}) => Session.create({ learner: learner._id, tutor: tutor._id,
    subject: 'Historical Java', status: 'scheduled', scheduledAt: future(5),
    creditAmount: 20, meetingMethod: 'online', meetingLink: 'https://example.test/meeting', ...overrides });
  const propose = (row, actor = learner, body = {}) => invoke(controller.proposeReschedule, row, actor, { scheduledAt: future().toISOString(), ...body });
  const decide = (row, action, actor, proposalId) => invoke(controller[action], row, actor, { proposalId });
  const create = (subject, extra = {}) => invoke(controller.createSession, {}, learner, {
    tutorId: String(tutor._id), subject, scheduledAt: future(1000).toISOString(), meetingMethod: 'online', requestMessage: 'Please help with an example.', ...extra });

  await t.test('API subject matching canonicalizes NFKC/case/whitespace and rejects unknown/empty skills', async () => {
    const result = await create('  ＪＡＶＡ   arrays  ');
    assert.equal(result.statusCode, 201); assert.equal(result.body.data.subject, 'Java Arrays');
    assert.equal(result.body.data.creditAmount, 20);
    assert.equal((await create('Java')).statusCode, 400);
    await User.updateOne({ _id: tutor._id }, { $set: { skillsToTeach: [] } });
    assert.equal((await create('Java Arrays')).statusCode, 400);
    assert.equal((await Session.findById(result.body.data._id)).subject, 'Java Arrays');
    await User.updateOne({ _id: tutor._id }, { $set: { skillsToTeach: ['Java Arrays', 'Python'] } });
  });
  await t.test('a concurrent profile edit wins before the participant lock and stale teaching subjects are rejected', async () => {
    const original = User.findOneAndUpdate;
    let announced; const reached = new Promise((resolve) => { announced = resolve; });
    let release; const gate = new Promise((resolve) => { release = resolve; });
    User.findOneAndUpdate = function (filter, ...args) {
      if (String(filter._id) !== String(tutor._id) || filter.role !== 'student') return original.call(this, filter, ...args);
      return { select: async (fields) => { announced(); await gate; return original.call(User, filter, ...args).select(fields); } };
    };
    try {
      const pending = create('Python'); await reached;
      const edited = await invoke(users.updateMe, {}, tutor, { skillsToTeach: ['Java Arrays'] });
      assert.equal(edited.statusCode, 200); release();
      assert.equal((await pending).statusCode, 400);
    } finally { release(); User.findOneAndUpdate = original; }
  });
  await t.test('request/skill edits serialize after the lock without changing historical subjects', async () => {
    const original = Session.create;
    let announced; const reached = new Promise((resolve) => { announced = resolve; });
    let release; const gate = new Promise((resolve) => { release = resolve; });
    Session.create = async function (...args) { announced(); await gate; return original.apply(this, args); };
    try {
      const pending = create('Java Arrays', { scheduledAt: future(1001).toISOString() }); await reached;
      const edit = invoke(users.updateMe, {}, tutor, { skillsToTeach: [] });
      release(); const requested = await pending;
      assert.equal(requested.statusCode, 201); assert.equal((await edit).statusCode, 200);
      assert.equal((await Session.findById(requested.body.data._id)).subject, 'Java Arrays');
      assert.equal((await create('Java Arrays')).statusCode, 400);
    } finally { release(); Session.create = original; await User.updateOne({ _id: tutor._id }, { $set: { skillsToTeach: ['Java Arrays'] } }); }
  });
  await t.test('simultaneous proposals have one winner and persist a transactional in-app/email intent', async () => {
    const row = await make(); const old = row.scheduledAt.getTime();
    const results = await Promise.all([propose(row, learner), propose(row, tutor, { scheduledAt: future(180).toISOString() })]);
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
    const stored = await Session.findById(row._id);
    assert.equal(stored.scheduledAt.getTime(), old); assert.ok(stored.rescheduleExpiresAt);
    const events = await Notification.find({ relatedId: row._id }); assert.equal(events.length, 1);
    assert.equal(events[0].emailStatus, 'pending'); assert.equal(events[0].proposal.displayTimezone, 'UTC');
    assert.equal(events[0].proposal.proposalId, stored.rescheduleProposalId);
    assert.match(notifications.linkFor(events[0]), /target=proposal&proposalId=/);
    assert.equal(providerCalls, 0, 'Providers never send within the transaction');
  });
  await t.test('notification persistence failure rolls back the proposal action', async () => {
    const row = await make(); const original = Notification.create;
    Notification.create = async () => { throw new Error('Synthetic persistence failure'); };
    try { assert.equal((await propose(row)).statusCode, 500); }
    finally { Notification.create = original; }
    assert.equal((await Session.findById(row._id)).rescheduleProposalId, undefined);
  });
  await t.test('withdraw/replace require proposer ownership and exact active IDs, with bounded history', async () => {
    const row = await make(); const first = (await propose(row)).body.data.rescheduleProposalId;
    assert.equal((await decide(row, 'withdrawReschedule', tutor, first)).statusCode, 403);
    assert.equal((await propose(row, tutor, { proposalId: first })).statusCode, 403);
    const replacement = await propose(row, learner, { proposalId: first, scheduledAt: future(180).toISOString() });
    assert.equal(replacement.statusCode, 200); const second = replacement.body.data.rescheduleProposalId;
    assert.notEqual(first, second);
    for (const action of ['acceptReschedule', 'declineReschedule', 'withdrawReschedule']) {
      assert.equal((await decide(row, action, action === 'withdrawReschedule' ? learner : tutor, first)).statusCode, 409);
    }
    assert.equal((await decide(row, 'acceptReschedule', learner, second)).statusCode, 403);
    const races = await Promise.all([decide(row, 'withdrawReschedule', learner, second), decide(row, 'acceptReschedule', tutor, second)]);
    assert.deepEqual(races.map((r) => r.statusCode).sort(), [200, 409]);
    const historyRow = await make();
    for (let index = 0; index < 23; index += 1) {
      const proposal = await propose(historyRow); assert.equal(proposal.statusCode, 200);
      assert.equal((await decide(historyRow, 'withdrawReschedule', learner, proposal.body.data.rescheduleProposalId)).statusCode, 200);
    }
    const stored = await Session.findById(historyRow._id); assert.equal(stored.rescheduleHistory.length, 20);
  });
  await t.test('replacement versus decision has one winner; stale loser never edits another proposal', async () => {
    const row = await make(); const first = (await propose(row)).body.data.rescheduleProposalId;
    const results = await Promise.all([propose(row, learner, { proposalId: first, scheduledAt: future(180).toISOString() }),
      decide(row, 'declineReschedule', tutor, first)]);
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
    const stored = await Session.findById(row._id);
    if (stored.rescheduleProposalId) assert.notEqual(stored.rescheduleProposalId, first);
    assert.equal(stored.rescheduleHistory.filter((event) => event.proposalId === first).length, 1);
  });
  await t.test('effective expiration uses exact boundary, earlier proposed start and original late window', async () => {
    const start = new Date('2026-10-09T07:00:00Z');
    const proposal = { rescheduleProposalId: randomUUID(), rescheduleProposedAt: new Date('2026-10-09T01:00:00Z'),
      proposedScheduledAt: start, scheduledAt: new Date('2026-10-09T06:00:00Z') };
    assert.equal(lifecycle.proposalExpired(proposal, new Date(start.getTime() - 1)), false);
    assert.equal(lifecycle.proposalExpired(proposal, start), true);
    assert.equal(lifecycle.presentSession(proposal, new Date('2026-10-09T09:00:00Z')).proposalStatus, 'expired', '3 PM proposal at 5 PM in Manila');
    const row = await make({ scheduledAt: new Date(Date.now() - 240 * 60000 - 1000),
      rescheduleProposalId: randomUUID(), rescheduleProposedBy: learner._id,
      rescheduleProposedAt: new Date(), proposedScheduledAt: future(), rescheduleExpiresAt: future() });
    const staleId = row.rescheduleProposalId;
    assert.equal((await decide(row, 'acceptReschedule', tutor, staleId)).statusCode, 409);
    assert.equal((await Session.findById(row._id)).rescheduleProposalId, undefined);
    assert.equal((await propose(row)).statusCode, 409);
    assert.equal((await invoke(controller.reportNoShow, row, learner)).statusCode, 200);
    assert.equal((await Session.findById(row._id)).noShowAbsent, 'both');
  });
  await t.test('expired proposal cannot indefinitely block no-show and actual attendance evidence is retained', async () => {
    const checked = new Date(Date.now() - 300 * 60000);
    const row = await make({ scheduledAt: checked, learnerCheckedInAt: checked,
      rescheduleProposalId: randomUUID(), rescheduleProposedBy: learner._id,
      rescheduleProposedAt: checked, proposedScheduledAt: future() });
    assert.equal((await invoke(controller.reportNoShow, row, tutor)).statusCode, 200);
    const stored = await Session.findById(row._id); assert.equal(stored.noShowAbsent, 'tutor');
    assert.equal(stored.learnerCheckedInAt.getTime(), checked.getTime());
    assert.equal(stored.rescheduleHistory.at(-1).outcome, 'expired');
  });
  await t.test('no-show versus stale acceptance/expiry races never move a missed original schedule', async () => {
    const row = await make({ scheduledAt: new Date(Date.now() - 300 * 60000),
      rescheduleProposalId: randomUUID(), rescheduleProposedBy: learner._id,
      rescheduleProposedAt: new Date(), proposedScheduledAt: future() });
    const results = await Promise.all([invoke(controller.reportNoShow, row, learner),
      decide(row, 'acceptReschedule', tutor, row.rescheduleProposalId)]);
    assert.equal(results[1].statusCode, 409);
    if (results[0].statusCode === 409) assert.equal((await invoke(controller.reportNoShow, row, learner)).statusCode, 200);
    else assert.equal(results[0].statusCode, 200);
    const stored = await Session.findById(row._id); assert.equal(stored.status, 'no_show');
    assert.equal(stored.scheduledAt.getTime(), row.scheduledAt.getTime());
    assert.equal(stored.rescheduleHistory.length, 1);
    assert.equal(await Notification.countDocuments({ relatedId: row._id, type: 'session.reschedule_expired' }), 2);
  });
  await t.test('check-in invalidates an alternative, locks the original schedule and keeps two-check-in start', async () => {
    const row = await make(); const id = (await propose(row)).body.data.rescheduleProposalId;
    const checked = await invoke(controller.checkIn, row, learner); assert.equal(checked.statusCode, 200);
    const stored = await Session.findById(row._id); assert.equal(stored.scheduledAt.getTime(), row.scheduledAt.getTime());
    assert.equal(stored.rescheduleProposalId, undefined); assert.ok(stored.learnerCheckedInAt); assert.equal(stored.startedAt, undefined);
    assert.equal(stored.rescheduleHistory.at(-1).outcome, 'check_in_locked');
    assert.equal(stored.rescheduleHistory.at(-1).actor.toString(), learner._id.toString());
    assert.equal((await decide(row, 'acceptReschedule', tutor, id)).statusCode, 409);
    assert.equal((await propose(row)).statusCode, 409);
    assert.equal((await invoke(controller.checkIn, row, tutor)).statusCode, 200);
    assert.equal((await Session.findById(row._id)).status, 'in_progress');
  });
  await t.test('concurrent check-ins close one pending alternative; refresh/retry preserves both attendance timestamps', async () => {
    const row = await make(); await propose(row);
    const results = await Promise.all([invoke(controller.checkIn, row, learner), invoke(controller.checkIn, row, tutor)]);
    for (let index = 0; index < results.length; index++) {
      if (results[index].statusCode === 409) assert.equal((await invoke(controller.checkIn, row, index ? tutor : learner)).statusCode, 200);
      else assert.equal(results[index].statusCode, 200);
    }
    const stored = await Session.findById(row._id); assert.equal(stored.status, 'in_progress');
    assert.ok(stored.learnerCheckedInAt && stored.tutorCheckedInAt && stored.startedAt);
    assert.equal(stored.rescheduleHistory.length, 1);
    assert.equal(await Notification.countDocuments({ relatedId: row._id, type: 'session.reschedule_check_in_locked' }), 1);
  });
  await t.test('genuine check-in versus acceptance races preserve the winning schedule and attendance', async () => {
    for (let index = 0; index < 10; index += 1) {
      const row = await make(); const proposed = await propose(row, learner, { scheduledAt: future(120 + index).toISOString() });
      const results = await Promise.all([invoke(controller.checkIn, row, learner),
        decide(row, 'acceptReschedule', tutor, proposed.body.data.rescheduleProposalId)]);
      assert.equal(results.filter((r) => r.statusCode === 200).length, 1);
      const stored = await Session.findById(row._id);
      if (stored.learnerCheckedInAt) assert.equal(stored.scheduledAt.getTime(), row.scheduledAt.getTime());
      else assert.equal(stored.scheduledAt.getTime(), new Date(proposed.body.data.proposedScheduledAt).getTime());
      assert.equal(stored.rescheduleProposalId, undefined);
    }
  });
  await t.test('original start passing permits a valid alternative until the original window closes', async () => {
    const row = await make({ scheduledAt: new Date(Date.now() - 60 * 60000) });
    const result = await propose(row); assert.equal(result.statusCode, 200);
    assert.equal((await decide(row, 'acceptReschedule', tutor, result.body.data.rescheduleProposalId)).statusCode, 200);
    const missing = await make({ status: 'accepted', scheduledAt: undefined });
    assert.equal((await invoke(controller.checkIn, missing, learner)).statusCode, 400);
    assert.equal((await invoke(controller.reportNoShow, missing, learner)).statusCode, 400);
    const proposal = await propose(missing); assert.equal(proposal.statusCode, 200);
    assert.equal((await decide(missing, 'acceptReschedule', tutor, proposal.body.data.rescheduleProposalId)).statusCode, 200);
  });
  await t.test('malformed legacy alternatives clear with generic in-app events, without inventing proposal times', async () => {
    const row = await make({ rescheduleProposalId: randomUUID(), rescheduleProposedBy: learner._id,
      proposedScheduledAt: undefined, rescheduleProposedAt: undefined });
    await lifecycle.expireProposal(row);
    assert.equal((await Session.findById(row._id)).rescheduleProposalId, undefined);
    const events = await Notification.find({ relatedId: row._id }); assert.equal(events.length, 2);
    assert.ok(events.every((event) => !event.proposal && event.emailStatus === 'none'));
  });
  await t.test('worker expiry is restart-safe and email failure/retry does not roll back Session/in-app events', async () => {
    const row = await make({ rescheduleProposalId: randomUUID(), rescheduleProposedBy: learner._id,
      rescheduleProposedAt: new Date(Date.now() - 25 * 3600000), proposedScheduledAt: future() });
    assert.equal(await reminders.scanExpiredProposals(new Date()), 1);
    assert.equal(await reminders.scanExpiredProposals(new Date()), 0);
    assert.equal(await Notification.countDocuments({ relatedId: row._id, type: 'session.reschedule_expired' }), 2);
    // Isolate the delivery batch inside this synthetic database for scan/restart assertions.
    await Notification.updateMany({}, { $set: { emailStatus: 'none' } });
    const mailRow = await make(); const result = await propose(mailRow);
    const event = await Notification.findOne({ relatedId: mailRow._id });
    process.env.BREVO_API_KEY = 'fixture-only'; process.env.MAIL_FROM = 'Acadova <fixture@example.test>';
    const now = new Date(); assert.equal(await reminders.retryEmail(now), 1);
    assert.equal((await Notification.findById(event._id)).emailStatus, 'failed');
    assert.equal((await Session.findById(mailRow._id)).rescheduleProposalId, result.body.data.rescheduleProposalId);
    assert.equal(await reminders.retryEmail(now), 0, 'Repeated scan respects backoff');
    mailFails = false;
    assert.equal(await reminders.retryEmail(new Date(now.getTime() + 6 * 60000)), 1);
    const accepted = await Notification.findById(event._id); assert.equal(accepted.emailStatus, 'accepted'); assert.equal(accepted.emailAttempts, 2);
    assert.equal(await notifications.deliverProposalEmail(event._id, new Date(now.getTime() + 60 * 60000)), false);
    mailFails = true;
    const capped = await Notification.create({ recipient: learner._id, type: 'session.reschedule_proposed', title: 'Fixture',
      message: 'Fixture', relatedType: 'Session', relatedId: mailRow._id, eventKey: randomUUID(), proposal: event.proposal,
      emailStatus: 'sending', emailAttempts: 3, emailAttemptedAt: new Date(now.getTime() - 11 * 60000) });
    assert.equal(await notifications.deliverProposalEmail(capped._id, now), false);
    assert.equal((await Notification.findById(capped._id)).emailStatus, 'exhausted');
    delete process.env.BREVO_API_KEY; delete process.env.MAIL_FROM;
  });
  await t.test('real authenticated routes deny outsiders/staff/unverified/malformed and accept exact withdrawal IDs', async () => {
    const app = express(); app.use(express.json()); app.use('/api/sessions', require('../routes/sessionRoutes'));
    server = await new Promise((resolve) => { const started = app.listen(0, '127.0.0.1', () => resolve(started)); });
    const row = await make(); const proposed = await propose(row); const id = proposed.body.data.rescheduleProposalId;
    const request = (actor, suffix, body, authenticated = true) => nativeFetch(`http://127.0.0.1:${server.address().port}/api/sessions/${row._id}${suffix}`, {
      method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${jwt.sign({ id: String(actor._id) }, process.env.JWT_SECRET)}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal((await request(learner, '', null, false)).status, 401);
    for (const actor of [stranger, moderator, unverified]) assert.equal((await request(actor, '')).status, 403);
    assert.equal((await request(learner, '/reschedule/withdraw', { proposalId: 'invalid' })).status, 400);
    assert.equal((await request(tutor, '/reschedule/withdraw', { proposalId: id })).status, 403);
    assert.equal((await request(learner, '/reschedule/withdraw', { proposalId: id })).status, 200);
    assert.equal((await request(learner, '/reschedule/withdraw', { proposalId: id })).status, 409);
    const forgedSubject = await nativeFetch(`http://127.0.0.1:${server.address().port}/api/sessions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt.sign({ id: String(learner._id) }, process.env.JWT_SECRET)}` },
      body: JSON.stringify({ tutorId: String(tutor._id), subject: 'Unsupported subject', scheduledAt: future().toISOString(),
        meetingMethod: 'online', requestMessage: 'Forged subject fixture.' }),
    });
    assert.equal(forgedSubject.status, 400);
    const postRequest = body => nativeFetch(`http://127.0.0.1:${server.address().port}/api/sessions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ id: String(learner._id) }, process.env.JWT_SECRET)}` }, body: JSON.stringify(body),
    });
    await User.updateOne({ _id: tutor._id }, { $set: { skillsToTeach: ['Java Arrays'] } });
    const onlineBody = { tutorId: String(tutor._id), subject: 'Java Arrays', scheduledAt: new Date(Date.now() + 20 * 86400000).toISOString() };
    const blank = await postRequest(onlineBody);
    assert.equal(blank.status, 201);
    const blankRow = await Session.findById((await blank.json()).data._id);
    assert.equal(blankRow.meetingMethod, 'online'); assert.equal(blankRow.requestMessage, '');
    const whitespace = await postRequest({ ...onlineBody, scheduledAt: new Date(Date.now() + 21 * 86400000).toISOString(), requestMessage: '   ' });
    assert.equal(whitespace.status, 201);
    const whitespaceRow = await Session.findById((await whitespace.json()).data._id);
    assert.equal(whitespaceRow.requestMessage, '');
    const count = await Session.countDocuments();
    for (const extra of [{ meetingMethod: 'in-person' }, { requestMessage: 'x'.repeat(501) }, { requestMessage: {} }, { location: 'Library' }]) {
      assert.equal((await postRequest({ ...onlineBody, ...extra })).status, 400);
    }
    assert.equal(await Session.countDocuments(), count);
  });
  await t.test('request/recovery/check-in/no-show/delivery never transfer credits', async () => {
    assert.equal(await CreditTransaction.countDocuments({}), 0);
    for (const actor of [learner, tutor]) assert.equal((await User.findById(actor._id)).credits, 100);
  });
});
