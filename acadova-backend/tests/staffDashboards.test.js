const test = require('node:test');
const assert = require('node:assert/strict');
const { auditFilters } = require('../utils/auditFilters');
const { MODERATION_ACTIONS, LOGIN_ACTIONS } = require('../utils/staffDashboardDefinitions');

test('Trust filters validate inclusive UTC dates and bound record pages', () => {
  const parsed = auditFilters({ scope: 'activity', from: '2024-02-29', to: '2024-02-29', q: 'C++' });
  assert.equal(parsed.limit, 25); assert.equal(parsed.filter.createdAt.$lt.toISOString(), '2024-03-01T00:00:00.000Z');
  for (const query of [{ scope: 'other' }, { page: '-1' }, { limit: '101' }, { q: ['x'] }, { q: 'x'.repeat(81) },
    { from: '2026-02-29', to: '2026-03-01' }, { from: '2026-01-01' }, { actor: 'bad' }, { targetId: 'bad' }, { token: 'private' },
    { scope: 'activity', period: '7d' }, { scope: 'security', period: 'year' }, { scope: 'security', period: '7d', from: '2026-01-01', to: '2026-01-02' }]) assert.throws(() => auditFilters(query));
  const rolling = auditFilters({ scope: 'security', period: '24h' }).filter.createdAt;
  assert.equal(rolling.$lte - rolling.$gte, 86400000);
});

test('Trust event scopes separate administrative and recorded security activity', () => {
  const security = auditFilters({ scope: 'security', securityCategory: 'cooldown' });
  assert.deepEqual(security.filter.action.$in, ['security.login_cooldown_started', 'security.login_cooldown_extended']);
  const activity = auditFilters({ scope: 'activity' }); assert.ok(activity.filter.action.$in.every(action => !LOGIN_ACTIONS.includes(action)));
  assert.throws(() => auditFilters({ scope: 'activity', action: 'security.login_cooldown_started' }));
  assert.throws(() => auditFilters({ scope: 'security', securityCategory: 'invented' }));
  assert.ok(MODERATION_ACTIONS.every(action => !action.startsWith('security.') && !action.startsWith('user.') && !action.startsWith('credit.')));
});
