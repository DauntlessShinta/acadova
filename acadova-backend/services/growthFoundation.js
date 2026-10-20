const { EXP_ACTIVE, policyVersion, evaluateCutover } = require('../config/growthPolicy');
const same = (a, b) => a != null && b != null && String(a) === String(b);
const date = value => value != null && Number.isFinite(new Date(value).getTime());

// Inputs must be server-loaded records, never client-supplied event descriptions.
function assessmentEvent(owner, attempt, assessment) {
  if (!attempt?._id || !same(attempt?.student, owner) || !same(attempt.assessment, assessment?._id)
    || assessment.status !== 'published' || attempt.mode !== 'official' || attempt.passed !== true
    || !date(attempt.submittedAt)) return null;
  return { owner, kind: 'official_assessment', eventKey: `assessment:${assessment._id}`, sourceId: attempt._id };
}
function tutoringEvent(owner, session) {
  if (!session || session.lifecycleVersion !== 1 || session.status !== 'completed'
    || !same(session.tutor, owner) || same(session.tutor, session.learner)
    || session.disputedAt || session.reviewIndicators?.length
    || !['scheduledAt', 'learnerCheckedInAt', 'tutorCheckedInAt', 'startedAt', 'awaitingValidationAt',
      'learnerConfirmedAt', 'tutorConfirmedAt', 'completedAt'].every(key => date(session[key]))) return null;
  const at = key => new Date(session[key]).getTime();
  if (Math.max(at('learnerCheckedInAt'), at('tutorCheckedInAt')) > at('startedAt')
    || at('startedAt') > at('awaitingValidationAt')
    || at('awaitingValidationAt') > Math.min(at('learnerConfirmedAt'), at('tutorConfirmedAt'))
    || Math.max(at('learnerConfirmedAt'), at('tutorConfirmedAt')) > at('completedAt')) return null;
  return { owner, kind: 'verified_tutoring', eventKey: `session:${session._id}`, sourceId: session._id };
}
function withinTutoringCaps({ earnedToday, earnedThisWeek, pairSubjectAwardsToday }) {
  // Proposed launch safeguards, inactive until the full cutover is verified.
  return Number.isSafeInteger(earnedToday) && earnedToday >= 0 && earnedToday < 2
    && Number.isSafeInteger(earnedThisWeek) && earnedThisWeek >= 0 && earnedThisWeek < 8
    && pairSubjectAwardsToday === 0;
}
function requireExpActivation() {
  if (!EXP_ACTIVE && !require('../config/studentExperience').active()) throw Object.assign(new Error('EXP awards are not activated. Existing credits remain operational.'), { status: 503, code: 'EXP_NOT_ACTIVE' });
}
function correctionEntry(original, actor, reason) {
  // Pure preparation for a future transaction writer. A correction appends the
  // exact inverse; it never changes a historical award or a credit balance.
  const note = typeof reason === 'string' ? reason.trim() : '';
  if (!original?._id || !original.owner || !original.sourceId || !['official_assessment','verified_tutoring'].includes(original.kind) || !Number.isSafeInteger(original.delta) || original.delta <= 0
    || original.delta > 1000 || actor?.role !== 'admin' || actor.suspendedAt || actor.emailVerified === false
    || !actor._id || same(actor._id, original.owner) || note.length < 10 || note.length > 500 || /[\p{Cc}\p{Cf}]/u.test(note)) {
    throw Object.assign(new Error('A correction needs an authorized independent Administrator, an original award and an audit reason.'), { status: 403 });
  }
  return { owner: original.owner, kind: 'reversal', eventKey: `reversal:${original._id}`, sourceId: original.sourceId,
    reversalOf: original._id, actor: actor._id, delta: -original.delta, reason: note, policyVersion };
}
function growthStatus() {
  return { ...require('../config/studentExperience').capabilities(), active: EXP_ACTIVE || require('../config/studentExperience').active(), policyVersion, totalExp: null, events: [],
    message: 'EXP recognition is not active yet. Historical credits are not converted to EXP.',
    cutover: evaluateCutover(), eligibleEvents: ['First valid official assessment completion', 'Verified peer-tutoring contribution'] };
}
module.exports = { assessmentEvent, tutoringEvent, withinTutoringCaps, requireExpActivation, correctionEntry, growthStatus };
