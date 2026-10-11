const test = require('node:test');
const assert = require('node:assert/strict');
const { proposalExpiry, proposalExpired, presentSession } = require('../services/rescheduleLifecycle');
const email = require('../services/emailService');
const notifications = require('../services/notificationService');
const id = '11111111-2222-4333-8444-555555555555';
const sessionId = '507f1f77bcf86cd799439011';
const row = (overrides = {}) => ({ rescheduleProposalId: id,
  rescheduleProposedAt: new Date('2026-10-09T01:00:00Z'),
  scheduledAt: new Date('2026-10-10T03:00:00Z'), proposedScheduledAt: new Date('2026-10-11T07:00:00Z'), ...overrides });
test('proposal expiry picks configured lifetime, proposed start or original late window and rejects exactly at expiry', () => {
  const old = process.env.RESCHEDULE_PROPOSAL_HOURS;
  try {
    delete process.env.RESCHEDULE_PROPOSAL_HOURS;
    assert.equal(proposalExpiry(row()).toISOString(), '2026-10-10T01:00:00.000Z');
    process.env.RESCHEDULE_PROPOSAL_HOURS = '2';
    assert.equal(proposalExpiry(row()).toISOString(), '2026-10-09T03:00:00.000Z');
    const proposed = row({ proposedScheduledAt: new Date('2026-10-09T02:00:00Z') });
    assert.equal(proposalExpired(proposed, new Date('2026-10-09T01:59:59.999Z')), false);
    assert.equal(proposalExpired(proposed, new Date('2026-10-09T02:00:00Z')), true);
    assert.equal(proposalExpiry(row({ scheduledAt: new Date('2026-10-08T23:00:00Z') })).toISOString(), '2026-10-09T03:00:00.000Z');
    const snapshot = row({ rescheduleExpiresAt: new Date('2026-10-10T01:00:00Z') });
    assert.equal(proposalExpiry(snapshot).toISOString(), '2026-10-10T01:00:00.000Z', 'Existing snapshot does not change when lifetime config changes');
  } finally { if (old === undefined) delete process.env.RESCHEDULE_PROPOSAL_HOURS; else process.env.RESCHEDULE_PROPOSAL_HOURS = old; }
});
test('legacy missing-time proposal presentation fails closed without inventing schedules or modifying read records', () => {
  const legacy = row({ scheduledAt: undefined, rescheduleProposedAt: undefined });
  const presented = presentSession(legacy, new Date('2026-10-09T09:00:00Z'));
  assert.equal(presented.proposalStatus, 'expired'); assert.equal(presented.scheduledAt, undefined);
  assert.equal(legacy.proposalStatus, undefined);
  assert.equal(presentSession({ status: 'accepted' }).proposalStatus, null);
});
test('proposal links and metadata validation reject forged delivery details', async () => {
  assert.equal(notifications.linkFor({ relatedType: 'Session', relatedId: sessionId, proposal: { proposalId: id } }),
    `/sessions/${sessionId}?target=proposal&proposalId=${id}#session-proposal`);
  await assert.rejects(notifications.publish({ recipient: sessionId, relatedType: 'Session', relatedId: sessionId,
    type: 'session.reschedule_proposed', eventKey: 'test', proposal: { proposalId: id,
      proposedScheduledAt: 'invalid', expiresAt: new Date(), displayTimezone: 'UTC' } }), /Invalid proposal metadata/);
  await assert.rejects(notifications.publish({ recipient: sessionId, relatedType: 'Session', relatedId: sessionId,
    type: 'session.reschedule_proposed', eventKey: 'test', proposal: { proposalId: id,
      proposedScheduledAt: new Date(), expiresAt: new Date(), displayTimezone: 'untrusted' } }), /Invalid proposal metadata/);
});
test('proposal email uses configured frontend, escapes text, has no token and recognizes provider deduplication', async () => {
  const names = ['NODE_ENV', 'FRONTEND_URL', 'BREVO_API_KEY', 'MAIL_FROM'];
  const old = Object.fromEntries(names.map((key) => [key, process.env[key]])); const originalFetch = global.fetch;
  process.env.NODE_ENV = 'production'; process.env.FRONTEND_URL = 'https://acadova.example';
  process.env.BREVO_API_KEY = 'fixture-key'; process.env.MAIL_FROM = 'Acadova <fixture@example.test>';
  const path = `/sessions/${sessionId}?target=proposal&proposalId=${id}#session-proposal`;
  let body;
  global.fetch = async (_url, options) => { body = JSON.parse(options.body); return { ok: true }; };
  try {
    await email.sendProposalEmail({ recipient: 'recipient@example.test', name: '<script>', title: 'New proposal',
      message: 'Proposed UTC time <img src=x>', reviewPath: path, deliveryKey: id });
    assert.equal(body.headers.idempotencyKey, id); assert.ok(body.textContent.includes('https://acadova.example/sessions/'));
    assert.ok(!body.textContent.includes('token=')); assert.ok(!body.htmlContent.includes('<script>'));
    assert.ok(body.htmlContent.includes('&lt;img'));
    assert.throws(() => email.proposalUrlFor('https://evil.example' + path), /Invalid proposal/);
    process.env.FRONTEND_URL = 'http://localhost:5173'; assert.throws(() => email.proposalUrlFor(path), /production frontend/);
    process.env.FRONTEND_URL = 'https://acadova.example';
    global.fetch = async () => ({ ok: false, json: async () => ({ code: 'duplicate_parameter' }) });
    await email.sendProposalEmail({ recipient: 'recipient@example.test', name: 'Fixture', title: 'New proposal', message: 'UTC', reviewPath: path, deliveryKey: id });
  } finally { global.fetch = originalFetch; for (const key of names) { if (old[key] === undefined) delete process.env[key]; else process.env[key] = old[key]; } }
});
