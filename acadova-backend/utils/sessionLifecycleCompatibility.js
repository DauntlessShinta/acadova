// Canonical lifecycle vocabulary; write support is rolled out in phases.
const CANONICAL_STATUSES = Object.freeze([
  'pending', 'scheduled', 'in_progress', 'awaiting_validation', 'completed',
  'declined', 'cancelled', 'no_show', 'disputed', 'resolved',
]);

const LEGACY_STATUS_MAP = Object.freeze({
  pending: 'pending',
  accepted: 'scheduled',
  scheduled: 'scheduled',
  in_progress: 'in_progress',
  awaiting_validation: 'awaiting_validation',
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

const isSessionRatingEligible = (session, transactions = []) => (
  session.status === 'completed'
  && (!session.awaitingValidationAt || Boolean(
    session.learnerConfirmedAt && session.tutorConfirmedAt && session.confirmedAt && session.creditsSettledAt
  ))
  && classifyLegacySession(session, transactions).settlementState === 'settled'
);

module.exports = { CANONICAL_STATUSES, classifyLegacySession, isSessionRatingEligible };
