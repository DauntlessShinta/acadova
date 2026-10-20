const test = require('node:test');
const assert = require('node:assert/strict');
test('staff email uses existing Brevo API, bounded timeout and no tokens or links', async t => {
  const previous = { BREVO_API_KEY: process.env.BREVO_API_KEY, MAIL_FROM: process.env.MAIL_FROM };
  process.env.BREVO_API_KEY = 'synthetic-never-real'; process.env.MAIL_FROM = 'Acadova <synthetic@example.test>';
  t.after(() => { for (const [k, v] of Object.entries(previous)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
  let sent;
  t.mock.method(global, 'fetch', async (url, options) => { assert.equal(url, 'https://api.brevo.com/v3/smtp/email'); sent = JSON.parse(options.body); assert.ok(options.signal); return { ok: true }; });
  await require('../services/emailService').sendStaffMfaEmail({ recipient: 'syntheticstaff@example.test', code: '123456' });
  assert.equal(sent.subject, 'Your Acadova Staff Verification Code');
  assert.match(sent.textContent, /five minutes/); assert.match(sent.textContent, /Do not share/);
  assert.equal(/https?:|password|Bearer/.test(sent.textContent), false);
  t.mock.method(global, 'fetch', async () => { throw new Error('synthetic provider details must not escape'); });
  await assert.rejects(require('../services/emailService').sendStaffMfaEmail({ recipient: 'syntheticstaff@example.test', code: '654321' }), { message: 'Verification email delivery failed' });
});
