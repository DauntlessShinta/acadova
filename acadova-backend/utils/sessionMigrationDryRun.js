const { classifyLegacySession, matchesPayment } = require('./sessionLifecycleCompatibility');

const STORED_STATUSES = Object.freeze([
  'pending', 'accepted', 'rejected', 'cancelled', 'completed',
  'scheduled', 'in_progress', 'awaiting_validation', 'declined',
  'no_show', 'disputed', 'resolved',
]);
const BATCH_SIZE = 250;
const MAX_ANOMALY_SAMPLES = 100;

const dateValue = (value) => value ? new Date(value).getTime() : null;
const idOf = (value) => String(value?._id ?? value);

function classifyMigrationRecord(session, transactions = [], ratingCount = 0) {
  const lifecycle = classifyLegacySession(session, transactions);
  const reasons = [];
  let settlementEvidence = 'not_applicable';
  if (session.status === 'completed') {
    settlementEvidence = transactions.length === 0 ? 'no_settlement_evidence'
      : transactions.length > 1 ? 'duplicate_or_contradictory_evidence'
        : matchesPayment(session, transactions[0]) ? 'valid_matching_settlement' : 'mismatched_settlement';
    if (settlementEvidence !== 'valid_matching_settlement') reasons.push(settlementEvidence);
    if (ratingCount > 0 && settlementEvidence !== 'valid_matching_settlement') {
      reasons.push('ratings_without_settlement_evidence');
    }
    const timestampConflict = (
      (settlementEvidence !== 'valid_matching_settlement' && Boolean(session.confirmedAt || session.creditsSettledAt))
      || (session.completedAt && session.creditsSettledAt && dateValue(session.creditsSettledAt) < dateValue(session.completedAt))
      || (session.completedAt && session.confirmedAt && dateValue(session.confirmedAt) < dateValue(session.completedAt))
      || (session.awaitingValidationAt && (!session.learnerConfirmedAt || !session.tutorConfirmedAt))
    );
    if (timestampConflict) reasons.push('timestamps_inconsistent_with_ledger_evidence');
  } else if (lifecycle.requiresReconciliation) {
    reasons.push('status_or_settlement_evidence_inconsistent');
  }
  if (['accepted', 'rejected'].includes(session.status) && ratingCount > 0) {
    reasons.push('rating_on_unfinished_session');
  }
  if (lifecycle.canonicalStatus === null) reasons.push('unknown_status');

  return {
    storedStatus: session.status,
    canonicalStatus: lifecycle.canonicalStatus,
    settlementState: lifecycle.settlementState,
    proposedStatus: session.status === 'accepted' ? 'scheduled'
      : session.status === 'rejected' ? 'declined' : null,
    safeAliasMapping: ['accepted', 'rejected'].includes(session.status) && reasons.length === 0,
    settlementEvidence,
    reasons,
    evidence: {
      paymentRows: transactions.length,
      matchingPaymentRows: transactions.filter((row) => matchesPayment(session, row)).length,
      ratingRows: ratingCount,
      hasCompletedAt: Boolean(session.completedAt),
      hasConfirmedAt: Boolean(session.confirmedAt),
      hasCreditsSettledAt: Boolean(session.creditsSettledAt),
      hasCanonicalConfirmationFields: Boolean(session.awaitingValidationAt || session.learnerConfirmedAt || session.tutorConfirmedAt),
    },
  };
}

function createReport() {
  return {
    mode: 'read_only_dry_run',
    totalSessions: 0,
    statusCounts: Object.fromEntries([...STORED_STATUSES, 'unknown'].map((status) => [status, 0])),
    proposedMappings: {
      acceptedToScheduled: { total: 0, safeCandidate: 0, reviewRequired: 0 },
      rejectedToDeclined: { total: 0, safeCandidate: 0, reviewRequired: 0 },
    },
    completedEvidence: {
      validMatchingSettlement: 0,
      noSettlementEvidence: 0,
      mismatchedSettlement: 0,
      duplicateOrContradictoryEvidence: 0,
      ratingsWithoutSettlementEvidence: 0,
      timestampsInconsistentWithLedgerEvidence: 0,
    },
    anomalyCounts: {},
    anomalySamples: [],
    anomaliesOmitted: 0,
  };
}

function addRecord(report, session, transactions = [], ratingCount = 0) {
  const item = classifyMigrationRecord(session, transactions, ratingCount);
  report.totalSessions += 1;
  const stored = Object.hasOwn(report.statusCounts, item.storedStatus) ? item.storedStatus : 'unknown';
  report.statusCounts[stored] += 1;
  if (item.proposedStatus) {
    const bucket = item.storedStatus === 'accepted'
      ? report.proposedMappings.acceptedToScheduled : report.proposedMappings.rejectedToDeclined;
    bucket.total += 1;
    bucket[item.safeAliasMapping ? 'safeCandidate' : 'reviewRequired'] += 1;
  }
  if (item.storedStatus === 'completed') {
    const evidenceKey = {
      valid_matching_settlement: 'validMatchingSettlement',
      no_settlement_evidence: 'noSettlementEvidence',
      mismatched_settlement: 'mismatchedSettlement',
      duplicate_or_contradictory_evidence: 'duplicateOrContradictoryEvidence',
    }[item.settlementEvidence];
    report.completedEvidence[evidenceKey] += 1;
    if (item.reasons.includes('ratings_without_settlement_evidence')) {
      report.completedEvidence.ratingsWithoutSettlementEvidence += 1;
    }
    if (item.reasons.includes('timestamps_inconsistent_with_ledger_evidence')) {
      report.completedEvidence.timestampsInconsistentWithLedgerEvidence += 1;
    }
  }
  for (const reason of item.reasons) {
    report.anomalyCounts[reason] = (report.anomalyCounts[reason] || 0) + 1;
  }
  if (item.reasons.length > 0) {
    if (report.anomalySamples.length < MAX_ANOMALY_SAMPLES) {
      report.anomalySamples.push({ sessionId: idOf(session._id), classification: item.canonicalStatus, reasons: item.reasons, evidence: item.evidence });
    } else report.anomaliesOmitted += 1;
  }
  return item;
}

async function runDryRun(db) {
  const report = createReport();
  const sessions = db.collection('sessions').find({}, {
    projection: {
      _id: 1, learner: 1, tutor: 1, status: 1, creditAmount: 1,
      completedAt: 1, confirmedAt: 1, creditsSettledAt: 1,
      awaitingValidationAt: 1, learnerConfirmedAt: 1, tutorConfirmedAt: 1,
      disputedAt: 1, disputeReason: 1, resolvedAt: 1, resolvedBy: 1,
      resolution: 1, resolutionNote: 1,
    },
  }).sort({ _id: 1 }).batchSize(BATCH_SIZE);
  let batch = [];
  const processBatch = async () => {
    if (batch.length === 0) return;
    const ids = batch.map((session) => session._id);
    const [payments, ratings] = await Promise.all([
      db.collection('credittransactions').find({ session: { $in: ids } }, {
        projection: { session: 1, fromUser: 1, toUser: 1, amount: 1, type: 1, createdAt: 1 },
      }).toArray(),
      db.collection('ratings').find({ session: { $in: ids } }, { projection: { session: 1 } }).toArray(),
    ]);
    const paymentsBySession = new Map();
    const ratingsBySession = new Map();
    for (const payment of payments) {
      const key = idOf(payment.session);
      if (!paymentsBySession.has(key)) paymentsBySession.set(key, []);
      paymentsBySession.get(key).push(payment);
    }
    for (const rating of ratings) {
      const key = idOf(rating.session);
      ratingsBySession.set(key, (ratingsBySession.get(key) || 0) + 1);
    }
    for (const session of batch) {
      const key = idOf(session._id);
      addRecord(report, session, paymentsBySession.get(key) || [], ratingsBySession.get(key) || 0);
    }
    batch = [];
  };
  for await (const session of sessions) {
    batch.push(session);
    if (batch.length === BATCH_SIZE) await processBatch();
  }
  await processBatch();
  return report;
}

module.exports = { STORED_STATUSES, classifyMigrationRecord, createReport, addRecord, runDryRun };
