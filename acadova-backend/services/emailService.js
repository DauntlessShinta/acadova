const nodemailer = require('nodemailer');

function verificationUrlFor(token) {
  const frontend = new URL(process.env.FRONTEND_URL);
  if (frontend.protocol !== 'https:' && !(frontend.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(frontend.hostname))) {
    throw new Error('Invalid frontend URL for verification email');
  }
  if (process.env.NODE_ENV === 'production' && (frontend.protocol !== 'https:'
    || ['localhost', '127.0.0.1'].includes(frontend.hostname))) {
    throw new Error('Invalid production frontend URL for verification email');
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
  const { MAIL_HOST, MAIL_PORT, MAIL_SECURE, MAIL_USER, MAIL_APP_PASSWORD, MAIL_FROM } = process.env;
  if (![MAIL_HOST, MAIL_PORT, MAIL_SECURE, MAIL_USER, MAIL_APP_PASSWORD, MAIL_FROM].every(Boolean)
    || MAIL_PORT !== '465' || MAIL_SECURE !== 'true') {
    throw new Error('SMTP delivery is not configured');
  }
  const verificationUrl = verificationUrlFor(token);
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(verificationUrl);
  const plain = `Acadova\nVerify your email address\n\nHi ${name},\n\nThanks for creating an Acadova account. Please verify your email address to continue:\n${verificationUrl}\n\nThis link expires in 45 minutes. If you did not create this account, ignore this email.`;
  const html = `<h1>Acadova</h1><h2>Verify your email address</h2><p>Hi ${safeName},</p><p>Thanks for creating an Acadova account. Please verify your email address to continue.</p><p><a href="${safeUrl}">Verify Email</a></p><p>This link expires in 45 minutes. If you did not create this account, ignore this email.</p>`;

  try {
    const transporter = nodemailer.createTransport({
      host: MAIL_HOST,
      port: Number(MAIL_PORT),
      secure: true,
      auth: { user: MAIL_USER, pass: MAIL_APP_PASSWORD },
    });
    await transporter.sendMail({
      from: MAIL_FROM,
      to: recipient,
      subject: 'Verify your Acadova email address',
      text: plain,
      html,
    });
  } catch {
    // SMTP errors can contain account details. Callers receive only a safe error.
    throw new Error('Verification email delivery failed');
  }
}

module.exports = { sendVerificationEmail };
