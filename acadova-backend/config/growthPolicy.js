// Foundations only. There is deliberately no environment-only activation switch.
// Credit writers and in-flight settlements must cut over together in a reviewed release.
const EXP_ACTIVE = false;
const policyVersion = 'exp-foundation-1';
const requiredCutoverEvidence = Object.freeze([
  'transactionsVerified', 'uniqueIndexesVerified', 'creditReconciliationPassed',
  'inFlightSessionsReconciled', 'allCreditWritersRetired', 'legacyClientsCovered',
  'awardRaceTestsPassed', 'reversalTestsPassed', 'frontendCutoverPassed',
]);
function evaluateCutover(evidence = {}) {
  const blockers = requiredCutoverEvidence.filter(key => evidence[key] !== true);
  return { ready: blockers.length === 0, active: EXP_ACTIVE, blockers };
}
// Operator configuration only; none of these values can activate EXP.
function expEnginePolicy(env = process.env) {
  const number = (key, fallback, max) => {
    const raw = env[key] === undefined ? String(fallback) : env[key];
    if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) > max) {
      throw Object.assign(new Error('EXP policy configuration is invalid.'), { code: 'EXP_POLICY_INVALID', status: 503 });
    }
    return Number(raw);
  };
  return Object.freeze({
    version: 'exp-engine-1',
    assessmentAmount: number('EXP_ASSESSMENT_AMOUNT', 20, 1000),
    tutoringAmount: number('EXP_TUTORING_AMOUNT', 50, 1000),
    minimumMinutes: number('EXP_MINIMUM_TUTORING_MINUTES', 15, 240),
    reportWindowHours: number('EXP_REPORT_WINDOW_HOURS', 48, 720),
    dailyAwards: number('EXP_DAILY_AWARDS', 5, 100), weeklyAwards: number('EXP_WEEKLY_AWARDS', 20, 500),
    tutoringDaily: number('EXP_TUTORING_DAILY_AWARDS', 2, 20), tutoringWeekly: number('EXP_TUTORING_WEEKLY_AWARDS', 8, 100),
    pairDaily: number('EXP_PAIR_DAILY_AWARDS', 1, 5), pairWeekly: number('EXP_PAIR_WEEKLY_AWARDS', 2, 10),
  });
}
module.exports = { EXP_ACTIVE, policyVersion, requiredCutoverEvidence, evaluateCutover, expEnginePolicy };
