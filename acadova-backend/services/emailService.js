function verificationUrlFor(token) {
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
  const verificationUrl = verificationUrlFor(token);
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(verificationUrl);
  const plain = `Acadova\nVerify your email address\n\nHi ${name},\n\nThanks for creating an Acadova account. Please verify your email address to continue:\n${verificationUrl}\n\nThis link expires in 45 minutes. If you did not create this account, ignore this email.`;
  const html = `<h1>Acadova</h1><h2>Verify your email address</h2><p>Hi ${safeName},</p><p>Thanks for creating an Acadova account. Please verify your email address to continue.</p><p><a href="${safeUrl}">Verify Email</a></p><p>This link expires in 45 minutes. If you did not create this account, ignore this email.</p>`;

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
        subject: 'Verify your Acadova email address',
        textContent: plain,
        htmlContent: html,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Brevo delivery rejected');
  } catch {
    // Provider and network errors may contain secrets or tokens. Do not expose them.
    throw new Error('Verification email delivery failed');
  }
}

module.exports = { sendVerificationEmail, verificationUrlFor };
