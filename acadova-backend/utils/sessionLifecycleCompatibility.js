// Canonical lifecycle vocabulary; scheduled and declined are the only newly
// writable canonical statuses in P2.4.
const CANONICAL_STATUSES = Object.freeze([
  'pending', 'scheduled', 'in_progress', 'awaiting_validation', 'completed',
  'declined', 'cancelled', 'no_show', 'disputed', 'resolved',
]);

const LEGACY_STATUS_MAP = Object.freeze({
  pending: 'pending',
  accepted: 'scheduled',
  scheduled: 'scheduled',
  rejected: 'declined',
  declined: 'declined',
  cancelled: 'cancelled',
});

const idOf = (value) => {
  const id = value?._id ?? value;
  return id == null ? null : String(id).toLowerCase();
};

const matchesPayment = (session, transaction) => (
  idOf(transaction.session) === idOf(session._id)
  && idOf(transaction.fromUser) === idOf(session.learner)
  && idOf(transaction.toUser) === idOf(session.tutor)
  && transaction.amount === session.creditAmount
  && transaction.type === 'session_payment'
);

// Pass all ledger rows found for this Session, including duplicates. This
// function only classifies evidence; it never queries or updates MongoDB.
function classifyLegacySession(session, transactions = []) {
  const legacyStatus = session.status;
  const base = { legacyStatus, canonicalStatus: LEGACY_STATUS_MAP[legacyStatus] ?? null };

  if (legacyStatus === 'completed') {
    if (transactions.length === 1 && matchesPayment(session, transactions[0])) {
      return { ...base, canonicalStatus: 'completed', settlementState: 'settled', requiresReconciliation: false };
    }
    const conflicting = transactions.length > 0 || Boolean(session.confirmedAt || session.creditsSettledAt);
    return {
      ...base,
      canonicalStatus: 'awaiting_validation',
      settlementState: conflicting ? 'inconsistent' : 'unverified',
      requiresReconciliation: true,
    };
  }

  if (!base.canonicalStatus || transactions.length > 0 || session.completedAt || session.confirmedAt || session.creditsSettledAt) {
    return { ...base, settlementState: 'inconsistent', requiresReconciliation: true };
  }
  return { ...base, settlementState: 'not_applicable', requiresReconciliation: false };
}

module.exports = { CANONICAL_STATUSES, classifyLegacySession };
