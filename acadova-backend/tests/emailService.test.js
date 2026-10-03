const test = require('node:test');
const assert = require('node:assert/strict');
const { sendVerificationEmail, sendPasswordResetEmail, verificationUrlFor,
  passwordResetUrlFor } = require('../services/emailService');

test('verification email uses Brevo HTTPS without exposing credentials', async (t) => {
  const configKeys = ['FRONTEND_URL', 'BREVO_API_KEY', 'MAIL_FROM', 'NODE_ENV'];
  const original = Object.fromEntries(configKeys.map((key) => [key, process.env[key]]));
  t.after(() => {
    for (const key of configKeys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  Object.assign(process.env, {
    NODE_ENV: 'development',
    FRONTEND_URL: 'https://acadova.example.test/register?old=1',
    BREVO_API_KEY: 'private-brevo-api-key',
    MAIL_FROM: 'Acadova <sender@example.test>',
  });

  const requests = [];
  let failure;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, options });
    if (failure === 'network') throw new Error('private-brevo-api-key token=sample-token');
    if (failure === 'provider') return { ok: false, status: 401 };
    return { ok: true, status: 201 };
  });
  const logged = [];
  t.mock.method(console, 'error', (...parts) => logged.push(parts.join(' ')));
  t.mock.method(console, 'warn', (...parts) => logged.push(parts.join(' ')));

  assert.equal(
    verificationUrlFor('sample-token'),
    'https://acadova.example.test/verify-email?token=sample-token',
  );
  process.env.FRONTEND_URL = 'http://localhost:5173/';
  assert.equal(
    verificationUrlFor('sample-token'),
    'http://localhost:5173/verify-email?token=sample-token',
  );
  process.env.FRONTEND_URL = 'https://acadova.example.test/register?old=1';

  await sendVerificationEmail({ recipient: 'student@example.test', name: 'A <Student>', token: 'sample-token' });
  assert.equal(requests.length, 1);
  assert.equal(passwordResetUrlFor('sample-token'),
    'https://acadova.example.test/reset-password?token=sample-token');
  await sendPasswordResetEmail({ recipient: 'student@example.test',
    name: 'A <Student>', token: 'sample-token' });
  assert.equal(requests.length, 2);
  const resetMail = JSON.parse(requests[1].options.body);
  assert.equal(resetMail.subject, 'Reset your Acadova password');
  assert.match(resetMail.textContent, /reset-password\?token=sample-token/);
  assert.match(resetMail.htmlContent, /A &lt;Student&gt;/);
  assert.match(resetMail.textContent, /30 minutes/);
  assert.equal(requests[0].url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].options.headers['Content-Type'], 'application/json');
  assert.equal(requests[0].options.headers.Accept, 'application/json');
  assert.equal(requests[0].options.headers['api-key'], 'private-brevo-api-key');
  assert.ok(requests[0].options.signal instanceof AbortSignal);
  const message = JSON.parse(requests[0].options.body);
  assert.deepEqual(message.sender, { name: 'Acadova', email: 'sender@example.test' });
  assert.deepEqual(message.to, [{ email: 'student@example.test', name: 'A <Student>' }]);
  assert.equal(message.subject, 'Verify your Acadova email address');
  assert.match(message.textContent, /https:\/\/acadova\.example\.test\/verify-email\?token=sample-token/);
  assert.match(message.htmlContent, /https:\/\/acadova\.example\.test\/verify-email\?token=sample-token/);
  assert.match(message.htmlContent, /A &lt;Student&gt;/);
  assert.match(message.textContent, /45 minutes/);
  assert.doesNotMatch(requests[0].options.body, /private-brevo-api-key/);

  failure = 'provider';
  await assert.rejects(
    sendVerificationEmail({ recipient: 'student@example.test', name: 'A Student', token: 'sample-token' }),
    (error) => error.message === 'Verification email delivery failed'
      && !JSON.stringify(error).includes('private-brevo-api-key'),
  );
  failure = 'network';
  await assert.rejects(
    sendVerificationEmail({ recipient: 'student@example.test', name: 'A Student', token: 'sample-token' }),
    (error) => error.message === 'Verification email delivery failed'
      && !JSON.stringify(error).includes('sample-token'),
  );
  failure = undefined;
  assert.deepEqual(logged, []);

  process.env.NODE_ENV = 'production';
  process.env.FRONTEND_URL = 'https://acadova-ze91.onrender.com';
  await sendVerificationEmail({ recipient: 'student@example.test', name: 'A Student', token: 'token+/' });
  const productionMessage = JSON.parse(requests.at(-1).options.body);
  const publicUrl = new URL(productionMessage.textContent.match(/https:\/\/\S+/)[0]);
  assert.equal(publicUrl.origin, 'https://acadova-ze91.onrender.com');
  assert.equal(publicUrl.pathname, '/verify-email');
  assert.equal(publicUrl.searchParams.get('token'), 'token+/');
  assert.match(productionMessage.htmlContent, /token%2B%2F/);

  const sentCount = requests.length;
  delete process.env.BREVO_API_KEY;
  await assert.rejects(
    sendVerificationEmail({ recipient: 'student@example.test', name: 'A Student', token: 'sample-token' }),
    /Verification email delivery is not configured/,
  );
  assert.equal(requests.length, sentCount);
  process.env.BREVO_API_KEY = 'private-brevo-api-key';

  delete process.env.FRONTEND_URL;
  assert.throws(() => verificationUrlFor('sample-token'), /FRONTEND_URL is required/);
  await assert.rejects(
    sendVerificationEmail({ recipient: 'student@example.test', name: 'A Student', token: 'sample-token' }),
    /FRONTEND_URL is required/,
  );
  assert.equal(requests.length, sentCount);

  process.env.FRONTEND_URL = 'not a URL';
  assert.throws(() => verificationUrlFor('sample-token'), /Invalid frontend URL/);
  await assert.rejects(
    sendVerificationEmail({ recipient: 'student@example.test', name: 'A Student', token: 'sample-token' }),
    /Invalid frontend URL/,
  );
  assert.equal(requests.length, sentCount);

  process.env.FRONTEND_URL = 'http://localhost:5173';
  await assert.rejects(
    sendVerificationEmail({ recipient: 'student@example.test', name: 'A Student', token: 'sample-token' }),
    /Invalid production frontend URL/,
  );
  assert.equal(requests.length, sentCount);

  process.env.NODE_ENV = 'development';
  await sendVerificationEmail({ recipient: 'student@example.test', name: 'A Student', token: 'sample-token' });
  assert.match(JSON.parse(requests.at(-1).options.body).textContent,
    /http:\/\/localhost:5173\/verify-email\?token=sample-token/);
});
