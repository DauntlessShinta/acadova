const test = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyMigrationRecord, createReport, addRecord, runDryRun,
} = require('../utils/sessionMigrationDryRun');

const ids = {
  session: '507f1f77bcf86cd799439011', learner: '507f1f77bcf86cd799439012',
  tutor: '507f1f77bcf86cd799439013', other: '507f1f77bcf86cd799439014',
};
const session = (overrides = {}) => ({
  _id: ids.session, learner: ids.learner, tutor: ids.tutor,
  status: 'completed', creditAmount: 2, ...overrides,
});
const payment = (overrides = {}) => ({
  session: ids.session, fromUser: ids.learner, toUser: ids.tutor,
  amount: 2, type: 'session_payment', ...overrides,
});

test('safe legacy aliases map to scheduled and declined; pending and cancelled stay unchanged', () => {
  for (const [stored, canonical, proposed] of [
    ['accepted', 'scheduled', 'scheduled'], ['rejected', 'declined', 'declined'],
    ['pending', 'pending', null], ['cancelled', 'cancelled', null],
  ]) {
    const result = classifyMigrationRecord(session({ status: stored }));
    assert.equal(result.canonicalStatus, canonical);
    assert.equal(result.proposedStatus, proposed);
    assert.equal(result.reasons.length, 0);
    assert.equal(result.safeAliasMapping, proposed !== null);
  }
});

test('valid historical payment proves settlement without backfilling missing timestamps', () => {
  const record = Object.freeze(session());
  const row = Object.freeze(payment());
  const result = classifyMigrationRecord(record, [row]);
  assert.equal(result.canonicalStatus, 'completed');
  assert.equal(result.settlementEvidence, 'valid_matching_settlement');
  assert.equal(result.reasons.length, 0);
  assert.equal(record.confirmedAt, undefined);
  assert.equal(record.learnerConfirmedAt, undefined);
});

test('missing and each mismatched payment field require review', () => {
  assert.equal(classifyMigrationRecord(session()).settlementEvidence, 'no_settlement_evidence');
  for (const bad of [
    payment({ session: ids.other }), payment({ fromUser: ids.other }),
    payment({ toUser: ids.other }), payment({ amount: 1 }), payment({ type: 'other' }),
  ]) {
    const result = classifyMigrationRecord(session(), [bad]);
    assert.equal(result.settlementEvidence, 'mismatched_settlement');
    assert.equal(result.settlementState, 'inconsistent');
    assert.equal(result.canonicalStatus, 'awaiting_validation');
  }
});

test('duplicate or contradictory rows are not auto-settled', () => {
  const result = classifyMigrationRecord(session(), [payment(), payment({ amount: 1 })]);
  assert.equal(result.settlementEvidence, 'duplicate_or_contradictory_evidence');
  assert.equal(result.evidence.paymentRows, 2);
  assert.equal(result.evidence.matchingPaymentRows, 1);
  assert.equal(result.settlementState, 'inconsistent');
});

test('ratings and timestamps cannot substitute for matching ledger evidence', () => {
  const result = classifyMigrationRecord(session({
    confirmedAt: new Date('2026-09-26T10:00:00Z'),
    creditsSettledAt: new Date('2026-09-26T10:00:00Z'),
  }), [], 1);
  assert.equal(result.settlementEvidence, 'no_settlement_evidence');
  assert.ok(result.reasons.includes('ratings_without_settlement_evidence'));
  assert.ok(result.reasons.includes('timestamps_inconsistent_with_ledger_evidence'));
});

test('valid payment with contradictory timestamps remains settled but flagged for review', () => {
  const result = classifyMigrationRecord(session({
    completedAt: new Date('2026-09-26T10:00:00Z'),
    creditsSettledAt: new Date('2026-09-25T10:00:00Z'),
  }), [payment()]);
  assert.equal(result.settlementState, 'settled');
  assert.ok(result.reasons.includes('timestamps_inconsistent_with_ledger_evidence'));
});

test('all canonical statuses remain unchanged', () => {
  for (const status of [
    'scheduled', 'in_progress', 'awaiting_validation', 'declined',
    'no_show', 'disputed', 'resolved',
  ]) {
    const result = classifyMigrationRecord(session({ status }));
    assert.equal(result.canonicalStatus, status);
    assert.equal(result.proposedStatus, null);
  }
});

test('report separates completed evidence categories and safe alias candidates', () => {
  const report = createReport();
  addRecord(report, session({ _id: 'a', status: 'accepted' }));
  addRecord(report, session({ _id: 'b', status: 'accepted' }), [payment({ session: 'b' })]);
  addRecord(report, session({ _id: 'c', status: 'rejected' }));
  addRecord(report, session({ _id: 'd' }), [payment({ session: 'd' })]);
  addRecord(report, session({ _id: 'e' }));
  addRecord(report, session({ _id: 'f' }), [payment({ session: 'f', amount: 1 })]);
  addRecord(report, session({ _id: 'g' }), [payment({ session: 'g' }), payment({ session: 'g' })]);
  assert.equal(report.totalSessions, 7);
  assert.deepEqual(report.proposedMappings.acceptedToScheduled, { total: 2, safeCandidate: 1, reviewRequired: 1 });
  assert.deepEqual(report.proposedMappings.rejectedToDeclined, { total: 1, safeCandidate: 1, reviewRequired: 0 });
  assert.equal(report.completedEvidence.validMatchingSettlement, 1);
  assert.equal(report.completedEvidence.noSettlementEvidence, 1);
  assert.equal(report.completedEvidence.mismatchedSettlement, 1);
  assert.equal(report.completedEvidence.duplicateOrContradictoryEvidence, 1);
});

const fakeDatabase = (sessions, payments, ratings, operations) => ({
  collection(name) {
    return {
      find(filter, options = {}) {
        operations.push({ operation: 'find', collection: name });
        const rows = name === 'sessions' ? sessions : name === 'credittransactions' ? payments : ratings;
        const selected = name === 'sessions' ? rows : rows.filter((row) => (
          filter.session.$in.some((id) => String(id) === String(row.session))
        ));
        const projected = options.projection ? selected.map((row) => Object.fromEntries(
          Object.entries(row).filter(([field]) => options.projection[field] === 1)
        )) : selected;
        return {
          sort() { return this; },
          batchSize() { return this; },
          async toArray() { return projected; },
          async *[Symbol.asyncIterator]() { for (const row of projected) yield row; },
        };
      },
      updateOne() { throw new Error('A dry-run must never write'); },
      insertOne() { throw new Error('A dry-run must never write'); },
      deleteOne() { throw new Error('A dry-run must never write'); },
    };
  },
});

test('dry-run loads resolution fields needed to classify canonical resolved Sessions', async () => {
  const resolved = session({
    status: 'resolved', resolution: 'confirm_session',
    disputedAt: new Date('2026-09-24T10:00:00Z'), disputeReason: 'attendance conflict',
    resolvedAt: new Date('2026-09-25T10:00:00Z'), resolvedBy: ids.other,
    resolutionNote: 'reviewed', completedAt: new Date('2026-09-25T10:00:00Z'),
    creditsSettledAt: new Date('2026-09-25T10:00:00Z'),
  });
  const report = await runDryRun(fakeDatabase([resolved], [payment()], [], []));
  assert.equal(report.statusCounts.resolved, 1);
  assert.deepEqual(report.anomalyCounts, {});
});

test('dry-run performs only reads and repeated runs produce identical reports', async () => {
  const sessions = [session({ _id: ids.session }), session({ _id: ids.other, status: 'accepted' })];
  const operations = [];
  const db = fakeDatabase(sessions, [payment()], [{ session: ids.session }], operations);
  const first = await runDryRun(db);
  const second = await runDryRun(db);
  assert.deepEqual(second, first);
  assert.equal(first.totalSessions, 2);
  assert.equal(first.completedEvidence.validMatchingSettlement, 1);
  assert.equal(first.proposedMappings.acceptedToScheduled.safeCandidate, 1);
  assert.deepEqual([...new Set(operations.map((item) => item.operation))], ['find']);
  assert.deepEqual(new Set(operations.map((item) => item.collection)), new Set(['sessions', 'credittransactions', 'ratings']));
});
