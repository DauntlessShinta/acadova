const test = require('node:test');
const assert = require('node:assert/strict');
const Session = require('../models/Session');
const SessionMessage = require('../models/SessionMessage');
const controller = require('../controllers/sessionController');

const originalFindById = Session.findById;
const originalFindOneAndUpdate = Session.findOneAndUpdate;
const originalMessageCreate = SessionMessage.create;

test.afterEach(() => {
  Session.findById = originalFindById;
  Session.findOneAndUpdate = originalFindOneAndUpdate;
  SessionMessage.create = originalMessageCreate;
});

const response = () => ({
  statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});
const sessionDoc = (overrides = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  learner: '507f1f77bcf86cd799439012',
  tutor: '507f1f77bcf86cd799439013',
  status: 'scheduled',
  scheduledAt: new Date(Date.now() + 5 * 60000),
  meetingMethod: 'online',
  meetingLink: 'https://meet.example.com/room',
  async populate() {},
  ...overrides,
});
const comparable = (value) => value instanceof Date ? value.getTime() : String(value);
const matches = (stored, filter) => Object.entries(filter).every(([key, expected]) => {
  const actual = stored[key];
  if (expected === null) return actual == null;
  return comparable(actual) === comparable(expected);
});
const mockStore = (stored, onStart = () => {}) => {
  Session.findById = async () => sessionDoc({ ...stored });
  Session.findOneAndUpdate = async (filter, update) => {
    if (!matches(stored, filter)) return null;
    assert.equal(update.length, 1);
    const set = update[0].$set;
    const ownField = Object.hasOwn(set, 'learnerCheckedInAt') ? 'learnerCheckedInAt' : 'tutorCheckedInAt';
    const peerField = ownField === 'learnerCheckedInAt' ? 'tutorCheckedInAt' : 'learnerCheckedInAt';
    assert.equal(set.status.$cond[1], 'in_progress');
    assert.equal(filter[ownField], null);
    const peerCheckedIn = Boolean(stored[peerField]);
    stored[ownField] = set[ownField];
    if (peerCheckedIn) {
      onStart();
      stored.status = 'in_progress';
      stored.startedAt = set.startedAt.$cond[1];
    }
    return stored;
  };
};
const invoke = async (handler, stored, actor, body = {}) => {
  const res = response();
  await handler({ params: { id: stored._id }, user: { id: actor }, body }, res);
  return res;
};

for (const status of ['scheduled', 'accepted']) {
  for (const role of ['learner', 'tutor']) {
    test(`${role} can check in to ${status} without starting alone`, async () => {
      const stored = sessionDoc({ status });
      mockStore(stored);
      const before = Date.now();
      const res = await invoke(controller.checkIn, stored, stored[role], {
        checkedInAt: '1999-01-01T00:00:00.000Z',
      });
      assert.equal(res.statusCode, 200);
      assert.equal(stored.status, status);
      assert.equal(stored.startedAt, undefined);
      const own = stored[`${role}CheckedInAt`];
      assert.ok(own instanceof Date);
      assert.ok(own.getTime() >= before && own.getTime() <= Date.now());
      assert.equal(stored[`${role === 'learner' ? 'tutor' : 'learner'}CheckedInAt`], undefined);
    });
  }

  test(`second participant starts ${status} and sets startedAt once`, async () => {
    const stored = sessionDoc({ status });
    mockStore(stored);
    const first = await invoke(controller.checkIn, stored, stored.learner);
    const learnerTime = stored.learnerCheckedInAt;
    const second = await invoke(controller.checkIn, stored, stored.tutor);
    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(second.body.data.status, 'in_progress');
    assert.equal(stored.learnerCheckedInAt, learnerTime);
    assert.ok(stored.tutorCheckedInAt instanceof Date);
    assert.ok(stored.startedAt instanceof Date);
    assert.equal(stored.startedAt, stored.tutorCheckedInAt);
    assert.equal((await invoke(controller.checkIn, stored, stored.learner)).statusCode, 400);
  });
}

test('nonparticipant cannot check in', async () => {
  const stored = sessionDoc();
  mockStore(stored);
  assert.equal((await invoke(controller.checkIn, stored, '507f1f77bcf86cd799439099')).statusCode, 403);
  assert.equal(stored.learnerCheckedInAt, undefined);
});

test('ineligible states and missing agreed times cannot check in', async () => {
  for (const status of ['pending', 'rejected', 'declined', 'cancelled', 'completed', 'in_progress', 'awaiting_validation']) {
    const stored = sessionDoc({ status });
    mockStore(stored);
    assert.equal((await invoke(controller.checkIn, stored, stored.learner)).statusCode, 400, status);
  }
  for (const scheduledAt of [undefined, new Date('invalid')]) {
    const stored = sessionDoc({ scheduledAt });
    mockStore(stored);
    assert.equal((await invoke(controller.checkIn, stored, stored.learner)).statusCode, 400);
  }
});

test('same participant cannot check in twice or overwrite their timestamp', async () => {
  const stored = sessionDoc();
  mockStore(stored);
  assert.equal((await invoke(controller.checkIn, stored, stored.learner)).statusCode, 200);
  const firstTime = stored.learnerCheckedInAt;
  assert.equal((await invoke(controller.checkIn, stored, stored.learner)).statusCode, 409);
  assert.equal(stored.learnerCheckedInAt, firstTime);
  assert.equal(stored.status, 'scheduled');
});

test('15-minute early and 4-hour late window is enforced around scheduledAt', async () => {
  for (const minutesFromNow of [16, -241]) {
    const stored = sessionDoc({ scheduledAt: new Date(Date.now() + minutesFromNow * 60000) });
    mockStore(stored);
    assert.equal((await invoke(controller.checkIn, stored, stored.learner)).statusCode, 400, minutesFromNow);
  }
  for (const minutesFromNow of [14, -239]) {
    const stored = sessionDoc({ scheduledAt: new Date(Date.now() + minutesFromNow * 60000) });
    mockStore(stored);
    assert.equal((await invoke(controller.checkIn, stored, stored.learner)).statusCode, 200, minutesFromNow);
  }
});

test('active reschedule blocks check-in until it is resolved', async () => {
  const stored = sessionDoc({
    proposedScheduledAt: new Date(Date.now() + 86400000),
    rescheduleProposalId: '11111111-2222-4333-8444-555555555555',
  });
  mockStore(stored);
  assert.equal((await invoke(controller.checkIn, stored, stored.learner)).statusCode, 409);
  assert.equal(stored.learnerCheckedInAt, undefined);
  delete stored.proposedScheduledAt;
  delete stored.rescheduleProposalId;
  assert.equal((await invoke(controller.checkIn, stored, stored.learner)).statusCode, 200);
});

test('cancellation or reschedule racing with check-in causes a stale conflict', async () => {
  for (const change of ['cancelled', 'proposal']) {
    const stored = sessionDoc();
    mockStore(stored);
    const atomicUpdate = Session.findOneAndUpdate;
    Session.findOneAndUpdate = async (filter, update) => {
      if (change === 'cancelled') stored.status = 'cancelled';
      else stored.rescheduleProposalId = '11111111-2222-4333-8444-555555555555';
      return atomicUpdate(filter, update);
    };
    assert.equal((await invoke(controller.checkIn, stored, stored.learner)).statusCode, 409);
    assert.equal(stored.learnerCheckedInAt, undefined);
  }
});

test('simultaneous participant check-ins preserve both timestamps and start once', async () => {
  const stored = sessionDoc();
  let starts = 0;
  mockStore(stored, () => { starts += 1; });
  const results = await Promise.all([
    invoke(controller.checkIn, stored, stored.learner),
    invoke(controller.checkIn, stored, stored.tutor),
  ]);
  assert.deepEqual(results.map((res) => res.statusCode), [200, 200]);
  assert.equal(stored.status, 'in_progress');
  assert.ok(stored.learnerCheckedInAt);
  assert.ok(stored.tutorCheckedInAt);
  assert.ok(stored.startedAt);
  assert.equal(starts, 1);
});

test('in_progress rejects old completion and rescheduling while allowing participant messages', async () => {
  const stored = sessionDoc({ status: 'in_progress', startedAt: new Date() });
  mockStore(stored);
  assert.equal((await invoke(controller.updateSessionStatus, stored, stored.tutor, { status: 'completed' })).statusCode, 400);
  assert.equal((await invoke(controller.proposeReschedule, stored, stored.learner, { scheduledAt: new Date(Date.now() + 86400000).toISOString() })).statusCode, 400);
  SessionMessage.create = async (data) => ({ ...data, async populate() {} });
  assert.equal((await invoke(controller.createMessage, stored, stored.learner, { body: 'I am here.' })).statusCode, 201);
});

test('legacy accepted completion remains available without check-in for P2.6', async () => {
  const stored = sessionDoc({ status: 'accepted' });
  Session.findById = async () => stored;
  Session.findOneAndUpdate = async (filter, update) => {
    assert.equal(filter.status, 'accepted');
    Object.assign(stored, update.$set);
    return stored;
  };
  const res = await invoke(controller.updateSessionStatus, stored, stored.tutor, { status: 'completed' });
  assert.equal(res.statusCode, 200);
  assert.equal(stored.status, 'completed');
  assert.equal(stored.learnerCheckedInAt, undefined);
  assert.equal(stored.tutorCheckedInAt, undefined);
});
