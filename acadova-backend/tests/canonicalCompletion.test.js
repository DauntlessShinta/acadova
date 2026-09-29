const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Session = require('../models/Session');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const Rating = require('../models/Rating');
const controller = require('../controllers/sessionController');
const ratingController = require('../controllers/ratingController');

const originals = {
  findById: Session.findById,
  findOneAndUpdate: Session.findOneAndUpdate,
  updateOne: Session.updateOne,
  startSession: mongoose.startSession,
  userFindById: User.findById,
  userFindOneAndUpdate: User.findOneAndUpdate,
  userFindByIdAndUpdate: User.findByIdAndUpdate,
  transactionFindOne: CreditTransaction.findOne,
  transactionFind: CreditTransaction.find,
  transactionCreate: CreditTransaction.create,
  ratingFindOne: Rating.findOne,
  ratingCreate: Rating.create,
  ratingAggregate: Rating.aggregate,
};

test.afterEach(() => {
  Session.findById = originals.findById;
  Session.findOneAndUpdate = originals.findOneAndUpdate;
  Session.updateOne = originals.updateOne;
  mongoose.startSession = originals.startSession;
  User.findById = originals.userFindById;
  User.findOneAndUpdate = originals.userFindOneAndUpdate;
  User.findByIdAndUpdate = originals.userFindByIdAndUpdate;
  CreditTransaction.findOne = originals.transactionFindOne;
  CreditTransaction.find = originals.transactionFind;
  CreditTransaction.create = originals.transactionCreate;
  Rating.findOne = originals.ratingFindOne;
  Rating.create = originals.ratingCreate;
  Rating.aggregate = originals.ratingAggregate;
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
  status: 'awaiting_validation',
  creditAmount: 2,
  meetingMethod: 'online',
  meetingLink: 'https://meet.example.com/room',
  startedAt: new Date('2026-09-25T06:30:00.000Z'),
  learnerCheckedInAt: new Date('2026-09-25T06:29:00.000Z'),
  tutorCheckedInAt: new Date('2026-09-25T06:30:00.000Z'),
  awaitingValidationAt: new Date('2026-09-25T07:30:00.000Z'),
  async populate() {},
  ...overrides,
});
const comparable = (value) => value instanceof Date ? value.getTime() : String(value);
const matches = (stored, filter) => Object.entries(filter).every(([key, expected]) => {
  const actual = stored[key];
  if (expected === null) return actual == null;
  if (expected && typeof expected === 'object' && '$ne' in expected) return actual != null;
  return comparable(actual) === comparable(expected);
});
const invoke = async (handler, stored, actor, body = {}) => {
  const res = response();
  await handler({ params: { id: stored._id }, user: { id: actor }, body }, res);
  return res;
};

const setupSettlement = (overrides = {}, initialCredits = 5) => {
  const stored = sessionDoc(overrides);
  const learner = { credits: initialCredits, async save() {} };
  let tutorCredits = 0;
  let payments = [];
  let paymentWrites = 0;
  let failLedger = false;
  let queue = Promise.resolve();

  // Serialize mock transactions as MongoDB does through document conflicts and
  // transaction retries; restore writes when a callback fails.
  mongoose.startSession = async () => ({
    async withTransaction(callback) {
      const previous = queue;
      let release;
      queue = new Promise((resolve) => { release = resolve; });
      await previous;
      const before = { ...stored };
      const creditsBefore = learner.credits;
      const tutorBefore = tutorCredits;
      const paymentsBefore = [...payments];
      try {
        await callback();
      } catch (error) {
        for (const key of Object.keys(stored)) if (!Object.hasOwn(before, key)) delete stored[key];
        Object.assign(stored, before);
        learner.credits = creditsBefore;
        tutorCredits = tutorBefore;
        payments = paymentsBefore;
        throw error;
      } finally {
        release();
      }
    },
    async endSession() {},
  });
  Session.findById = () => ({ session: async () => sessionDoc({ ...stored }) });
  Session.updateOne = async (filter, update) => {
    if (!matches(stored, filter)) return { matchedCount: 0 };
    Object.assign(stored, update.$set);
    return { matchedCount: 1 };
  };
  CreditTransaction.findOne = () => ({ session: async () => payments[0] || null });
  CreditTransaction.find = async () => payments;
  CreditTransaction.create = async ([row]) => {
    if (failLedger) throw new Error('Ledger unavailable');
    payments.push({ ...row, type: 'session_payment' });
    paymentWrites += 1;
  };
  User.findById = () => ({ session: async () => learner });
  User.findOneAndUpdate = async (_query, update) => {
    tutorCredits += update.$inc.credits;
    return { _id: stored.tutor };
  };
  return {
    stored, learner,
    get tutorCredits() { return tutorCredits; },
    get payments() { return payments; },
    get paymentWrites() { return paymentWrites; },
    setFailLedger(value) { failLedger = value; },
  };
};

test('Tutor finishes in_progress after both check-ins without settling credits', async () => {
  const stored = sessionDoc({ status: 'in_progress', awaitingValidationAt: undefined });
  Session.findById = async () => sessionDoc({ ...stored });
  Session.findOneAndUpdate = async (filter, update) => {
    assert.equal(filter.status, 'in_progress');
    assert.equal(filter.awaitingValidationAt, null);
    Object.assign(stored, update.$set);
    return stored;
  };
  CreditTransaction.create = async () => assert.fail('Finishing must not transfer credits');
  const res = await invoke(controller.finishSession, stored, stored.tutor);
  assert.equal(res.statusCode, 200);
  assert.equal(stored.status, 'awaiting_validation');
  assert.ok(stored.awaitingValidationAt instanceof Date);
  assert.equal(stored.completedAt, undefined);
  assert.equal(stored.creditsSettledAt, undefined);
});

test('only Tutor can finish and finish is restricted to in_progress with valid evidence', async () => {
  const stored = sessionDoc({ status: 'in_progress', awaitingValidationAt: undefined });
  Session.findById = async () => stored;
  Session.findOneAndUpdate = async () => assert.fail('Invalid finish must not write');
  assert.equal((await invoke(controller.finishSession, stored, stored.learner)).statusCode, 403);
  assert.equal((await invoke(controller.finishSession, stored, '507f1f77bcf86cd799439099')).statusCode, 403);
  for (const status of ['pending', 'scheduled', 'accepted', 'awaiting_validation', 'completed']) {
    stored.status = status;
    assert.equal((await invoke(controller.finishSession, stored, stored.tutor)).statusCode, 400, status);
  }
  stored.status = 'in_progress';
  delete stored.tutorCheckedInAt;
  assert.equal((await invoke(controller.finishSession, stored, stored.tutor)).statusCode, 409);
});

test('stale finish after status change is rejected', async () => {
  const stored = sessionDoc({ status: 'in_progress', awaitingValidationAt: undefined });
  Session.findById = async () => sessionDoc({ ...stored });
  Session.findOneAndUpdate = async () => { stored.status = 'completed'; return null; };
  assert.equal((await invoke(controller.finishSession, stored, stored.tutor)).statusCode, 409);
  assert.equal(stored.awaitingValidationAt, undefined);
});

for (const firstRole of ['learner', 'tutor']) {
  test(`${firstRole} first confirmation waits; peer confirmation settles once`, async () => {
    const state = setupSettlement();
    const first = await invoke(controller.confirmSession, state.stored, state.stored[firstRole]);
    assert.equal(first.statusCode, 200);
    assert.equal(state.stored.status, 'awaiting_validation');
    assert.ok(state.stored[`${firstRole}ConfirmedAt`]);
    assert.equal(state.stored.completedAt, undefined);
    assert.equal(state.stored.creditsSettledAt, undefined);
    assert.equal(state.tutorCredits, 0);
    assert.equal(state.learner.credits, 5);
    assert.equal(state.payments.length, 0);

    const secondRole = firstRole === 'learner' ? 'tutor' : 'learner';
    const second = await invoke(controller.confirmSession, state.stored, state.stored[secondRole]);
    assert.equal(second.statusCode, 200);
    assert.equal(state.stored.status, 'completed');
    assert.ok(state.stored.learnerConfirmedAt);
    assert.ok(state.stored.tutorConfirmedAt);
    assert.ok(state.stored.completedAt);
    assert.ok(state.stored.creditsSettledAt);
    assert.equal(state.stored.confirmedAt, state.stored.learnerConfirmedAt);
    assert.equal(state.learner.credits, 3);
    assert.equal(state.tutorCredits, 2);
    assert.equal(state.paymentWrites, 1);
    assert.equal((await invoke(controller.confirmSession, state.stored, state.stored[secondRole])).statusCode, 409);
    assert.equal(state.paymentWrites, 1);
  });
}

test('newly priced canonical Session transfers its stored 20 credits once', async () => {
  const state = setupSettlement({ creditAmount: 20 }, 100);
  assert.equal((await invoke(controller.confirmSession, state.stored, state.stored.learner)).statusCode, 200);
  assert.equal((await invoke(controller.confirmSession, state.stored, state.stored.tutor)).statusCode, 200);
  assert.equal(state.learner.credits, 80);
  assert.equal(state.tutorCredits, 20);
  assert.equal(state.payments.length, 1);
  assert.equal(state.payments[0].amount, 20);
  assert.equal(state.paymentWrites, 1);
});

test('nonparticipant and duplicate canonical confirmation cannot write', async () => {
  const state = setupSettlement();
  assert.equal((await invoke(controller.confirmSession, state.stored, '507f1f77bcf86cd799439099')).statusCode, 403);
  assert.equal((await invoke(controller.confirmSession, state.stored, state.stored.learner)).statusCode, 200);
  assert.equal((await invoke(controller.confirmSession, state.stored, state.stored.learner)).statusCode, 409);
  assert.equal(state.payments.length, 0);
});

test('simultaneous confirmations produce one completed state and one payment', async () => {
  const state = setupSettlement();
  const results = await Promise.all([
    invoke(controller.confirmSession, state.stored, state.stored.learner),
    invoke(controller.confirmSession, state.stored, state.stored.tutor),
  ]);
  assert.deepEqual(results.map((res) => res.statusCode), [200, 200]);
  assert.equal(state.stored.status, 'completed');
  assert.equal(state.paymentWrites, 1);
  assert.equal(state.learner.credits, 3);
  assert.equal(state.tutorCredits, 2);
});

test('insufficient Learner credits roll back final confirmation and allow later retry', async () => {
  const state = setupSettlement({}, 1);
  assert.equal((await invoke(controller.confirmSession, state.stored, state.stored.tutor)).statusCode, 200);
  const failed = await invoke(controller.confirmSession, state.stored, state.stored.learner);
  assert.equal(failed.statusCode, 400);
  assert.equal(state.stored.status, 'awaiting_validation');
  assert.equal(state.stored.learnerConfirmedAt, undefined);
  assert.equal(state.stored.completedAt, undefined);
  assert.equal(state.learner.credits, 1);
  assert.equal(state.tutorCredits, 0);
  assert.equal(state.payments.length, 0);
  state.learner.credits = 3;
  assert.equal((await invoke(controller.confirmSession, state.stored, state.stored.learner)).statusCode, 200);
  assert.equal(state.stored.status, 'completed');
  assert.equal(state.paymentWrites, 1);
});

test('ledger failure rolls back final state and both balances', async () => {
  const state = setupSettlement();
  await invoke(controller.confirmSession, state.stored, state.stored.learner);
  state.setFailLedger(true);
  assert.equal((await invoke(controller.confirmSession, state.stored, state.stored.tutor)).statusCode, 500);
  assert.equal(state.stored.status, 'awaiting_validation');
  assert.equal(state.stored.tutorConfirmedAt, undefined);
  assert.equal(state.stored.creditsSettledAt, undefined);
  assert.equal(state.learner.credits, 5);
  assert.equal(state.tutorCredits, 0);
  assert.equal(state.paymentWrites, 0);
  state.setFailLedger(false);
  assert.equal((await invoke(controller.confirmSession, state.stored, state.stored.tutor)).statusCode, 200);
  assert.equal(state.paymentWrites, 1);
});

test('canonical awaiting_validation cannot be rated; settled completion can be rated once', async () => {
  const state = setupSettlement();
  let existingReview = false;
  Rating.findOne = async () => existingReview ? { _id: 'review-1' } : null;
  Rating.create = async (data) => { existingReview = true; return { _id: 'review-1', ...data }; };
  Rating.aggregate = async () => [{ average: 5 }];
  User.findByIdAndUpdate = async () => ({});
  Session.findById = async () => sessionDoc({ ...state.stored });
  const before = await invoke(ratingController.submitRating, state.stored, state.stored.learner, {
    sessionId: state.stored._id, rating: 5,
  });
  assert.equal(before.statusCode, 400);
  Session.findById = () => ({ session: async () => sessionDoc({ ...state.stored }) });
  await invoke(controller.confirmSession, state.stored, state.stored.learner);
  await invoke(controller.confirmSession, state.stored, state.stored.tutor);
  Session.findById = async () => sessionDoc({ ...state.stored });
  assert.equal((await invoke(ratingController.submitRating, state.stored, state.stored.learner, {
    sessionId: state.stored._id, rating: 5,
  })).statusCode, 201);
  assert.equal((await invoke(ratingController.submitRating, state.stored, state.stored.learner, {
    sessionId: state.stored._id, rating: 5,
  })).statusCode, 409);
});
