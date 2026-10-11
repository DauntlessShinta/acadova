const hasCanonicalEvidence = (row) => Boolean(row.awaitingValidationAt && row.startedAt
  && row.learnerCheckedInAt && row.tutorCheckedInAt);
function completionView(row, now = new Date()) {
  const overdue = Boolean(row.validationDeadlineAt && new Date(row.validationDeadlineAt) <= now);
  const active = ['awaiting_validation', 'disputed'].includes(row.status) && row.reviewReferral && !row.reviewReferral.closedAt;
  const state = row.status === 'resolved' ? 'resolved' : row.status === 'completed' ? 'completed'
    : row.status === 'disputed' ? 'disputed' : active ? 'referred' : row.status === 'awaiting_validation'
      ? overdue ? 'overdue' : row.validationDeadlineAt ? 'pending' : 'legacy_pending' : row.status;
  return { state, overdue, canTutorRequestReview: row.status === 'awaiting_validation'
    && hasCanonicalEvidence(row) && !row.reviewReferral && (overdue || !row.validationDeadlineAt),
  staffTargetOverdue: Boolean(active && row.reviewReferral.targetAt && new Date(row.reviewReferral.targetAt) <= now) };
}
module.exports = { completionView, hasCanonicalEvidence };
