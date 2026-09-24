const { google } = require('googleapis');

function verificationUrlFor(token) {
  const frontend = new URL(process.env.FRONTEND_URL);
  if (frontend.protocol !== 'https:' && !(frontend.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(frontend.hostname))) {
    throw new Error('Invalid frontend URL for verification email');
  }
  frontend.pathname = '/verify-email';
  frontend.search = '';
  frontend.hash = '';
  frontend.searchParams.set('token', token);
  return frontend.toString();
}

const escapeHtml = (value) => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

async function sendVerificationEmail({ recipient, name, token }) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GMAIL_SENDER_EMAIL } = process.env;
  if (![GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GMAIL_SENDER_EMAIL].every(Boolean)) {
    throw new Error('Gmail delivery is not configured');
  }
  const verificationUrl = verificationUrlFor(token);
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(verificationUrl);
  const boundary = 'acadova-verification';
  const plain = `Hi ${name},\n\nThanks for creating an Acadova account. Please verify your email address to continue:\n${verificationUrl}\n\nThis link expires in 45 minutes. If you did not create this account, you can ignore this email.`;
  const html = `<p>Hi ${safeName},</p><p>Thanks for creating an Acadova account. Please verify your email address to continue.</p><p><a href="${safeUrl}">Verify Email</a></p><p>This link expires in 45 minutes. If you did not create this account, you can ignore this email.</p>`;
  const message = [
    `From: Acadova <${GMAIL_SENDER_EMAIL}>`,
    `To: ${recipient}`,
    'Subject: Verify your Acadova email address',
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    plain,
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
    `--${boundary}--`,
  ].join('\r\n');

  const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  const gmail = google.gmail({ version: 'v1', auth });
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw: Buffer.from(message).toString('base64url') } });
}

module.exports = { sendVerificationEmail };
