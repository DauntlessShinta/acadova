const test = require('node:test');
const assert = require('node:assert/strict');
const Session = require('../models/Session');
const controller = require('../controllers/sessionController');

const originalFindById = Session.findById;
const originalFindOneAndUpdate = Session.findOneAndUpdate;

test.afterEach(() => {
  Session.findById = originalFindById;
  Session.findOneAndUpdate = originalFindOneAndUpdate;
});

const future = (days = 2) => new Date(Date.now() + days * 86400000);
const response = () => ({
  statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});
const sessionDoc = (overrides = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  learner: '507f1f77bcf86cd799439012',
  tutor: '507f1f77bcf86cd799439013',
  status: 'accepted',
  scheduledAt: future(1),
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
const mockStore = (stored) => {
  Session.findById = async () => sessionDoc({ ...stored });
  Session.findOneAndUpdate = async (filter, update) => {
    if (!matches(stored, filter)) return null;
    Object.assign(stored, update.$set || {});
    for (const key of Object.keys(update.$unset || {})) delete stored[key];
    return stored;
  };
};
const invoke = async (handler, stored, actor, body) => {
  const res = response();
  await handler({ params: { id: stored._id }, user: { id: actor }, body }, res);
  return res;
};
const propose = (stored, actor, date = future(2)) => invoke(
  controller.proposeReschedule, stored, actor, { scheduledAt: date.toISOString() }
);
const decide = (handler, stored, actor, proposalId = stored.rescheduleProposalId) => invoke(
  handler, stored, actor, { proposalId }
);

for (const status of ['accepted', 'scheduled']) {
  for (const role of ['learner', 'tutor']) {
    test(`${role} proposes on ${status} without changing agreed time or meeting details`, async () => {
      const stored = sessionDoc({ status });
      const originalTime = stored.scheduledAt;
      mockStore(stored);
      const res = await propose(stored, stored[role]);
      assert.equal(res.statusCode, 200);
      assert.equal(stored.status, status);
      assert.equal(stored.scheduledAt, originalTime);
      assert.equal(stored.meetingLink, 'https://meet.example.com/room');
      assert.equal(String(stored.rescheduleProposedBy), stored[role]);
      assert.ok(stored.proposedScheduledAt instanceof Date);
      assert.ok(stored.rescheduleProposedAt instanceof Date);
      assert.match(stored.rescheduleProposalId, /^[a-f0-9-]{36}$/);
    });
  }
}

test('nonparticipant cannot propose or decide', async () => {
  const stored = sessionDoc();
  mockStore(stored);
  const stranger = '507f1f77bcf86cd799439099';
  assert.equal((await propose(stored, stranger)).statusCode, 403);
  await propose(stored, stored.learner);
  assert.equal((await decide(controller.acceptReschedule, stored, stranger)).statusCode, 403);
  assert.equal((await decide(controller.declineReschedule, stored, stranger)).statusCode, 403);
  assert.ok(stored.rescheduleProposalId);
});

test('pending, in-progress, awaiting-validation and closed sessions cannot reschedule', async () => {
  for (const status of ['pending', 'completed', 'cancelled', 'declined', 'rejected', 'in_progress', 'awaiting_validation']) {
    const stored = sessionDoc({ status });
    mockStore(stored);
    assert.equal((await propose(stored, stored.learner)).statusCode, 400, status);
    assert.equal((await decide(controller.acceptReschedule, stored, stored.tutor, 'any')).statusCode, 400, status);
    assert.equal(stored.proposedScheduledAt, undefined);
  }
});

test('one active proposal blocks a second proposal from either participant', async () => {
  const stored = sessionDoc();
  mockStore(stored);
  assert.equal((await propose(stored, stored.learner)).statusCode, 200);
  const token = stored.rescheduleProposalId;
  assert.equal((await propose(stored, stored.tutor, future(3))).statusCode, 409);
  assert.equal(stored.rescheduleProposalId, token);
});

test('proposer cannot accept or decline their own proposal', async () => {
  const stored = sessionDoc();
  mockStore(stored);
  await propose(stored, stored.learner);
  assert.equal((await decide(controller.acceptReschedule, stored, stored.learner)).statusCode, 403);
  assert.equal((await decide(controller.declineReschedule, stored, stored.learner)).statusCode, 403);
  assert.ok(stored.rescheduleProposalId);
});

for (const status of ['accepted', 'scheduled']) {
  test(`other participant accepts ${status} proposal and clears proposal fields`, async () => {
    const checkedInAt = new Date();
    const stored = sessionDoc({ status, learnerCheckedInAt: checkedInAt });
    mockStore(stored);
    const agreed = stored.scheduledAt;
    await propose(stored, stored.learner);
    const proposed = stored.proposedScheduledAt;
    const res = await decide(controller.acceptReschedule, stored, stored.tutor);
    assert.equal(res.statusCode, 200);
    assert.equal(stored.status, status);
    assert.notEqual(stored.scheduledAt, agreed);
    assert.equal(stored.scheduledAt, proposed);
    assert.equal(stored.learnerCheckedInAt, undefined);
    assert.equal(stored.tutorCheckedInAt, undefined);
    for (const key of ['proposedScheduledAt', 'rescheduleProposedBy', 'rescheduleProposedAt', 'rescheduleProposalId']) {
      assert.equal(stored[key], undefined, key);
    }
  });

  test(`other participant declines ${status} proposal without changing agreed time`, async () => {
    const checkedInAt = new Date();
    const stored = sessionDoc({ status, learnerCheckedInAt: checkedInAt });
    mockStore(stored);
    const agreed = stored.scheduledAt;
    await propose(stored, stored.tutor);
    const res = await decide(controller.declineReschedule, stored, stored.learner);
    assert.equal(res.statusCode, 200);
    assert.equal(stored.scheduledAt, agreed);
    assert.equal(stored.learnerCheckedInAt, checkedInAt);
    assert.equal(stored.proposedScheduledAt, undefined);
    assert.equal(stored.rescheduleProposalId, undefined);
  });
}

test('stale accept and decline cannot act on an already resolved or replaced proposal', async () => {
  const stored = sessionDoc();
  mockStore(stored);
  await propose(stored, stored.learner);
  const firstId = stored.rescheduleProposalId;
  assert.equal((await decide(controller.declineReschedule, stored, stored.tutor, firstId)).statusCode, 200);
  assert.equal((await decide(controller.acceptReschedule, stored, stored.tutor, firstId)).statusCode, 409);
  await propose(stored, stored.learner, future(3));
  const secondId = stored.rescheduleProposalId;
  assert.notEqual(secondId, firstId);
  assert.equal((await decide(controller.acceptReschedule, stored, stored.tutor, firstId)).statusCode, 409);
  assert.equal((await decide(controller.declineReschedule, stored, stored.tutor, firstId)).statusCode, 409);
  assert.equal(stored.rescheduleProposalId, secondId);
});

test('simultaneous proposals cannot overwrite one another', async () => {
  const stored = sessionDoc();
  mockStore(stored);
  const results = await Promise.all([
    propose(stored, stored.learner, future(2)),
    propose(stored, stored.tutor, future(3)),
  ]);
  assert.deepEqual(results.map((res) => res.statusCode).sort(), [200, 409]);
  assert.ok(stored.rescheduleProposalId);
});

test('simultaneous accept and decline resolve one proposal only once', async () => {
  const stored = sessionDoc();
  mockStore(stored);
  await propose(stored, stored.learner);
  const proposalId = stored.rescheduleProposalId;
  const results = await Promise.all([
    decide(controller.acceptReschedule, stored, stored.tutor, proposalId),
    decide(controller.declineReschedule, stored, stored.tutor, proposalId),
  ]);
  assert.deepEqual(results.map((res) => res.statusCode).sort(), [200, 409]);
  assert.equal(stored.rescheduleProposalId, undefined);
});

test('a changed agreed time prevents stale proposal and decision writes', async () => {
  const stored = sessionDoc();
  mockStore(stored);
  const atomicUpdate = Session.findOneAndUpdate;
  Session.findOneAndUpdate = async (filter, update, options) => {
    stored.scheduledAt = future(4);
    return atomicUpdate(filter, update, options);
  };
  assert.equal((await propose(stored, stored.learner)).statusCode, 409);
  assert.equal(stored.proposedScheduledAt, undefined);

  Session.findOneAndUpdate = atomicUpdate;
  await propose(stored, stored.learner);
  const token = stored.rescheduleProposalId;
  Session.findOneAndUpdate = async (filter, update, options) => {
    stored.scheduledAt = future(5);
    return atomicUpdate(filter, update, options);
  };
  assert.equal((await decide(controller.acceptReschedule, stored, stored.tutor, token)).statusCode, 409);
  assert.equal(stored.rescheduleProposalId, token);
});

test('status change prevents a stale proposal or decision', async () => {
  const stored = sessionDoc();
  const agreed = stored.scheduledAt;
  mockStore(stored);
  const priorUpdate = Session.findOneAndUpdate;
  Session.findOneAndUpdate = async (filter, update, options) => {
    stored.status = 'cancelled';
    return priorUpdate(filter, update, options);
  };
  assert.equal((await propose(stored, stored.learner)).statusCode, 409);
  assert.equal(stored.proposedScheduledAt, undefined);

  stored.status = 'accepted';
  Session.findOneAndUpdate = priorUpdate;
  await propose(stored, stored.learner);
  const token = stored.rescheduleProposalId;
  Session.findOneAndUpdate = async (filter, update, options) => {
    stored.status = 'completed';
    return priorUpdate(filter, update, options);
  };
  assert.equal((await decide(controller.acceptReschedule, stored, stored.tutor, token)).statusCode, 409);
  assert.equal(stored.scheduledAt, agreed);
});

test('invalid, past and identical proposed times are rejected without writes', async () => {
  const stored = sessionDoc();
  Session.findById = async () => sessionDoc({ ...stored });
  Session.findOneAndUpdate = async () => assert.fail('Invalid time must not write');
  for (const scheduledAt of ['not-a-date', new Date(Date.now() - 1000).toISOString(), stored.scheduledAt.toISOString()]) {
    const res = await invoke(controller.proposeReschedule, stored, stored.learner, { scheduledAt });
    assert.equal(res.statusCode, 400, scheduledAt);
  }
});

test('a proposal whose time has passed cannot be accepted', async () => {
  const stored = sessionDoc({
    proposedScheduledAt: new Date(Date.now() - 1000),
    rescheduleProposedBy: '507f1f77bcf86cd799439012',
    rescheduleProposalId: '00000000-0000-4000-8000-000000000000',
  });
  Session.findById = async () => stored;
  Session.findOneAndUpdate = async () => assert.fail('Past time must not be accepted');
  assert.equal((await decide(controller.acceptReschedule, stored, stored.tutor)).statusCode, 400);
});

test('legacy completion or cancellation clears a pending reschedule without changing settlement', async () => {
  for (const status of ['completed', 'cancelled']) {
    const stored = sessionDoc();
    mockStore(stored);
    await propose(stored, stored.learner);
    const res = await invoke(controller.updateSessionStatus, stored, stored.tutor, { status });
    assert.equal(res.statusCode, 200);
    assert.equal(stored.status, status);
    assert.equal(stored.proposedScheduledAt, undefined);
    assert.equal(stored.rescheduleProposalId, undefined);
    assert.equal(stored.confirmedAt, undefined);
    assert.equal(stored.creditsSettledAt, undefined);
  }
});
