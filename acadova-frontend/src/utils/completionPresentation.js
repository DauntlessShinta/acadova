export const entityId = (value) => String(value?._id || value?.id || value || '');
export const safeEvidenceLink = (value) => {
  try { const url = new URL(value); return url.protocol === 'https:' && Boolean(url.hostname)
    && !url.username && !url.password && value.length <= 500; } catch { return false; }
};
export function evidenceErrors({ summary, completedWork, links }) {
  const errors = {};
  if (summary.trim().length < 10 || summary.length > 1000) errors.summary = 'Write a session summary of 10–1000 characters.';
  if (completedWork.trim().length < 10 || completedWork.length > 2000) errors.completedWork = 'Describe completed work in 10–2000 characters.';
  if (links.length > 5 || links.some((link) => !safeEvidenceLink(link))) errors.links = 'Use up to five HTTPS links without embedded credentials.';
  return errors;
}
export function completionCopy(row) {
  const state = row.completionReview?.state;
  if (row.status === 'resolved') return row.resolution === 'confirm_session'
    ? 'Staff approved completion. Credits transferred once.' : 'Staff did not validate completion. No credits transferred.';
  if (row.status === 'completed' && !row.creditsSettledAt && !row.ratingEligible) return row.awaitingValidationAt
    ? 'Completion settlement has not been verified. Refresh the session details before taking another action.'
    : 'Legacy tutor-marked completion awaits Learner confirmation. No deadline was imposed; use the existing confirmation action.';
  if (row.status === 'completed') return 'Completion is settled. A closed staff referral cannot pay again.';
  if (state === 'referred' || (row.reviewReferral && !row.reviewReferral.closedAt)) return 'Staff review pending. You may still confirm honestly before a staff decision. Referral does not guarantee payment or a human response time.';
  if (state === 'overdue') return 'Response deadline passed. Staff review is eligible and the worker will refer this unresolved session. Silence does not approve or penalize anyone.';
  if (row.status === 'disputed') return 'A participant dispute is awaiting staff review. Add relevant evidence or answer a clarification request.';
  if (row.status === 'no_show') return 'No-show evidence is recorded. No credits transferred. Add relevant evidence or submit an explicit dispute if you disagree.';
  if (row.status === 'awaiting_validation' && !row.validationDeadlineAt) return 'Historical session: no automatic deadline or referral. The Tutor may submit evidence and request a voluntary review.';
  return 'Tutor finish records that the live session ended. Each participant must separately confirm completion. The second positive confirmation transfers credits once.';
}
