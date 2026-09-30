const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const { transferSessionCredits } = require('../services/sessionSettlement');

const learner = '507f1f77bcf86cd799439011';
const tutor = '507f1f77bcf86cd799439012';
const session = (id) => ({ _id: id, learner, tutor, creditAmount: 20 });

test('Session debit is conditional on current database balance when two settlements race', async () => {
  const oldUpdate = User.findOneAndUpdate;
  const oldCreate = CreditTransaction.create;
  let learnerCredits = 20;
  let tutorCredits = 0;
  const payments = [];
  User.findOneAndUpdate = async (filter, update) => {
    assert.equal(filter.role, 'student');
    if (String(filter._id) === learner) {
      assert.deepEqual(filter.credits, { $gte: 20 });
      if (learnerCredits < filter.credits.$gte) return null;
      learnerCredits += update.$inc.credits;
      return { credits: learnerCredits };
    }
    assert.deepEqual(filter.credits, { $lte: Number.MAX_SAFE_INTEGER - 20 });
    tutorCredits += update.$inc.credits;
    return { credits: tutorCredits };
  };
  CreditTransaction.create = async ([row]) => { payments.push(row); return [row]; };
  try {
    const outcomes = await Promise.allSettled([
      transferSessionCredits(session('507f1f77bcf86cd799439013'), {}),
      transferSessionCredits(session('507f1f77bcf86cd799439014'), {}),
    ]);
    assert.deepEqual(outcomes.map((result) => result.status).sort(), ['fulfilled', 'rejected']);
    assert.equal(learnerCredits, 0);
    assert.equal(tutorCredits, 20);
    assert.equal(payments.length, 1);
    assert.equal(payments[0].amount, 20);
    assert.equal(outcomes.find((result) => result.status === 'rejected').reason.status, 400);
  } finally { User.findOneAndUpdate = oldUpdate; CreditTransaction.create = oldCreate; }
});

test('invalid historical Session amount fails before any balance or ledger write', async () => {
  const oldUpdate = User.findOneAndUpdate;
  const oldCreate = CreditTransaction.create;
  User.findOneAndUpdate = async () => assert.fail('No balance write expected');
  CreditTransaction.create = async () => assert.fail('No ledger write expected');
  try {
    for (const amount of [0, -1, 1.5, NaN]) {
      await assert.rejects(transferSessionCredits({ ...session('507f1f77bcf86cd799439013'),
        creditAmount: amount }, {}), { status: 400 });
    }
  } finally { User.findOneAndUpdate = oldUpdate; CreditTransaction.create = oldCreate; }
});
