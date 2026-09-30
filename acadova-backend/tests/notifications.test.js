const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const SessionMessage = require('../models/SessionMessage');
const Session = require('../models/Session');
const sessionController = require('../controllers/sessionController');
const api = require('../controllers/notificationController');
const service = require('../services/notificationService');
const reminders = require('../services/notificationReminderService');

const alice = '507f1f77bcf86cd799439011';
const bob = '507f1f77bcf86cd799439012';
const sessionId = '507f1f77bcf86cd799439013';
const messageId = '507f1f77bcf86cd799439014';
const notificationId = '507f1f77bcf86cd799439015';
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; } });

test('Notification model has recipient, unread, and unique event-key indexes', () => {
  const indexes = Notification.schema.indexes();
  assert.ok(indexes.some(([keys, options]) => keys.eventKey === 1 && options.unique));
  assert.ok(indexes.some(([keys]) => keys.recipient === 1 && keys.createdAt === -1));
  assert.ok(indexes.some(([keys]) => keys.recipient === 1 && keys.readAt === 1));
  assert.ok(SessionMessage.schema.path('unreadForRecipient'));
  assert.ok(SessionMessage.schema.indexes().some(([keys]) => keys.unreadForRecipient === 1 && keys.createdAt === 1));
});

test('own-user list/count/read/all enforce ownership, ordering, bounds and safe response', async () => {
  const old = { find: Notification.find, count: Notification.countDocuments,
    update: Notification.findOneAndUpdate, findOne: Notification.findOne,
    all: Notification.updateMany };
  const filters = [];
  const row = { _id: notificationId, type: 'message.new', title: 'New session message',
    message: 'You have a new message.', relatedType: 'Session', relatedId: sessionId,
    readAt: null, createdAt: new Date() };
  Notification.countDocuments = async (filter) => { filters.push(filter); return 2; };
  Notification.find = (filter) => { filters.push(filter); return {
    select() { return this; }, sort(sort) { assert.deepEqual(sort, { createdAt: -1, _id: -1 }); return this; },
    skip(value) { assert.equal(value, 0); return this; }, limit(value) { assert.equal(value, 20); return this; },
    lean: async () => [row],
  }; };
  Notification.findOneAndUpdate = (filter) => { filters.push(filter); return { lean: async () => row }; };
  Notification.findOne = (filter) => { filters.push(filter); return { select() { return this; }, lean: async () => null }; };
  Notification.updateMany = async (filter) => { filters.push(filter); return { modifiedCount: 2 }; };
  const req = { user: { id: alice }, query: {}, params: { id: notificationId } };
  try {
    const list = response(); await api.listMine(req, list);
    assert.equal(list.body.data[0].href, `/sessions/${sessionId}`);
    assert.equal(list.body.data[0].pushIdempotencyKey, undefined);
    assert.equal(list.body.pagination.total, 2);
    const count = response(); await api.unreadCount(req, count); assert.equal(count.body.data.count, 2);
    const read = response(); await api.markRead(req, read); assert.equal(read.statusCode, 200);
    const all = response(); await api.markAllRead(req, all); assert.equal(all.body.data.updated, 2);
    assert.ok(filters.every((filter) => String(filter.recipient) === alice));
    const invalid = response(); await api.markRead({ ...req, params: { id: 'bad' } }, invalid);
    assert.equal(invalid.statusCode, 400);
    for (const query of [{ limit: '51' }, { page: '0' }, { recipient: bob }]) {
      const bad = response(); await api.listMine({ ...req, query }, bad); assert.equal(bad.statusCode, 400);
    }
    Notification.findOneAndUpdate = () => ({ lean: async () => null });
    const forbidden = response(); await api.markRead(req, forbidden); assert.equal(forbidden.statusCode, 404);
  } finally { Notification.find = old.find; Notification.countDocuments = old.count;
    Notification.findOneAndUpdate = old.update; Notification.findOne = old.findOne;
    Notification.updateMany = old.all; }
});

test('opaque push alias is deterministic per user, secret-dependent, and never a Mongo ID', () => {
  const previous = process.env.ONESIGNAL_IDENTITY_SECRET;
  try {
    process.env.ONESIGNAL_IDENTITY_SECRET = 'abcdefghijklmnopqrstuvwxyz123456';
    const first = service.pushAliasFor(alice);
    assert.equal(first, service.pushAliasFor(alice));
    assert.notEqual(first, service.pushAliasFor(bob));
    assert.ok(!first.includes(alice));
    const mine = response(); api.pushIdentity({ user: { id: alice } }, mine);
    assert.equal(mine.body.data.enabled, false); // no provider credentials in this test
    assert.equal(JSON.stringify(mine.body).includes(process.env.ONESIGNAL_IDENTITY_SECRET), false);
  } finally { if (previous === undefined) delete process.env.ONESIGNAL_IDENTITY_SECRET;
    else process.env.ONESIGNAL_IDENTITY_SECRET = previous; }
});

test('authenticated push identity returns only this user opaque alias when configured', () => {
  const old = [process.env.ONESIGNAL_APP_ID, process.env.ONESIGNAL_REST_API_KEY,
    process.env.ONESIGNAL_IDENTITY_SECRET];
  process.env.ONESIGNAL_APP_ID = 'test-app';
  process.env.ONESIGNAL_REST_API_KEY = 'private-key';
  process.env.ONESIGNAL_IDENTITY_SECRET = 'abcdefghijklmnopqrstuvwxyz123456';
  try {
    const result = response(); api.pushIdentity({ user: { id: alice } }, result);
    assert.equal(result.body.data.alias, service.pushAliasFor(alice));
    assert.ok(!JSON.stringify(result.body).includes('private-key'));
    assert.ok(!JSON.stringify(result.body).includes(alice));
  } finally {
    ['ONESIGNAL_APP_ID', 'ONESIGNAL_REST_API_KEY', 'ONESIGNAL_IDENTITY_SECRET'].forEach((key, i) => {
      if (old[i] === undefined) delete process.env[key]; else process.env[key] = old[i];
    });
  }
});

test('publish dedupes common retries and stores safe generic content', async () => {
  const old = { create: Notification.create, find: Notification.findOne };
  const writes = [];
  Notification.create = async (entry) => {
    if (writes.length) { const error = new Error('duplicate'); error.code = 11000; throw error; }
    writes.push(entry); return { ...entry, _id: notificationId };
  };
  Notification.findOne = () => ({ lean: async () => ({ _id: notificationId }) });
  const event = { recipient: bob, type: 'session.accepted', relatedType: 'Session',
    relatedId: sessionId, eventKey: `session.accepted:${sessionId}:${bob}`, deferPush: true };
  try {
    assert.equal((await service.publish(event)).created, true);
    assert.equal((await service.publish(event)).created, false);
    assert.equal(writes.length, 1);
    assert.equal(JSON.stringify(writes).includes('password'), false);
    assert.equal(writes[0].recipient, bob);
    await assert.rejects(service.publish({ ...event, type: 'evil' }));
  } finally { Notification.create = old.create; Notification.findOne = old.find; }
});

test('missing push credentials keeps in-app record and marks push skipped', async () => {
  const old = { find: Notification.findOneAndUpdate, update: Notification.updateOne };
  const env = [process.env.ONESIGNAL_APP_ID, process.env.ONESIGNAL_REST_API_KEY];
  const updates = [];
  Notification.findOneAndUpdate = () => ({ lean: async () => ({ _id: notificationId, recipient: bob }) });
  Notification.updateOne = async (_, update) => { updates.push(update); return {}; };
  delete process.env.ONESIGNAL_APP_ID; delete process.env.ONESIGNAL_REST_API_KEY;
  try {
    assert.equal(await service.deliverPush(notificationId), false);
    assert.equal(updates[0].$set.pushStatus, 'skipped');
  } finally {
    Notification.findOneAndUpdate = old.find; Notification.updateOne = old.update;
    if (env[0] === undefined) delete process.env.ONESIGNAL_APP_ID;
    else process.env.ONESIGNAL_APP_ID = env[0];
    if (env[1] === undefined) delete process.env.ONESIGNAL_REST_API_KEY;
    else process.env.ONESIGNAL_REST_API_KEY = env[1];
  }
});

test('OneSignal receives only opaque recipient alias and safe content; provider failure preserves record', async () => {
  const original = { find: Notification.findOneAndUpdate, update: Notification.updateOne,
    fetch: global.fetch, app: process.env.ONESIGNAL_APP_ID, key: process.env.ONESIGNAL_REST_API_KEY,
    secret: process.env.ONESIGNAL_IDENTITY_SECRET, frontend: process.env.FRONTEND_URL };
  process.env.ONESIGNAL_APP_ID = 'test-app';
  process.env.ONESIGNAL_REST_API_KEY = 'backend-only-test-key';
  process.env.ONESIGNAL_IDENTITY_SECRET = 'abcdefghijklmnopqrstuvwxyz123456';
  process.env.FRONTEND_URL = 'https://acadova.example.test';
  const statuses = []; const calls = [];
  Notification.findOneAndUpdate = () => ({ lean: async () => ({ _id: notificationId,
    recipient: bob, relatedType: 'Session', relatedId: sessionId,
    title: 'New tutoring request', message: 'A learner requested a tutoring session.',
    pushIdempotencyKey: 'safe-idempotency-key' }) });
  Notification.updateOne = async (_, update) => { statuses.push(update.$set.pushStatus); return {}; };
  global.fetch = async (url, options) => { calls.push({ url, options });
    return { ok: false, json: async () => ({ errors: ['private provider response'] }) }; };
  try {
    assert.equal(await service.deliverPush(notificationId), false);
    assert.equal(statuses[0], 'failed');
    assert.equal(calls[0].url, 'https://api.onesignal.com/notifications');
    const body = JSON.parse(calls[0].options.body);
    assert.deepEqual(body.include_aliases.external_id, [service.pushAliasFor(bob)]);
    assert.ok(!calls[0].options.body.includes(bob));
    assert.equal(body.web_url, `https://acadova.example.test/sessions/${sessionId}`);
    assert.equal(body.contents.en, 'A learner requested a tutoring session.');
    assert.equal(calls[0].options.headers.Authorization, 'Key backend-only-test-key');
    assert.ok(!JSON.stringify(statuses).includes('private provider response'));
  } finally {
    Notification.findOneAndUpdate = original.find; Notification.updateOne = original.update;
    global.fetch = original.fetch;
    for (const [name, value] of [
      ['ONESIGNAL_APP_ID', original.app], ['ONESIGNAL_REST_API_KEY', original.key],
      ['ONESIGNAL_IDENTITY_SECRET', original.secret], ['FRONTEND_URL', original.frontend],
    ]) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
});

test('upcoming scan selects only active due sessions and dedupes each occurrence', async () => {
  const old = { find: Session.find, create: Notification.create, findOne: Notification.findOne,
    claim: Notification.findOneAndUpdate };
  const now = new Date(); const scheduledAt = new Date(now.getTime() + 30 * 60 * 1000);
  const keys = new Set(); const filters = [];
  Session.find = (filter) => { filters.push(filter); return { select() { return this; },
    limit() { return this; }, lean: async () => [{ _id: sessionId, learner: alice, tutor: bob, scheduledAt }] }; };
  Notification.create = async (entry) => {
    if (keys.has(entry.eventKey)) { const error = new Error('duplicate'); error.code = 11000; throw error; }
    keys.add(entry.eventKey); return { _id: notificationId };
  };
  Notification.findOne = () => ({ lean: async () => ({ _id: notificationId }) });
  Notification.findOneAndUpdate = () => ({ lean: async () => null });
  try {
    assert.equal(await reminders.scanUpcoming(now), 2);
    assert.equal(await reminders.scanUpcoming(now), 0);
    assert.deepEqual(filters[0].status.$in, ['scheduled', 'accepted']);
    assert.equal(keys.size, 2);
    assert.ok([...keys].every((key) => key.includes(scheduledAt.toISOString())));
  } finally { Session.find = old.find; Notification.create = old.create;
    Notification.findOne = old.findOne; Notification.findOneAndUpdate = old.claim; }
});

test('thread read clears unread messages and message notifications for the recipient', async () => {
  const old = { messageUpdate: SessionMessage.updateMany, notificationUpdate: Notification.updateMany };
  const filters = [];
  SessionMessage.updateMany = async (filter) => { filters.push(filter); return {}; };
  Notification.updateMany = async (filter) => { filters.push(filter); return {}; };
  try {
    await service.markThreadRead(sessionId, alice);
    assert.equal(filters[0].sender.$ne, alice);
    assert.equal(filters[0].unreadForRecipient, true);
    assert.equal(filters[1].recipient, alice);
    assert.deepEqual(filters[1].type.$in, ['message.new', 'message.unread_reminder']);
  } finally { SessionMessage.updateMany = old.messageUpdate;
    Notification.updateMany = old.notificationUpdate; }
});

test('message cooldown suppresses another notification while leaving chat writes outside the service', async () => {
  const old = { state: mongoose.connection.readyState, find: Notification.findOne,
    message: SessionMessage.findOne, publish: service.publish };
  mongoose.connection.readyState = 1;
  let previous = false; const published = [];
  Notification.findOne = () => ({ select() { return this; }, lean: async () => previous ? { _id: notificationId } : null });
  SessionMessage.findOne = () => ({ sort() { return this; }, select() { return this; },
    lean: async () => ({ _id: messageId }) });
  service.publish = async (event) => { published.push(event); return { created: true }; };
  try {
    await service.notifyMessage({ _id: sessionId }, { _id: messageId }, bob);
    previous = true;
    await service.notifyMessage({ _id: sessionId }, { _id: notificationId }, bob);
    assert.equal(published.length, 1);
    assert.equal(published[0].recipient, bob);
    assert.equal(published[0].type, 'message.new');
    assert.equal(published[0].relatedId, sessionId);
  } finally {
    mongoose.connection.readyState = old.state; Notification.findOne = old.find;
    SessionMessage.findOne = old.message; service.publish = old.publish;
  }
});

test('session notifications dedupe participants and use stable event keys', async () => {
  const old = { state: mongoose.connection.readyState, publish: service.publish };
  mongoose.connection.readyState = 1; const events = [];
  service.publish = async (event) => { events.push(event); return { created: true }; };
  try {
    await service.notifySession('session.resolved', { _id: sessionId }, [alice, bob, alice]);
    assert.equal(events.length, 2);
    assert.deepEqual(events.map((event) => event.recipient).sort(), [alice, bob]);
    assert.equal(events[0].eventKey, `session.resolved:${sessionId}:${alice}:`);
  } finally { mongoose.connection.readyState = old.state; service.publish = old.publish; }
});

test('accepted/declined Session decisions notify only Learner after successful mutation', async () => {
  const old = { find: Session.findById, update: Session.findOneAndUpdate,
    notify: service.notifySession };
  const events = []; let changed = true; let stored;
  Session.findById = async () => ({ ...stored });
  Session.findOneAndUpdate = async (_, update) => changed ? {
    ...stored, ...update.$set, async populate() {},
  } : null;
  service.notifySession = async (type, session, recipients) => { events.push({ type, recipients }); };
  try {
    for (const [status, expected] of [['accepted', 'session.accepted'], ['declined', 'session.declined']]) {
      stored = { _id: sessionId, learner: alice, tutor: bob, status: 'pending' };
      const result = response();
      await sessionController.updateSessionStatus({ params: { id: sessionId }, user: { id: bob },
        body: { status } }, result);
      assert.equal(result.statusCode, 200);
      assert.equal(events.at(-1).type, expected);
      assert.deepEqual(events.at(-1).recipients, [alice]);
    }
    const count = events.length; changed = false;
    const conflict = response();
    await sessionController.updateSessionStatus({ params: { id: sessionId }, user: { id: bob },
      body: { status: 'accepted' } }, conflict);
    assert.equal(conflict.statusCode, 409);
    assert.equal(events.length, count);
    const outsider = response();
    await sessionController.updateSessionStatus({ params: { id: sessionId }, user: { id: notificationId },
      body: { status: 'accepted' } }, outsider);
    assert.equal(outsider.statusCode, 403);
    assert.equal(events.length, count);
  } finally { Session.findById = old.find; Session.findOneAndUpdate = old.update;
    service.notifySession = old.notify; }
});

test('Session message write notifies peer only and outsider cannot create a message', async () => {
  const old = { find: Session.findById, create: SessionMessage.create,
    notify: service.notifyMessage };
  const written = []; const recipients = [];
  Session.findById = async () => ({ _id: sessionId, learner: alice, tutor: bob, status: 'accepted' });
  SessionMessage.create = async (entry) => { written.push(entry); return { _id: messageId,
    async populate() {} }; };
  service.notifyMessage = async (_, __, recipient) => { recipients.push(String(recipient)); };
  try {
    const valid = response();
    await sessionController.createMessage({ params: { id: sessionId }, user: { id: alice },
      body: { body: 'Hello' } }, valid);
    assert.equal(valid.statusCode, 201);
    assert.equal(written.length, 1);
    assert.deepEqual(recipients, [bob]);
    const outsider = response();
    await sessionController.createMessage({ params: { id: sessionId }, user: { id: notificationId },
      body: { body: 'No' } }, outsider);
    assert.equal(outsider.statusCode, 403);
    assert.equal(written.length, 1);
    assert.equal(recipients.length, 1);
  } finally { Session.findById = old.find; SessionMessage.create = old.create;
    service.notifyMessage = old.notify; }
});

test('reschedule proposal and decisions notify peer/proposer only after persistence', async () => {
  const old = { find: Session.findById, update: Session.findOneAndUpdate,
    notify: service.notifySession, invalidate: service.invalidateUpcoming };
  const events = []; let stored; let allow = true; let invalidations = 0;
  Session.findById = async () => ({ ...stored });
  Session.findOneAndUpdate = async (_, update) => allow ? {
    ...stored, ...(update.$set || {}), async populate() {},
  } : null;
  service.notifySession = async (type, _, recipients) => { events.push({ type, recipients }); };
  service.invalidateUpcoming = async () => { invalidations += 1; };
  const req = (actor, body) => ({ params: { id: sessionId }, user: { id: actor }, body });
  try {
    stored = { _id: sessionId, learner: alice, tutor: bob, status: 'accepted',
      scheduledAt: new Date(Date.now() + 86_400_000) };
    const proposed = response();
    await sessionController.proposeReschedule(req(alice, {
      scheduledAt: new Date(Date.now() + 172_800_000).toISOString(),
    }), proposed);
    assert.equal(proposed.statusCode, 200);
    assert.deepEqual(events.at(-1), { type: 'session.reschedule_proposed', recipients: [bob] });
    for (const [handler, type, expectedInvalidations] of [
      [sessionController.acceptReschedule, 'session.reschedule_accepted', 1],
      [sessionController.declineReschedule, 'session.reschedule_declined', 1],
    ]) {
      stored = { ...stored, rescheduleProposalId: 'proposal-1', rescheduleProposedBy: alice,
        proposedScheduledAt: new Date(Date.now() + 172_800_000) };
      const decision = response(); await handler(req(bob, { proposalId: 'proposal-1' }), decision);
      assert.equal(decision.statusCode, 200);
      assert.deepEqual(events.at(-1), { type, recipients: [alice] });
      assert.equal(invalidations, expectedInvalidations);
    }
    allow = false; const count = events.length;
    const conflict = response(); await sessionController.declineReschedule(req(bob, { proposalId: 'proposal-1' }), conflict);
    assert.equal(conflict.statusCode, 409); assert.equal(events.length, count);
  } finally { Session.findById = old.find; Session.findOneAndUpdate = old.update;
    service.notifySession = old.notify; service.invalidateUpcoming = old.invalidate; }
});

test('finishing a checked-in Session notifies both participants of validation', async () => {
  const old = { find: Session.findById, update: Session.findOneAndUpdate,
    notify: service.notifySession };
  const now = new Date(); const events = [];
  const stored = { _id: sessionId, learner: alice, tutor: bob, status: 'in_progress',
    startedAt: now, learnerCheckedInAt: now, tutorCheckedInAt: now };
  Session.findById = async () => ({ ...stored });
  Session.findOneAndUpdate = async (_, update) => ({ ...stored, ...update.$set, async populate() {} });
  service.notifySession = async (type, _, recipients) => { events.push({ type, recipients }); };
  try {
    const result = response(); await sessionController.finishSession({ params: { id: sessionId },
      user: { id: bob }, body: {} }, result);
    assert.equal(result.statusCode, 200);
    assert.deepEqual(events, [{ type: 'session.awaiting_validation', recipients: [alice, bob] }]);
  } finally { Session.findById = old.find; Session.findOneAndUpdate = old.update;
    service.notifySession = old.notify; }
});

test('unread worker produces one reminder per unread burst and none after read', async () => {
  const old = { aggregate: SessionMessage.aggregate, exists: SessionMessage.exists,
    session: Session.findById, create: Notification.create, find: Notification.findOne,
    claim: Notification.findOneAndUpdate };
  const keys = new Set(); let unread = true;
  SessionMessage.aggregate = async () => [{ _id: { session: sessionId, sender: alice }, firstMessageId: messageId }];
  SessionMessage.exists = async () => unread;
  Session.findById = () => ({ select() { return this; }, lean: async () => ({ _id: sessionId,
    learner: alice, tutor: bob }) });
  Notification.create = async (entry) => {
    if (keys.has(entry.eventKey)) { const error = new Error('duplicate'); error.code = 11000; throw error; }
    keys.add(entry.eventKey); return { _id: notificationId };
  };
  Notification.findOne = () => ({ lean: async () => ({ _id: notificationId }) });
  Notification.findOneAndUpdate = () => ({ lean: async () => null });
  try {
    assert.equal(await reminders.scanUnreadMessages(new Date()), 1);
    assert.equal(await reminders.scanUnreadMessages(new Date()), 0);
    unread = false;
    assert.equal(await reminders.scanUnreadMessages(new Date()), 0);
    assert.equal(keys.size, 1);
    assert.ok([...keys][0].includes(bob));
  } finally {
    SessionMessage.aggregate = old.aggregate; SessionMessage.exists = old.exists;
    Session.findById = old.session; Notification.create = old.create;
    Notification.findOne = old.find; Notification.findOneAndUpdate = old.claim;
  }
});
