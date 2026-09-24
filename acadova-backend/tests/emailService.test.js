const test = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const { sendVerificationEmail } = require('../services/emailService');

test('verification email uses Gmail SMTP without exposing credentials', async (t) => {
  const configKeys = [
    'FRONTEND_URL', 'MAIL_HOST', 'MAIL_PORT', 'MAIL_SECURE',
    'MAIL_USER', 'MAIL_APP_PASSWORD', 'MAIL_FROM', 'NODE_ENV',
  ];
  const original = Object.fromEntries(configKeys.map((key) => [key, process.env[key]]));
  t.after(() => {
    for (const key of configKeys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  Object.assign(process.env, {
    FRONTEND_URL: 'https://acadova.example.test/register?old=1',
    MAIL_HOST: 'smtp.gmail.com',
    MAIL_PORT: '465',
    MAIL_SECURE: 'true',
    MAIL_USER: 'sender@example.test',
    MAIL_APP_PASSWORD: 'private-app-password',
    MAIL_FROM: 'Acadova <sender@example.test>',
  });

  const transports = [];
  const messages = [];
  const providerError = new Error('SMTP credentials: private-app-password');
  let fail = false;
  t.mock.method(nodemailer, 'createTransport', (options) => {
    transports.push(options);
    return {
      sendMail: async (message) => {
        messages.push(message);
        if (fail) throw providerError;
        return { accepted: [message.to] };
      },
    };
  });

  await sendVerificationEmail({ recipient: 'student@example.test', name: 'A <Student>', token: 'sample-token' });
  assert.equal(transports.length, 1);
  assert.deepEqual(transports[0], {
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: 'sender@example.test', pass: 'private-app-password' },
  });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, 'student@example.test');
  assert.equal(messages[0].from, 'Acadova <sender@example.test>');
  assert.match(messages[0].subject, /Acadova/);
  assert.match(messages[0].text, /https:\/\/acadova\.example\.test\/verify-email\?token=sample-token/);
  assert.match(messages[0].html, /https:\/\/acadova\.example\.test\/verify-email\?token=sample-token/);
  assert.match(messages[0].html, /A &lt;Student&gt;/);
  assert.doesNotMatch(JSON.stringify(messages), /private-app-password/);

  const logged = [];
  t.mock.method(console, 'error', (...parts) => logged.push(parts.join(' ')));
  t.mock.method(console, 'warn', (...parts) => logged.push(parts.join(' ')));
  fail = true;
  await assert.rejects(
    sendVerificationEmail({ recipient: 'student@example.test', name: 'A Student', token: 'sample-token' }),
    (error) => error.message === 'Verification email delivery failed'
      && !JSON.stringify(error).includes('private-app-password'),
  );
  assert.equal(messages.length, 2);
  assert.equal(transports.length, 2);
  assert.deepEqual(logged, []);

  fail = false;
  process.env.NODE_ENV = 'production';
  process.env.FRONTEND_URL = 'https://acadova-ze91.onrender.com';
  await sendVerificationEmail({ recipient: 'student@example.test', name: 'A Student', token: 'token+/' });
  const publicUrl = new URL(messages.at(-1).text.match(/https:\/\/\S+/)[0]);
  assert.equal(publicUrl.origin, 'https://acadova-ze91.onrender.com');
  assert.equal(publicUrl.pathname, '/verify-email');
  assert.equal(publicUrl.searchParams.get('token'), 'token+/');
  assert.match(messages.at(-1).html, /token%2B%2F/);

  const sentCount = messages.length;
  process.env.FRONTEND_URL = 'http://localhost:5173';
  await assert.rejects(
    sendVerificationEmail({ recipient: 'student@example.test', name: 'A Student', token: 'sample-token' }),
    /Invalid production frontend URL/,
  );
  assert.equal(messages.length, sentCount);

  process.env.NODE_ENV = 'development';
  await sendVerificationEmail({ recipient: 'student@example.test', name: 'A Student', token: 'sample-token' });
  assert.match(messages.at(-1).text, /http:\/\/localhost:5173\/verify-email\?token=sample-token/);
});
