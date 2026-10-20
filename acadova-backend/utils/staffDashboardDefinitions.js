const { ACTIONS } = require('../services/auditService');

const LOGIN_ACTIONS = [ACTIONS.loginCooldownStarted, ACTIONS.loginCooldownExtended,
  ACTIONS.loginSuccessAfterFailures, ACTIONS.suspendedLoginAttempt];
const REVIEW_ACTIONS = [ACTIONS.studyDecision, ACTIONS.studyReportClosed, ACTIONS.circleReview, ACTIONS.review,
  ACTIONS.resourcePublished, ACTIONS.resourceRejected, ACTIONS.resourceArchived,
  ACTIONS.topicPublished, ACTIONS.topicArchived, ACTIONS.modulePublished,
  ACTIONS.moduleArchived, ACTIONS.assessmentPublished];
const SESSION_DECISIONS = [ACTIONS.dispute, ACTIONS.completionReview];
const MODERATION_ACTIONS = [...REVIEW_ACTIONS, ...SESSION_DECISIONS];
const ADMIN_ACTIONS = [ACTIONS.role, ACTIONS.suspended, ACTIONS.reactivated, ACTIONS.rules, ACTIONS.adjustment];

module.exports = { LOGIN_ACTIONS, REVIEW_ACTIONS, SESSION_DECISIONS, MODERATION_ACTIONS, ADMIN_ACTIONS };
