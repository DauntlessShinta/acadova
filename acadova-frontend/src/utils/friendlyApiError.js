// Keep useful field guidance while preventing infrastructure details in alerts.
const fallback = status => status === 401 ? 'Please sign in again to continue.'
  : status === 403 ? 'You do not have access to this action.'
    : status === 404 ? 'This item is unavailable. Return to the previous page and try again.'
      : status === 409 ? 'This item changed. Refresh it before trying again.'
        : status === 423 ? 'Changes to this item are paused. Contact staff if you need help.'
          : status === 429 ? 'Please wait a moment before trying again.'
            : 'We could not complete that action. Please try again.';
export function friendlyApiError(message, status, code) {
  if (status === 503 && ['AI_STUDY_DISABLED', 'AI_STUDY_UNCONFIGURED', 'AI_STUDY_MODEL_INVALID'].includes(code)) return 'AI generation is unavailable right now. Your saved Study Sets are still available.';
  if (typeof message !== 'string' || !message.trim()
    || /\b(?:API|MongoDB|Mongoose|ObjectId|E11000|ECONN\w*|ENOTFOUND|stack trace|transaction|payload|database|backend|provider subscription)\b|https?:\/\/|[a-f\d]{24}/i.test(message)) return fallback(status);
  return message;
}
export const connectionErrorMessage = 'We could not connect to Acadova. Check your connection and try again.';
