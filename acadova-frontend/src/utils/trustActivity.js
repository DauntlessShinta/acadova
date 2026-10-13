export const auditActions = ['study.publication_decided', 'study.report_closed', 'session.dispute_resolved', 'session.completion_review_resolved', 'session.review_clarification_requested', 'credit.rules_changed', 'credit.admin_adjustment',
  'learning.topic_created', 'learning.topic_published', 'learning.topic_archived',
  'learning.resource_approved', 'learning.resource_rejected', 'learning.resource_archived',
  'learning.module_created', 'learning.module_published', 'learning.module_archived',
  'learning.assessment_created', 'learning.assessment_published',
  'review.moderated', 'user.suspended', 'user.reactivated', 'user.role_changed',
  'security.login_cooldown_started', 'security.login_cooldown_extended',
  'security.login_success_after_failures', 'security.suspended_account_login_attempt',
  'learning.topic_updated', 'learning.resource_created', 'learning.resource_updated',
  'learning.module_updated', 'learning.assessment_updated'];

export const securityActions = auditActions.filter(action => action.startsWith('security.'));
export const targets = ['Session', 'User', 'Rating', 'LearningTopic', 'LearningResource', 'LearningModule', 'Assessment', 'CreditConfig', 'CreditTransaction', 'StudySet', 'StudyReport'];
export function trustTab(params) { return ['activity', 'security', 'protection'].includes(params.get('tab')) ? params.get('tab') : 'activity'; }
export function trustAuditQuery(query) {
  const scope = query.tab === 'activity' ? 'activity' : 'security';
  const rolling = scope === 'security' && ['24h', '7d'].includes(query.period);
  return Object.fromEntries(Object.entries({ scope, page: query.page || '1', limit: '25', from: rolling ? undefined : query.from, to: rolling ? undefined : query.to, period: rolling ? query.period : undefined,
    q: query.q, category: scope === 'activity' ? query.category : 'security', action: query.action,
    actor: scope === 'activity' ? query.actor : undefined, targetType: query.targetType,
    targetId: query.targetId, securityCategory: scope === 'security' ? query.securityCategory : undefined }).filter(([, value]) => value));
}
export function legacyTrustUrl(path, search) {
  const params = new URLSearchParams(search);
  const security = path.endsWith('/security') || params.get('category') === 'security' || params.get('action')?.startsWith('security.');
  params.set('tab', security ? 'security' : 'activity');
  if (params.get('category') === 'security') params.delete('category');
  if (path.endsWith('/security')) {
    if (!params.has('period')) params.set('period', '24h');
    if (params.has('account')) { params.set('targetId', params.get('account')); params.delete('account'); }
    if (params.has('category')) { params.set('securityCategory', params.get('category')); params.delete('category'); }
  }
  return '/admin/trust-activity?' + params;
}
