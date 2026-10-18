export const isInlineAiError = error => [400, 413].includes(error?.status)
  && !['AI_STUDY_BAD_OUTPUT', 'AI_STUDY_INSUFFICIENT_SOURCE'].includes(error?.code || error?.data?.code);
export const isGenerationPage = (job, location) => job?.resumePath === location.pathname + location.search;
export function failureRecovery(code) {
  if (['AI_STUDY_BAD_OUTPUT', 'AI_STUDY_INSUFFICIENT_SOURCE'].includes(code)) return 'Use a text-based source with more distinct facts, or request fewer items. Strict Source needs exact evidence for every answer and quiz choice.';
  if (['AI_STUDY_QUOTA', 'AI_STUDY_PROVIDER_LIMIT', 'AI_STUDY_BUSY'].includes(code)) return 'Wait for the limit to reset or processing capacity to become available. Saved study sets remain accessible.';
  if (code === 'AI_STUDY_TIMEOUT') return 'Try fewer pages or slides. A retry starts a new request and can count toward your daily limit.';
  return 'Check your connection and the selected material, then retry when ready. A new generation request can count toward your daily limit.';
}
