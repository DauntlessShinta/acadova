const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const CreditTransaction = require('../models/CreditTransaction');
const User = require('../models/User');
const { getMyCreditHistory } = require('../controllers/creditController');

const learner = new mongoose.Types.ObjectId();
const tutor = new mongoose.Types.ObjectId();
const session = new mongoose.Types.ObjectId();
const valid = (overrides = {}) => ({
  type: 'session_payment', amount: 20, fromUser: learner, toUser: tutor, session,
  ...overrides,
});

test('new User balances begin at zero; whole-number validation preserves historical balances', async () => {
  const user = new User({ name: 'Student', email: 'student@example.test', password: 'validPassword1!' });
  assert.equal(user.credits, 0);
  assert.equal(user.openingGrantEligible, false);
  for (const credits of [0, 1, 2, 20, 100]) {
    user.credits = credits;
    await user.validate();
  }
  for (const credits of [-1, 0.5, Infinity, NaN]) {
    user.credits = credits;
    await assert.rejects(user.validate());
  }
});

test('Session payments retain required peers/Session and historical integer amounts', async () => {
  for (const amount of [1, 2, 20]) await new CreditTransaction(valid({ amount })).validate();
  for (const field of ['fromUser', 'toUser', 'session']) {
    await assert.rejects(new CreditTransaction(valid({ [field]: undefined })).validate());
  }
});

test('opening grants require recipient and cannot claim a sender or Session', async () => {
  await new CreditTransaction({ type: 'initial_grant', toUser: learner, amount: 100 }).validate();
  await new CreditTransaction({ type: 'initial_grant', toUser: tutor, amount: 100 }).validate();
  await assert.rejects(new CreditTransaction({ type: 'initial_grant', amount: 100 }).validate());
  await assert.rejects(new CreditTransaction({ type: 'initial_grant', toUser: learner,
    fromUser: tutor, amount: 100 }).validate());
  await assert.rejects(new CreditTransaction({ type: 'initial_grant', toUser: learner,
    session, amount: 100 }).validate());
});

test('ledger amounts must be positive whole numbers', async () => {
  for (const amount of [0, -1, 1.5, NaN, Infinity]) {
    await assert.rejects(new CreditTransaction(valid({ amount })).validate());
  }
});

test('schema declares separate unique keys for Session payment and per-Student grant', () => {
  const indexes = CreditTransaction.schema.indexes();
  const payment = indexes.find(([, options]) => options.name === 'uniq_session_payment_session');
  const grant = indexes.find(([, options]) => options.name === 'uniq_initial_grant_recipient');
  assert.deepEqual(payment[0], { session: 1, type: 1 });
  assert.equal(payment[1].unique, true);
  assert.deepEqual(payment[1].partialFilterExpression, { type: 'session_payment', session: { $exists: true } });
  assert.deepEqual(grant[0], { toUser: 1 });
  assert.equal(grant[1].unique, true);
  assert.deepEqual(grant[1].partialFilterExpression, { type: 'initial_grant', toUser: { $exists: true } });
});

test('own history tolerates a sender-less opening grant', async () => {
  const original = CreditTransaction.find;
  CreditTransaction.find = (filter) => {
    assert.deepEqual(filter, { $or: [{ fromUser: String(learner) }, { toUser: String(learner) }] });
    return { populate() { return this; }, sort: async () => [{
      _id: 'grant', type: 'initial_grant', toUser: { _id: learner, name: 'Student' },
      fromUser: null, session: null, amount: 100, createdAt: new Date(),
    }] };
  };
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
  try {
    await getMyCreditHistory({ user: { id: String(learner) } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data[0].direction, 'earned');
    assert.equal(response.body.data[0].subject, 'Opening credits');
    assert.equal(response.body.data[0].counterparty, 'Acadova');
  } finally { CreditTransaction.find = original; }
});
