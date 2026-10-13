const { ACTIONS } = require('../services/auditService');
const { LOGIN_ACTIONS } = require('./staffDashboardDefinitions');
const { isValidObjectId } = require('../middleware/validation');
const { calendarDate } = require('./analyticsWindow');

function auditFilters(query) {
  const allowed = ['page', 'limit', 'action', 'actor', 'targetType', 'category', 'scope', 'q', 'from', 'to', 'targetId', 'securityCategory', 'period'];
  if (Object.entries(query).some(([key, value]) => !allowed.includes(key) || typeof value !== 'string')) throw new Error('Invalid audit filter.');
  const { page = '1', limit = '25', action, actor, targetType, category, scope, q, from, to, targetId, securityCategory, period } = query;
  const securityGroups = { all: LOGIN_ACTIONS, cooldown: [ACTIONS.loginCooldownStarted, ACTIONS.loginCooldownExtended], login: [ACTIONS.loginSuccessAfterFailures], suspension: [ACTIONS.suspendedLoginAttempt] };
  if (!/^[1-9]\d*$/.test(page) || !/^[1-9]\d*$/.test(limit) || Number(page) > 10000 || Number(limit) > 100
    || (action && !Object.values(ACTIONS).includes(action))
    || (category && !['session', 'credit', 'learning', 'review', 'user', 'security', 'study'].includes(category))
    || (category && action && !action.startsWith(category + '.')) || (actor && !isValidObjectId(actor))
    || (targetId && !isValidObjectId(targetId)) || (scope && !['activity', 'security'].includes(scope))
    || (targetType && !['Session', 'CreditConfig', 'CreditTransaction', 'LearningTopic', 'LearningResource', 'LearningModule', 'Assessment', 'Rating', 'User', 'StudySet', 'StudyReport'].includes(targetType))
    || (securityCategory && (scope !== 'security' || !Object.hasOwn(securityGroups, securityCategory)))
    || (period && (scope !== 'security' || !['24h', '7d'].includes(period) || from || to))
    || (q !== undefined && (!q.trim() || q.trim().length > 80))) throw new Error('Invalid audit filter.');
  const scoped = Object.values(ACTIONS).filter(value => (!scope || (scope === 'security' ? LOGIN_ACTIONS.includes(value) : !LOGIN_ACTIONS.includes(value)))
    && (!category || value.startsWith(category + '.')) && (!securityCategory || securityGroups[securityCategory].includes(value)));
  if (scope && action && !scoped.includes(action)) throw new Error('Action does not belong to this activity view.');
  const filter = { ...(action ? { action } : category || scope ? { action: { $in: scoped } } : {}),
    ...(actor ? { actor } : {}), ...(targetType ? { targetType } : {}), ...(targetId ? { targetId } : {}) };
  if (from !== undefined || to !== undefined) {
    if (!from || !to) throw new Error('Both audit dates are required.');
    calendarDate(from); calendarDate(to);
    const start = new Date(from + 'T00:00:00.000Z'); const end = new Date(to + 'T00:00:00.000Z');
    if (end < start || end - start >= 366 * 86400000) throw new Error('Invalid audit period.');
    filter.createdAt = { $gte: start, $lt: new Date(end.getTime() + 86400000) };
  }
  if (period) { const now = new Date(); filter.createdAt = { $gte: new Date(now.getTime() - (period === '7d' ? 7 : 1) * 86400000), $lte: now }; }
  return { filter, page: Number(page), limit: Number(limit), q: q?.trim(), enhanced: Boolean(scope || q || from || to || targetId || period) };
}
module.exports = { auditFilters };
