const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../models/User');
const Session = require('../models/Session');
const CreditConfig = require('../models/CreditConfig');
const CreditTransaction = require('../models/CreditTransaction');
const AuditLog = require('../models/AuditLog');
const LearningModule = require('../models/LearningModule');
const LearningResource = require('../models/LearningResource');
const LearningTopic = require('../models/LearningTopic');
const LearningUnlock = require('../models/LearningUnlock');
const controller = require('../controllers/sessionController');
const learning = require('../controllers/learningController');
const admin = require('../controllers/adminController');
const { recordAudit, ACTIONS } = require('../services/auditService');
const { normalizeSubject } = require('../services/sessionRequestIntegrity');
const notifications = require('../services/notificationService');
const learner = '507f1f77bcf86cd799439011';
const tutor = '507f1f77bcf86cd799439012';
const other = '507f1f77bcf86cd799439013';
const instant = () => new Date(Date.now() + 86400000);
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; } });
const replace = (t, object, key, value) => { const old = object[key]; object[key] = value; t.after(() => { object[key] = old; }); };
const equal = (a, b) => a instanceof Date || b instanceof Date ? new Date(a).getTime() === new Date(b).getTime() : String(a).toLowerCase() === String(b).toLowerCase();
function matches(row, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some((part) => matches(row, part));
    if (expected === null) return row[key] == null;
    if (expected?.$in) return expected.$in.some((value) => equal(row[key], value));
    if (expected?.$ne) return !equal(row[key], expected.$ne);
    return equal(row[key], expected);
  });
}
function store(t, rows = []) {
  const locks = []; const events = []; const payments = [];
  let queue = Promise.resolve();
  replace(t, mongoose, 'startSession', async () => ({ async withTransaction(fn) {
    const previous = queue; let release; queue = new Promise((resolve) => { release = resolve; });
    await previous;
    const snapshot = rows.map((row) => ({ ...row }));
    try { await fn(); } catch (error) { rows.splice(0, rows.length, ...snapshot); throw error; }
    finally { release(); }
  }, async endSession() {} }));
  replace(t, User, 'findOneAndUpdate', (filter, update, options) => ({ select: async () => {
    assert.ok(options.session); assert.deepEqual(update, { $currentDate: { updatedAt: true } });
    assert.equal(options.timestamps, false); locks.push(String(filter._id)); return { _id: filter._id };
  } }));
  replace(t, CreditConfig, 'findById', () => ({ lean: async () => null }));
  const query = (data) => ({ session(value) { assert.ok(value); return this; }, lean: async () => data });
  replace(t, Session, 'find', (filter) => query(rows.filter((row) => matches(row, filter))));
  replace(t, Session, 'exists', (filter) => ({ session: async (value) => {
    assert.ok(value); return rows.find((row) => matches(row, filter)) || null;
  } }));
  replace(t, Session, 'findById', async (id) => {
    const row = rows.find((item) => item._id === id); return row ? { ...row, async populate() {} } : null;
  });
  replace(t, Session, 'create', async ([body], options) => {
    assert.ok(options.session);
    const row = { _id: new mongoose.Types.ObjectId().toString(), status: 'pending', ...body, async populate() {} };
    rows.push(row); return [row];
  });
  replace(t, Session, 'findOneAndUpdate', async (filter, update, options) => {
    const row = rows.find((item) => matches(item, filter)); if (!row) return null;
    Object.assign(row, update.$set || {}); for (const key of Object.keys(update.$unset || {})) delete row[key];
    return { ...row, async populate() {} };
  });
  replace(t, CreditTransaction, 'find', (filter) => query(payments.filter((row) => matches(row, filter))));
  replace(t, CreditTransaction, 'create', async () => assert.fail('Request/accept/cancel must never settle'));
  replace(t, notifications, 'notifySession', async (type, session) => events.push({ type, id: session._id }));
  replace(t, notifications, 'invalidateUpcoming', async () => {});
  const create = async (overrides = {}) => {
    const res = response(); await controller.createSession({ user: { id: learner, credits: 100 }, body: {
      tutorId: tutor, subject: 'Java', scheduledAt: instant().toISOString(), meetingMethod: 'online',
      requestMessage: 'Help with arrays.', ...overrides,
    } }, res); return res;
  };
  const status = async (row, value, actor = row.tutor) => {
    const res = response(); await controller.updateSessionStatus({ params: { id: row._id },
      user: { id: actor }, body: { status: value } }, res); return res;
  };
  return { rows, locks, events, payments, create, status };
}

test('normalized exact immediate/concurrent replays create one request and one notification', async (t) => {
  const fixture = store(t); const scheduledAt = instant().toISOString();
  assert.equal(normalizeSubject('  ＪＡＶＡ   Arrays '), 'java arrays');
  const results = await Promise.all([fixture.create({ subject: '  Java   Arrays ', scheduledAt }),
    fixture.create({ subject: 'java arrays', scheduledAt })]);
  assert.deepEqual(results.map((res) => res.statusCode).sort(), [201, 409]);
  assert.equal(fixture.rows.length, 1); assert.equal(fixture.events.length, 1);
  assert.deepEqual(fixture.locks, [learner, tutor, learner, tutor]);
  const repeated = await fixture.create({ subject: 'JAVA ARRAYS', scheduledAt });
  assert.equal(repeated.statusCode, 409); assert.match(repeated.body.message, /already have/);
});

test('another date/tutor/subject and closed historical interactions remain legitimate', async (t) => {
  const fixture = store(t); const scheduledAt = instant().toISOString();
  assert.equal((await fixture.create({ scheduledAt })).statusCode, 201);
  assert.equal((await fixture.create({ scheduledAt: new Date(new Date(scheduledAt).getTime() + 86400000).toISOString() })).statusCode, 201);
  assert.equal((await fixture.create({ tutorId: other, scheduledAt })).statusCode, 201);
  assert.equal((await fixture.create({ subject: 'Python', scheduledAt })).statusCode, 201);
  for (const status of ['declined', 'rejected', 'cancelled', 'resolved', 'completed']) {
    fixture.rows.splice(0, fixture.rows.length, { _id: other, learner, tutor, subject: 'Java', status,
      scheduledAt: new Date(scheduledAt), creditAmount: 20 });
    fixture.payments.splice(0);
    if (status === 'completed') fixture.payments.push({ session: other, fromUser: learner, toUser: tutor, amount: 20, type: 'session_payment' });
    assert.equal((await fixture.create({ scheduledAt })).statusCode, 201, status);
  }
});

test('in-flight/no-show/disputed/unsettled completion and pending proposed time reject replay', async (t) => {
  const fixture = store(t); const date = instant();
  for (const status of ['pending', 'accepted', 'scheduled', 'in_progress', 'awaiting_validation', 'no_show', 'disputed', 'completed']) {
    fixture.rows.splice(0, fixture.rows.length, { _id: other, learner, tutor, subject: 'Java', status,
      scheduledAt: date, creditAmount: 20 });
    assert.equal((await fixture.create({ scheduledAt: date.toISOString() })).statusCode, 409, status);
  }
  fixture.rows[0] = { ...fixture.rows[0], status: 'scheduled', scheduledAt: instant(), proposedScheduledAt: date };
  assert.equal((await fixture.create({ scheduledAt: date.toISOString() })).statusCode, 409);
});

test('exact-time commitments check both contextual sides; pending alternatives remain allowed', async (t) => {
  const fixture = store(t); const date = instant();
  for (const side of ['learner', 'tutor']) {
    const pending = { _id: learner, learner, tutor, subject: 'Java', status: 'pending', scheduledAt: date };
    fixture.rows.splice(0, fixture.rows.length, pending,
      { _id: other, learner: other, tutor: other, [side]: learner, status: 'scheduled', scheduledAt: date });
    assert.equal((await fixture.status(pending, 'scheduled')).statusCode, 409, side);
    assert.equal(pending.status, 'pending');
    fixture.rows[1].status = 'pending';
    assert.equal((await fixture.status(fixture.rows[0], 'scheduled')).statusCode, 200);
  }
});

test('concurrent different-subject requests can both be pending but only one commits at exact time', async (t) => {
  const fixture = store(t); const date = instant().toISOString();
  await fixture.create({ scheduledAt: date }); await fixture.create({ subject: 'Python', scheduledAt: date });
  const decisions = await Promise.all(fixture.rows.map((row) => fixture.status(row, 'scheduled')));
  assert.deepEqual(decisions.map((res) => res.statusCode).sort(), [200, 409]);
  assert.equal(fixture.rows.filter((row) => row.status === 'scheduled').length, 1);
});

test('accepted reschedule conflicts preserve proposal and original time; different time succeeds', async (t) => {
  const fixture = store(t); const date = instant();
  const row = { _id: learner, learner, tutor, status: 'scheduled', scheduledAt: date,
    proposedScheduledAt: new Date(date.getTime() + 86400000), rescheduleProposalId: 'proposal', rescheduleProposedBy: learner };
  fixture.rows.push(row, { _id: other, learner: other, tutor, status: 'accepted', scheduledAt: row.proposedScheduledAt });
  const invoke = async () => { const res = response(); await controller.acceptReschedule({ params: { id: learner },
    user: { id: tutor }, body: { proposalId: 'proposal' } }, res); return res; };
  assert.equal((await invoke()).statusCode, 409);
  assert.equal(fixture.rows[0].scheduledAt, date); assert.equal(fixture.rows[0].rescheduleProposalId, 'proposal');
  fixture.rows[1].scheduledAt = new Date(date.getTime() + 172800000);
  assert.equal((await invoke()).statusCode, 200);
  assert.equal(fixture.rows[0].rescheduleProposalId, undefined);
});

test('scheduled cancellation allows either participant; denies outsiders/states/check-ins/start/settlement', async (t) => {
  const fixture = store(t);
  const fresh = () => ({ _id: other, learner, tutor, status: 'scheduled', scheduledAt: instant(), rescheduleProposalId: 'pending' });
  for (const actor of [learner, tutor]) {
    fixture.rows.splice(0, fixture.rows.length, fresh());
    assert.equal((await fixture.status(fixture.rows[0], 'cancelled', actor)).statusCode, 200);
    assert.equal(fixture.rows[0].status, 'cancelled'); assert.equal(fixture.rows[0].rescheduleProposalId, undefined);
    assert.equal(fixture.events.at(-1).type, 'session.cancelled');
  }
  fixture.rows.splice(0, fixture.rows.length, fresh());
  assert.equal((await fixture.status(fixture.rows[0], 'cancelled', other)).statusCode, 403);
  for (const field of ['learnerCheckedInAt', 'tutorCheckedInAt', 'startedAt', 'creditsSettledAt', 'confirmedAt']) {
    fixture.rows[0] = { ...fresh(), [field]: new Date() };
    assert.equal((await fixture.status(fixture.rows[0], 'cancelled', learner)).statusCode, 400, field);
  }
  for (const status of ['in_progress', 'awaiting_validation', 'completed', 'resolved', 'no_show']) {
    fixture.rows[0] = { ...fresh(), status };
    assert.equal((await fixture.status(fixture.rows[0], 'cancelled', learner)).statusCode, 400, status);
  }
});

test('check-in racing with cancellation prevents the conditional cancellation write', async (t) => {
  const fixture = store(t, [{ _id: other, learner, tutor, status: 'scheduled' }]);
  replace(t, Session, 'findOneAndUpdate', async (filter) => {
    assert.equal(filter.learnerCheckedInAt, null); assert.equal(filter.tutorCheckedInAt, null);
    assert.equal(filter.startedAt, null); fixture.rows[0].learnerCheckedInAt = new Date(); return null;
  });
  assert.equal((await fixture.status(fixture.rows[0], 'cancelled', learner)).statusCode, 409);
  assert.equal(fixture.events.length, 0); assert.equal(fixture.rows[0].status, 'scheduled');
});

test('standalone resource ownership applies inside a free module without granting other content', async (t) => {
  const resources = [{ _id: learner, topic: other, title: 'Owned resource', resourceType: 'text', creditCost: 25, textContent: 'Owned body' },
    { _id: tutor, topic: other, title: 'Locked resource', resourceType: 'text', creditCost: 25, textContent: 'Private body' }];
  let moduleCost = 0; let ownedModule = false;
  replace(t, LearningModule, 'findOne', () => ({ lean: async () => ({ _id: other, topic: other, creditCost: moduleCost, resources: [learner, tutor] }) }));
  replace(t, LearningTopic, 'exists', async () => true);
  replace(t, LearningResource, 'find', () => ({ lean: async () => resources }));
  replace(t, LearningUnlock, 'exists', async () => ownedModule);
  replace(t, LearningUnlock, 'find', () => ({ select() { return this; }, lean: async () => [{ resource: learner }] }));
  replace(t, LearningUnlock, 'create', async () => assert.fail('Viewing must not create standalone ownership'));
  const invoke = async () => { const res = response(); await learning.getModule({ params: { id: other }, user: { id: learner } }, res); return res; };
  const free = await invoke(); assert.equal(free.statusCode, 200);
  assert.equal(free.body.data.resources[0].locked, false); assert.equal(free.body.data.resources[0].textContent, 'Owned body');
  assert.equal(free.body.data.resources[1].locked, true); assert.equal(free.body.data.resources[1].textContent, undefined);
  moduleCost = 50;
  const locked = await invoke(); assert.equal(locked.body.data.locked, true); assert.equal(locked.body.data.resources, undefined);
  ownedModule = true;
  const owned = await invoke(); assert.ok(owned.body.data.resources.every((row) => row.locked === false));
});

test('suspension reason stays in bounded privileged audit evidence after reactivation', async (t) => {
  const events = []; let account = { _id: tutor, role: 'student', suspendedAt: null };
  replace(t, mongoose, 'startSession', async () => ({ withTransaction: async (fn) => fn(), endSession: async () => {} }));
  replace(t, User, 'findById', () => ({ select() { return this; }, session() { return this; }, lean: async () => account }));
  replace(t, User, 'findOneAndUpdate', (_, update) => ({ select: async () => { account = { ...account, ...update.$set }; return account; } }));
  replace(t, AuditLog, 'create', async ([entry]) => { events.push(entry); return [entry]; });
  replace(t, notifications, 'notifySafely', async () => {});
  const invoke = async (status) => { const res = response(); await admin.updateUserStatus({ params: { id: tutor }, user: { id: learner, role: 'admin' },
    body: { status, reason: 'Repeated inappropriate content.' } }, res); return res; };
  assert.equal((await invoke('suspended')).statusCode, 200);
  assert.equal((await invoke('active')).statusCode, 200);
  assert.equal(account.suspensionReason, null);
  assert.equal(events[0].metadata.suspensionReason, 'Repeated inappropriate content.');
  assert.equal(events[1].metadata.suspensionReason, undefined);
  await recordAudit({ actor: { id: learner, role: 'admin' }, action: ACTIONS.suspended, targetType: 'User', targetId: tutor,
    summary: 'Account suspended', metadata: { suspensionReason: 'x'.repeat(1000), password: 'secret' } });
  assert.equal(events[2].metadata.suspensionReason.length, 500); assert.equal(events[2].metadata.password, undefined);
  const publicController = require('node:fs').readFileSync(require.resolve('../controllers/userController'), 'utf8');
  assert.doesNotMatch(publicController, /select\([^)]*suspensionReason/);
});


test('legacy unscheduled acceptance does not invent an exact-time commitment conflict', async (t) => {
  const row = { _id: other, learner, tutor, status: 'pending' };
  const fixture = store(t, [row]);
  replace(t, Session, 'exists', () => assert.fail('No instant means no exact-time comparison'));
  assert.equal((await fixture.status(row, 'accepted')).statusCode, 200);
});

test('public peer response excludes suspension reason and privileged audit metadata', async (t) => {
  const users = require('../controllers/userController');
  replace(t, User, 'findOne', () => ({ select: async (fields) => {
    const row = { _id: tutor, name: 'Student', role: 'student', suspensionReason: 'Private reason',
      metadata: { suspensionReason: 'Historical private reason' } };
    assert.equal(fields.includes('suspensionReason'), false);
    assert.equal(fields.includes('metadata'), false);
    const allowed = new Set(['_id', ...fields.split(' ')]);
    return Object.fromEntries(Object.entries(row).filter(([key]) => allowed.has(key)));
  } }));
  const Rating = require('../models/Rating'); replace(t, Rating, 'aggregate', async () => []);
  const res = response(); await users.getUserById({ params: { id: tutor } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.suspensionReason, undefined); assert.equal(res.body.data.metadata, undefined);
  assert.doesNotMatch(JSON.stringify(res.body), /Private reason|Historical private reason/);
});
