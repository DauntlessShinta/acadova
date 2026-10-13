import test from 'node:test';
import assert from 'node:assert/strict';
import { ledgerPresentation, groupTrend, dailyModeration, decisionStatus } from '../src/utils/staffPresentation.js';
import { legacyTrustUrl, trustAuditQuery, trustTab } from '../src/utils/trustActivity.js';

test('ledger presentation distinguishes transfers, debit, issuance and unsupported records', () => {
  assert.deepEqual(ledgerPresentation({ type: 'session_payment', amount: 20, fromUserName: 'Learner', toUserName: 'Tutor' }), { title: 'Learner → Tutor', description: 'Tutoring transfer', direction: 'transfer', amount: '20' });
  assert.equal(ledgerPresentation({ type: 'learning_unlock', amount: 25 }).direction, 'debit');
  assert.equal(ledgerPresentation({ type: 'assessment_reward', amount: 20 }).amount, '+20');
  assert.equal(ledgerPresentation({ type: 'admin_adjustment', amount: 10, adjustmentDirection: 'debit' }).direction, 'debit');
  assert.equal(ledgerPresentation({ type: 'future_type', amount: 10 }).direction, 'recorded');
  assert.equal(ledgerPresentation({ type: 'initial_grant', amount: 'bad' }).amount, 'Unavailable');
  for (const amount of [null, undefined, '', true]) assert.equal(ledgerPresentation({ type: 'assessment_reward', amount }).amount, 'Unavailable');
  assert.equal(ledgerPresentation({ type: 'future_type', amount: 20, adjustmentDirection: 'credit' }).direction, 'recorded');
});

test('moderation days zero-fill without mixing received reports and recorded decisions', () => {
  const rows = dailyModeration({ decisions: [{ _id: '2026-10-01', reviews: 2, sessions: 1 }], reports: [{ _id: '2026-10-02', reports: 3 }] }, { from: '2026-10-01', to: '2026-10-03' });
  assert.deepEqual(rows, [{ date: '2026-10-01', reviews: 2, reports: 0, sessions: 1 }, { date: '2026-10-02', reviews: 0, reports: 3, sessions: 0 }, { date: '2026-10-03', reviews: 0, reports: 0, sessions: 0 }]);
});

test('responsive chart groups preserve all event totals and period boundaries', () => {
  const rows = Array.from({ length: 90 }, (_, i) => ({ date: String(i), reviews: i, reports: 1, sessions: 2 }));
  for (const limit of [10, 30]) {
    const groups = groupTrend(rows, limit); assert.ok(groups.length <= limit);
    for (const key of ['reviews', 'reports', 'sessions']) assert.equal(groups.reduce((sum, row) => sum + row[key], 0), rows.reduce((sum, row) => sum + row[key], 0));
    assert.equal(groups[0].date, '0'); assert.equal(groups.at(-1).through, '89');
  }
});

test('legacy Trust navigation keeps exact filters and routes to the appropriate tab', () => {
  const security = new URL(legacyTrustUrl('/admin/security', '?account=507f1f77bcf86cd799439011&period=7d&category=cooldown'), 'https://example.test');
  assert.equal(security.pathname, '/admin/trust-activity'); assert.equal(security.searchParams.get('tab'), 'security');
  assert.equal(security.searchParams.get('targetId'), '507f1f77bcf86cd799439011'); assert.equal(security.searchParams.get('securityCategory'), 'cooldown');
  assert.equal(new URL(legacyTrustUrl('/admin/audit-logs', '?category=credit&actor=fixture'), 'https://example.test').searchParams.get('actor'), 'fixture');
  assert.equal(new URL(legacyTrustUrl('/admin/audit-logs', '?category=security&action=security.login_cooldown_started'), 'https://example.test').searchParams.get('tab'), 'security');
  assert.equal(trustTab(new URLSearchParams('tab=unknown')), 'activity');
  assert.deepEqual(trustAuditQuery({ tab: 'security', from: '2026-10-01', to: '2026-10-02', actor: 'not-a-security-actor', securityCategory: 'cooldown' }), { scope: 'security', page: '1', limit: '25', from: '2026-10-01', to: '2026-10-02', category: 'security', securityCategory: 'cooldown' });
});

test('decision labels require recorded action or metadata and do not invent severity', () => {
  assert.equal(decisionStatus({ action: 'study.publication_decided', metadata: { newStatus: 'rejected' } }), 'rejected');
  assert.equal(decisionStatus({ action: 'review.moderated' }), 'Recorded');
  assert.equal(decisionStatus({ action: 'session.dispute_resolved' }), 'Resolved');
});
