const test = require('node:test');
const assert = require('node:assert/strict');
const { runDryRun, hasIndex, requiredIndexes } = require('../utils/creditReconciliationDryRun');

const learner = '507f1f77bcf86cd799439011';
const tutor = '507f1f77bcf86cd799439012';
const admin = '507f1f77bcf86cd799439013';
const sessionId = '507f1f77bcf86cd799439014';
const resource = '507f1f77bcf86cd799439015';
const unlockId = '507f1f77bcf86cd799439016';
const assessment = '507f1f77bcf86cd799439017';
const reference = '9e434bfa-4160-4c2a-817a-302a46b7067e';

const indexes = Object.fromEntries(['credittransactions', 'learningunlocks', 'learningtopics']
  .map((name) => [name, requiredIndexes.filter(([collection]) => collection === name)
    .map(([, indexName, key, partial]) => ({ name: indexName, key, unique: true,
      ...(partial ? { partialFilterExpression: partial } : {}) }))]));

const fixture = () => ({
  users: [
    { _id: learner, role: 'student', credits: 102 },
    { _id: tutor, role: 'student', credits: 20 },
    { _id: admin, role: 'admin', credits: 0 },
  ],
  sessions: [{ _id: sessionId, learner, tutor, creditAmount: 20 }],
  learningunlocks: [{ _id: unlockId, student: learner, resource, pricePaid: 10 }],
  credittransactions: [
    { _id: 'grant', type: 'initial_grant', toUser: learner, amount: 100 },
    { _id: 'payment', type: 'session_payment', session: sessionId,
      fromUser: learner, toUser: tutor, amount: 20 },
    { _id: 'reward', type: 'assessment_reward', assessment, toUser: learner, amount: 30 },
    { _id: 'unlock-ledger', type: 'learning_unlock', unlock: unlockId,
      fromUser: learner, resource, amount: 10 },
    { _id: 'adjust-credit', type: 'admin_adjustment', adjustmentTarget: learner,
      adjustmentActor: admin, adjustmentDirection: 'credit', adjustmentReason: 'Corrected verified award',
      adjustmentReference: reference, toUser: learner, amount: 5 },
    { _id: 'adjust-debit', type: 'admin_adjustment', adjustmentTarget: learner,
      adjustmentActor: admin, adjustmentDirection: 'debit', adjustmentReason: 'Reversed extra award',
      adjustmentReference: '39b87911-991e-4fd4-a771-8138bbd9f6e2', fromUser: learner, amount: 3 },
  ],
});

const database = (data, indexData = indexes) => ({
  collection(name) {
    return {
      find() {
        return { batchSize() { return this; },
          async *[Symbol.asyncIterator]() { yield* data[name] || []; } };
      },
      async indexes() { return indexData[name] || []; },
      // No write methods: a write in the dry-run would fail this test.
    };
  },
});

test('credit dry-run reports clean ledger coverage, legacy uncertainty, and all required indexes without writes', async () => {
  const report = await runDryRun(database(fixture()));
  assert.equal(report.mode, 'read_only_dry_run');
  assert.equal(report.totalUsers, 3);
  assert.deepEqual(report.transactionsByType, {
    initial_grant: 1, session_payment: 1, assessment_reward: 1,
    learning_unlock: 1, admin_adjustment: 2,
  });
  assert.equal(report.legacyUnreconcilableUsers, 1); // Tutor has no opening grant evidence.
  assert.deepEqual(report.legacyUnreconcilableSamples, [tutor]);
  assert.ok(Object.values(report.anomalies).every((count) => count === 0));
  assert.equal(report.indexReadiness.length, 9);
  assert.ok(report.indexReadiness.every((row) => row.ready));
});

test('credit dry-run flags structural anomalies and missing/mismatched unique indexes', async () => {
  const data = fixture();
  data.users[0].credits = -1;
  data.credittransactions.push(
    { _id: 'duplicate-grant', type: 'initial_grant', toUser: learner, amount: 100 },
    { _id: 'invalid-amount', type: 'assessment_reward', toUser: learner,
      assessment: '507f1f77bcf86cd799439099', amount: 0.5 },
    { _id: 'broken-payment', type: 'session_payment', session: sessionId,
      fromUser: tutor, toUser: learner, amount: 2 },
    { _id: 'orphan-ledger', type: 'learning_unlock', unlock: '507f1f77bcf86cd799439099',
      fromUser: learner, resource: '507f1f77bcf86cd799439099', amount: 10 },
    { _id: 'bad-adjustment', type: 'admin_adjustment', adjustmentTarget: learner,
      adjustmentDirection: 'debit', toUser: learner, amount: 2 },
  );
  data.learningunlocks.push({ _id: 'unmatched-entitlement', student: tutor, resource, pricePaid: 10 });
  const incompleteIndexes = { ...indexes,
    credittransactions: indexes.credittransactions.filter((index) => index.name !== 'uniq_admin_adjustment_reference') };
  const report = await runDryRun(database(data, incompleteIndexes));
  assert.equal(report.anomalies.negativeUserBalance, 1);
  assert.equal(report.anomalies.duplicateLookingEvent, 2);
  assert.equal(report.anomalies.invalidTransactionAmount, 1);
  assert.equal(report.anomalies.brokenSessionPayment, 1);
  assert.equal(report.anomalies.orphanLearningUnlockLedger, 1);
  assert.equal(report.anomalies.orphanLearningEntitlement, 1);
  assert.equal(report.anomalies.malformedAdminAdjustment, 1);
  assert.equal(report.indexReadiness.find((index) => index.name === 'uniq_admin_adjustment_reference').ready, false);
  assert.deepEqual(report.samples.brokenSessionPayment, ['broken-payment']);
  assert.equal(hasIndex([{ ...indexes.credittransactions[0], unique: false }],
    'uniq_session_payment_session', { session: 1, type: 1 },
    { type: 'session_payment', session: { $exists: true } }), false);
});
