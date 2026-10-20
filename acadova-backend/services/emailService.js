function frontendUrlFor(path, token) {
  const configuredUrl = typeof process.env.FRONTEND_URL === 'string'
    ? process.env.FRONTEND_URL.trim()
    : '';
  if (!configuredUrl) {
    throw new Error('FRONTEND_URL is required for verification email');
  }

  let frontend;
  try {
    frontend = new URL(configuredUrl);
  } catch {
    throw new Error('Invalid frontend URL for verification email');
  }
  if (frontend.protocol !== 'https:' && !(frontend.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(frontend.hostname))) {
    throw new Error('Invalid frontend URL for verification email');
  }
  if (process.env.NODE_ENV === 'production' && (frontend.protocol !== 'https:'
    || ['localhost', '127.0.0.1'].includes(frontend.hostname))) {
    throw new Error('Invalid production frontend URL for verification email');
  }
  frontend.pathname = path;
  frontend.search = '';
  frontend.hash = '';
  frontend.searchParams.set('token', token);
  return frontend.toString();
}

const escapeHtml = (value) => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

async function sendEmail({ recipient, name, subject, plain, html, deliveryKey }) {
  const { BREVO_API_KEY, MAIL_FROM } = process.env;
  const senderMatch = typeof MAIL_FROM === 'string'
    ? /^(?:(.+?)\s*<([^<>\s]+@[^<>\s]+)>|([^<>\s]+@[^<>\s]+))$/.exec(MAIL_FROM.trim())
    : null;
  if (!BREVO_API_KEY?.trim() || !senderMatch) {
    throw new Error('Verification email delivery is not configured');
  }
  const sender = senderMatch[2]
    ? { email: senderMatch[2], name: senderMatch[1].trim() }
    : { email: senderMatch[3] };
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender,
        to: [{ email: recipient, name }],
        subject,
        textContent: plain,
        htmlContent: html,
        ...(deliveryKey ? { headers: { idempotencyKey: deliveryKey } } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      // An ambiguous previous send may already have been accepted by Brevo.
      const result = deliveryKey ? await response.json().catch(() => ({})) : {};
      if (deliveryKey && result.code === 'duplicate_parameter') return;
      throw new Error('Brevo delivery rejected');
    }
  } catch {
    // Provider and network errors may contain secrets or tokens. Do not expose them.
    throw new Error('Verification email delivery failed');
  }
}

const verificationUrlFor = (token) => frontendUrlFor('/verify-email', token);
const passwordResetUrlFor = (token) => frontendUrlFor('/reset-password', token);

async function sendVerificationEmail({ recipient, name, token }) {
  const url = verificationUrlFor(token);
  const plain = 'Acadova\nVerify your email address\n\nHi ' + name
    + ',\n\nThanks for creating an Acadova account. Please verify your email address to continue:\n'
    + url + '\n\nThis link expires in 45 minutes. If you did not create this account, ignore this email.';
  const html = '<h1>Acadova</h1><h2>Verify your email address</h2><p>Hi ' + escapeHtml(name)
    + ',</p><p>Thanks for creating an Acadova account. Please verify your email address to continue.</p><p><a href="'
    + escapeHtml(url) + '">Verify Email</a></p><p>This link expires in 45 minutes. If you did not create this account, ignore this email.</p>';
  await sendEmail({ recipient, name, subject: 'Verify your Acadova email address', plain, html });
}

async function sendPasswordResetEmail({ recipient, name, token }) {
  const url = passwordResetUrlFor(token);
  const plain = 'Acadova\nReset your password\n\nHi ' + name
    + ',\n\nUse this link to choose a new Acadova password:\n' + url
    + '\n\nThis link expires in 30 minutes. If you did not request this, ignore this email.';
  const html = '<h1>Acadova</h1><h2>Reset your password</h2><p>Hi ' + escapeHtml(name)
    + ',</p><p>Use this link to choose a new Acadova password.</p><p><a href="'
    + escapeHtml(url) + '">Reset Password</a></p><p>This link expires in 30 minutes. If you did not request this, ignore this email.</p>';
  await sendEmail({ recipient, name, subject: 'Reset your Acadova password', plain, html });
}

function proposalUrlFor(path) {
  if (typeof path !== 'string' || !/^\/sessions\/[a-f0-9]{24}\?target=proposal&proposalId=[a-f0-9-]{36}#session-proposal$/i.test(path)) {
    throw new Error('Invalid proposal review path');
  }
  // Reuse the existing production/development origin validation, without tokens.
  const base = new URL(frontendUrlFor('/login', ''));
  return new URL(path, base.origin).toString();
}
async function sendProposalEmail({ recipient, name, title, message, reviewPath, deliveryKey }) {
  const url = proposalUrlFor(reviewPath);
  const plain = `Acadova\n${title}\n\nHi ${name},\n\n${message}\nReview this proposal: ${url}\n\nThe confirmed schedule stays in place unless an alternative is accepted. Sign in to review the current state.`;
  const html = `<h1>Acadova</h1><h2>${escapeHtml(title)}</h2><p>Hi ${escapeHtml(name)},</p><p>${escapeHtml(message)}</p><p><a href="${escapeHtml(url)}">Review this proposal</a></p><p>The confirmed schedule stays in place unless an alternative is accepted. Sign in to review the current state.</p>`;
  await sendEmail({ recipient, name, subject: `Acadova: ${title}`, plain, html, deliveryKey });
}
async function sendStaffMfaEmail({ recipient, code }) {
  const plain = `Acadova\n\nYour staff verification code is ${code}.\n\nThis code expires in five minutes and is for Admin/Moderator sign-in only. Do not share it. If you did not attempt to sign in, ignore this message and report unexpected attempts to your Acadova administrator.`;
  const html = `<div style="font-family:Arial,sans-serif;color:#0f2d8b;max-width:480px"><h1>Acadova</h1><h2>Verify your identity</h2><p>Your Admin/Moderator sign-in code:</p><p style="font-size:32px;letter-spacing:6px;font-weight:bold">${code}</p><p>Expires in five minutes. Do not share this code.</p><p>If you did not attempt to sign in, ignore this email and report unexpected attempts to your Acadova administrator.</p></div>`;
  await sendEmail({ recipient, subject: 'Your Acadova Staff Verification Code', plain, html });
}
module.exports = { sendStaffMfaEmail, sendVerificationEmail, sendPasswordResetEmail, verificationUrlFor, passwordResetUrlFor,
  sendProposalEmail, proposalUrlFor };
