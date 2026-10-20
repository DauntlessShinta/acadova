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
  no_show: 'no_show',
  disputed: 'disputed',
  resolved: 'resolved',
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

  if(session.legacyObligationResolvedAt && session.legacyObligationReview && transactions.length===0) return {...base,settlementState:'resolved_no_transfer',requiresReconciliation:false};
  if (session.economyVersion==='free-v1') {
    const clean = transactions.length===0 && session.creditAmount===0 && !session.creditsSettledAt;
    const completed = legacyStatus==='completed' && session.lifecycleVersion===1 && session.completedAt && session.validationSettledAt && session.learnerConfirmedAt && session.tutorConfirmedAt && session.startedAt && session.awaitingValidationAt && session.learnerCheckedInAt && session.tutorCheckedInAt;
    const reviewed = Boolean(session.disputedAt && session.disputeReason) || Boolean(session.reviewReferral?.id && session.reviewReferral.createdAt && session.reviewReferral.reason && session.reviewReferral.closedAt && session.reviewReferral.closure==='staff_resolution' && session.awaitingValidationAt && session.startedAt && session.learnerCheckedInAt && session.tutorCheckedInAt);
    const resolved = legacyStatus==='resolved' && reviewed && session.resolvedAt && session.resolvedBy && session.resolutionNote && (session.resolution==='cancel_session'?!session.completedAt:session.completedAt && session.validationSettledAt);
    const terminal = completed || resolved;
    return {...base, canonicalStatus:legacyStatus, settlementState:clean && (terminal || !session.completedAt)?'not_applicable':'inconsistent', requiresReconciliation:!clean || Boolean(session.completedAt&&!terminal)};
  }
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

  if (legacyStatus === 'resolved') {
    const reviewed = Boolean(session.disputedAt && session.disputeReason) || Boolean(
      session.reviewReferral?.id && session.reviewReferral.createdAt && session.reviewReferral.reason
      && session.reviewReferral.closedAt && session.reviewReferral.closure === 'staff_resolution'
      && session.awaitingValidationAt && session.startedAt && session.learnerCheckedInAt && session.tutorCheckedInAt);
    const valid = session.resolution === 'confirm_session' && reviewed
      && session.resolvedAt && session.resolvedBy && session.resolutionNote
      && session.completedAt && session.creditsSettledAt;
    if (valid && transactions.length === 1 && matchesPayment(session, transactions[0])) {
      return { ...base, settlementState: 'settled', requiresReconciliation: false };
    }
    const invalid = session.resolution === 'cancel_session' && reviewed
      && session.resolvedAt && session.resolvedBy && session.resolutionNote
      && !session.completedAt && !session.creditsSettledAt
      && transactions.length === 0;
    if (invalid) return { ...base, settlementState: 'not_applicable', requiresReconciliation: false };
    return { ...base, settlementState: 'inconsistent', requiresReconciliation: true };
  }

  if (!base.canonicalStatus || transactions.length > 0 || session.completedAt || session.confirmedAt || session.creditsSettledAt) {
    return { ...base, settlementState: 'inconsistent', requiresReconciliation: true };
  }
  return { ...base, settlementState: 'not_applicable', requiresReconciliation: false };
}

const isSessionRatingEligible = (session, transactions = []) => {
  if (session.economyVersion==='free-v1') {
    const state=classifyLegacySession(session,transactions);
    return !state.requiresReconciliation && state.settlementState==='not_applicable' && Boolean(session.validationSettledAt && session.completedAt) && (session.status==='completed' || session.status==='resolved' && session.resolution==='confirm_session');
  }
  if (session.status === 'resolved') {
    return session.resolution === 'confirm_session'
      && classifyLegacySession(session, transactions).settlementState === 'settled';
  }
  return session.status === 'completed'
    && (!session.awaitingValidationAt || Boolean(
      session.learnerConfirmedAt && session.tutorConfirmedAt && session.confirmedAt && session.creditsSettledAt
    ))
    && classifyLegacySession(session, transactions).settlementState === 'settled';
};

module.exports = { CANONICAL_STATUSES, classifyLegacySession, isSessionRatingEligible, matchesPayment };
