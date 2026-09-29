const test = require('node:test');
const assert = require('node:assert/strict');
const { CANONICAL_STATUSES, classifyLegacySession } = require('../utils/sessionLifecycleCompatibility');

const session = (overrides = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  learner: '507f1f77bcf86cd799439012',
  tutor: '507f1f77bcf86cd799439013',
  status: 'completed',
  creditAmount: 2,
  completedAt: new Date('2026-08-25T10:00:00Z'),
  ...overrides,
});

const payment = (overrides = {}) => ({
  session: '507f1f77bcf86cd799439011',
  fromUser: '507f1f77bcf86cd799439012',
  toUser: '507f1f77bcf86cd799439013',
  amount: 2,
  type: 'session_payment',
  ...overrides,
});

test('legacy non-completed statuses have canonical meanings without enabling new writes', () => {
  assert.deepEqual(CANONICAL_STATUSES, [
    'pending', 'scheduled', 'in_progress', 'awaiting_validation', 'completed',
    'declined', 'cancelled', 'no_show', 'disputed', 'resolved',
  ]);
  for (const [stored, canonical] of [
    ['pending', 'pending'], ['accepted', 'scheduled'],
    ['rejected', 'declined'], ['cancelled', 'cancelled'],
  ]) {
    assert.deepEqual(classifyLegacySession(session({ status: stored, completedAt: undefined })), {
      legacyStatus: stored,
      canonicalStatus: canonical,
      settlementState: 'not_applicable',
      requiresReconciliation: false,
    });
  }
});

test('a matching ledger row proves historical settlement even without confirmation timestamps', () => {
  for (const fields of [
    {},
    { confirmedAt: undefined, creditsSettledAt: new Date() },
    { confirmedAt: new Date(), creditsSettledAt: undefined },
  ]) {
    const result = classifyLegacySession(session(fields), [payment()]);
    assert.equal(result.canonicalStatus, 'completed');
    assert.equal(result.settlementState, 'settled');
    assert.equal(result.requiresReconciliation, false);
  }
});

test('a completed session without a ledger row is not safely settled', () => {
  assert.deepEqual(classifyLegacySession(session()), {
    legacyStatus: 'completed',
    canonicalStatus: 'awaiting_validation',
    settlementState: 'unverified',
    requiresReconciliation: true,
  });
});

test('incorrect payment fields and duplicate payments require reconciliation', () => {
  for (const invalid of [
    payment({ session: '507f1f77bcf86cd799439014' }),
    payment({ fromUser: '507f1f77bcf86cd799439014' }),
    payment({ toUser: '507f1f77bcf86cd799439014' }),
    payment({ amount: 1 }),
    payment({ type: 'other' }),
  ]) {
    const result = classifyLegacySession(session(), [invalid]);
    assert.equal(result.canonicalStatus, 'awaiting_validation');
    assert.equal(result.settlementState, 'inconsistent');
    assert.equal(result.requiresReconciliation, true);
  }
  const duplicate = classifyLegacySession(session(), [payment(), payment()]);
  assert.equal(duplicate.settlementState, 'inconsistent');
  assert.equal(duplicate.requiresReconciliation, true);
});

test('ratings and timestamps cannot establish settlement without a matching ledger row', () => {
  const withRating = session({ ratings: [{ rating: 5 }] });
  assert.equal(classifyLegacySession(withRating).settlementState, 'unverified');
  const withTimestamps = session({ confirmedAt: new Date(), creditsSettledAt: new Date() });
  assert.equal(classifyLegacySession(withTimestamps).settlementState, 'inconsistent');
  assert.equal(classifyLegacySession(withTimestamps, [payment({ amount: 1 })]).canonicalStatus, 'awaiting_validation');
});

test('classification does not mutate session, ledger rows, or timestamps', () => {
  const completedAt = new Date('2026-08-25T10:00:00Z');
  const item = Object.freeze(session({ completedAt }));
  const row = Object.freeze(payment());
  const rows = Object.freeze([row]);
  const originalTime = completedAt.getTime();
  classifyLegacySession(item, rows);
  assert.equal(item.status, 'completed');
  assert.equal(item.confirmedAt, undefined);
  assert.equal(item.creditsSettledAt, undefined);
  assert.equal(completedAt.getTime(), originalTime);
  assert.equal(rows.length, 1);
  assert.equal(row.amount, 2);
});
