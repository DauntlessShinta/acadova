import { toSessionInstant } from './sessionPresentation.js';
export function sessionRequestTimeError(value, now = Date.now()) {
  if (!value) return 'Enter a preferred session date.';
  try {
    const instant = Date.parse(toSessionInstant(value));
    return Number.isFinite(instant) && instant > now ? '' : 'Choose a future session date and time.';
  } catch (error) { return error.message?.includes('does not exist') || error.message?.includes('occurs twice') ? error.message : 'Choose a future session date and time.'; }
}
