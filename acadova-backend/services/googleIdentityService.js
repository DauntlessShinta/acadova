const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client();

async function verifyGoogleCredential(credential) {
  const audience = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!audience) throw new Error('Google sign-in is not configured');
  const ticket = await client.verifyIdToken({ idToken: credential, audience });
  const payload = ticket.getPayload();
  if (payload?.email_verified !== true || typeof payload.sub !== 'string' || !payload.sub
    || typeof payload.email !== 'string') return null;
  return { sub: payload.sub, email: payload.email, name: payload.name };
}

module.exports = { verifyGoogleCredential };
