const { randomBytes, randomInt, createHash, createHmac, timingSafeEqual } = require('node:crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Challenge = require('../models/StaffMfaChallenge');
const Audit = require('../models/AuditLog');
const email = require('./emailService');
const policy = require('../config/staffMfa');
const { validAuthVersion } = require('../utils/authVersion');

const digest = value => createHash('sha256').update(value).digest('hex');
function keyed(value) {
  const key = process.env.STAFF_MFA_HMAC_KEY;
  if (typeof key !== 'string' || !/^[a-f0-9]{64,128}$/i.test(key)) throw failure(503, 'MFA_UNAVAILABLE', 'Staff verification is unavailable. Contact an administrator.');
  return createHmac('sha256', Buffer.from(key, 'hex')).update(value).digest('hex');
}
const snapshot = user => keyed(JSON.stringify([String(user._id), user.role, user.email, user.emailVerified,
  user.password, user.authVersion ?? null]));
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length
  && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const failure = (status, code, message) => Object.assign(new Error(message), { status, code });
const invalid = () => failure(401, 'MFA_INVALID', 'Verification is invalid or has expired. Return to sign-in and try again.');
function eligible(user) {
  return user && policy.isStaff(user.role) && user.emailVerified === true && !user.suspendedAt
    && validAuthVersion(user.authVersion) && typeof user.email === 'string'
    && (!user.loginCooldownUntil || user.loginCooldownUntil <= new Date());
}
function receipt(handle, user, row) {
  const [local, domain] = user.email.split('@');
  return { mfaRequired: true, challenge: handle, maskedEmail: `${local.slice(0, 1)}***@${domain}`,
    expiresAt: row.expiresAt, resendAt: new Date(row.sentAt.getTime() + 60000) };
}
async function audit(user, action, session) {
  await Audit.create([{ actor: user._id, actorRole: 'system', action: `auth.staff_mfa_${action}`,
    targetType: 'User', targetId: String(user._id), summary: 'Staff sign-in verification ' + action }], { session });
}
async function deliver(handle, user, row, code) {
  try {
    await email.sendStaffMfaEmail({ recipient: user.email, code });
    const ready = await Challenge.updateOne({ _id: row._id, verifier: row.verifier, state: 'sending', expiresAt: { $gt: new Date() } }, { $set: { state: 'ready' } }, { writeConcern: { w: 'majority' } });
    if (ready.modifiedCount !== 1) throw invalid();
    return receipt(handle, user, row);
  } catch {
    await Challenge.updateOne({ _id: row._id, verifier: row.verifier, state: 'sending' }, { $set: { state: 'invalid' } }, { writeConcern: { w: 'majority' } });
    throw failure(503, 'MFA_DELIVERY_UNAVAILABLE', 'The verification email could not be delivered. Return to sign-in and try again, or contact an administrator.');
  }
}
async function begin(user) {
  if (!policy.enabled()) throw invalid();
  if (!eligible(user)) throw failure(403, 'STAFF_EMAIL_VERIFICATION_REQUIRED', 'A verified staff email is required. Contact an administrator.');
  const handle = randomBytes(32).toString('hex');
  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  const now = new Date();
  const row = await Challenge.create({ handleHash: digest(handle), user: user._id, fingerprint: snapshot(user),
    verifier: keyed(handle + ':' + code), state: 'sending', createdAt: now, sentAt: now,
    expiresAt: new Date(now.getTime() + 300000) });
  await audit(user, 'requested');
  return deliver(handle, user, row, code);
}
async function operate(handle, code, resend = false) {
  if (!policy.enabled()) throw invalid();
  let result, rejection, delivery;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      result = undefined; rejection = undefined; delivery = undefined;
      const now = new Date();
      const row = await Challenge.findOne({ handleHash: digest(handle), state: 'ready', expiresAt: { $gt: now }, attempts: { $lt: 5 } })
        .select('+verifier +fingerprint').session(session);
      if (!row) { rejection = invalid(); return; }
      const user = await User.findById(row.user).select('+authVersion +loginCooldownUntil').session(session).lean();
      if (!eligible(user) || !equal(row.fingerprint, snapshot(user))) {
        row.state = 'invalid'; await row.save({ session }); rejection = invalid(); return;
      }
      if (resend && now - row.sentAt < 60000) {
        rejection = failure(429, 'MFA_RESEND_COOLDOWN', 'Wait 60 seconds after the last code before resending.'); return;
      }
      // Serialize against role, password, email and suspension writes as well as
      // consuming the challenge. A conflicting lifecycle update retries safely.
      await User.updateOne({ _id: user._id }, { $currentDate: { updatedAt: true } }, { session, timestamps: false });
      if (resend) {
        let nextCode;
        do { nextCode = String(randomInt(0, 1000000)).padStart(6, '0'); }
        while (equal(row.verifier, keyed(handle + ':' + nextCode)));
        row.verifier = keyed(handle + ':' + nextCode); row.sentAt = now; row.state = 'sending';
        await row.save({ session }); await audit(user, 'resent', session);
        delivery = { user, row, code: nextCode }; return;
      }
      if (!equal(row.verifier, keyed(handle + ':' + code))) {
        row.attempts += 1; if (row.attempts >= 5) row.state = 'invalid';
        await row.save({ session });
        rejection = failure(row.attempts >= 5 ? 429 : 400, 'MFA_CODE_REJECTED', row.attempts >= 5
          ? 'Too many incorrect codes. Return to sign-in.' : 'That code is incorrect. Check the latest email and try again.'); return;
      }
      row.state = 'consumed'; await row.save({ session }); await audit(user, 'verified', session);
      result = user;
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
  } finally { await session.endSession(); }
  if (rejection) throw rejection;
  if (delivery) return deliver(handle, delivery.user, delivery.row, delivery.code);
  return result;
}
module.exports = { begin, verify: (handle, code) => operate(handle, code), resend: handle => operate(handle, null, true),
  emailFingerprint: digest };
