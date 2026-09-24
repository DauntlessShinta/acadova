const { randomBytes, createHash } = require('node:crypto');

const VERIFICATION_LIFETIME_MS = 45 * 60 * 1000;

function hashVerificationToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function createVerificationToken() {
  const token = randomBytes(32).toString('hex');
  return {
    token,
    hash: hashVerificationToken(token),
    expires: new Date(Date.now() + VERIFICATION_LIFETIME_MS),
  };
}

module.exports = { createVerificationToken, hashVerificationToken, VERIFICATION_LIFETIME_MS };
