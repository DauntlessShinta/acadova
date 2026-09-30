const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const emailService = require('../services/emailService');
const { createVerificationToken, hashVerificationToken } = require('../utils/verificationTokens');
const { logSecurityEvent } = require('../utils/securityLogger');
const { startingCredits } = require('../config/creditRules');
const { getEffectiveCreditRules } = require('../services/creditRuleService');
const loginSecurity = require('../services/loginSecurityService');
const { failureThreshold } = require('../config/loginSecurity');
const { ACTIONS, recordLoginSecurityAudit } = require('../services/auditService');

// Unknown accounts still perform a password comparison to avoid an obvious
// fast path that reveals whether an email is registered.
const UNKNOWN_ACCOUNT_HASH = bcrypt.hashSync('acadova-unknown-account', 10);

async function auditLoginSafely(event) {
  try { await recordLoginSecurityAudit(event); }
  catch { logSecurityEvent('auth.audit_unavailable', {}, { action: event.action }); }
}

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, credits: user.credits, role: user.role };
}

function existingRegistrationResponse(res, user) {
  if (user?.emailVerified === false) {
    return res.status(409).json({
      success: false,
      code: 'REGISTRATION_PENDING_VERIFICATION',
      message: 'Your Acadova account is waiting for email verification.',
    });
  }
  return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
}

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email }).lean();
    if (existing) return existingRegistrationResponse(res, existing);
    const verification = createVerificationToken();
    const rules = await getEffectiveCreditRules();
    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 10),
      credits: 0,
      emailVerified: false,
      openingGrantEligible: true,
      openingGrantAmount: rules.startingCreditGrant,
      emailVerificationTokenHash: verification.hash,
      emailVerificationExpires: verification.expires,
      emailVerificationSentAt: new Date(),
    });
    try {
      await emailService.sendVerificationEmail({ recipient: email, name, token: verification.token });
    } catch {
      logSecurityEvent('auth.verification_delivery_failed', req, { status: 503 });
      // Let the owner request a replacement immediately if the first send failed.
      try {
        await User.updateOne({ _id: user._id, emailVerified: false }, { $unset: { emailVerificationSentAt: 1 } });
      } catch { /* The 60-second cooldown still expires if this recovery update fails. */ }
      return res.status(503).json({
        success: false,
        code: 'VERIFICATION_EMAIL_UNAVAILABLE',
        message: 'Account created, but the verification email could not be sent. Please try resending shortly.',
      });
    }
    return res.status(201).json({ success: true, message: 'Account created. Check your email to verify your address.' });
  } catch (error) {
    if (error.code === 11000) {
      // A concurrent registration may have won the unique-email race.
      try {
        const existing = await User.findOne({ email: req.body.email }).lean();
        return existingRegistrationResponse(res, existing);
      } catch {
        return existingRegistrationResponse(res, null);
      }
    }
    logSecurityEvent('auth.registration_failed', req, { status: 500 });
    return res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

exports.verifyEmail = async (req, res) => {
  const hash = hashVerificationToken(req.body.token);
  const now = new Date();
  let dbSession;
  try {
    dbSession = await mongoose.startSession();
    let user;
    await dbSession.withTransaction(async () => {
      user = undefined;
      const tokenFilter = { emailVerificationTokenHash: hash, emailVerified: false,
        emailVerificationExpires: { $gt: now } };
      const pending = await User.findOne({ ...tokenFilter, role: 'student', openingGrantEligible: true })
        .select('+openingGrantAmount').session(dbSession).lean();
      const grantAmount = pending?.openingGrantAmount || startingCredits;
      const verifiedFields = { $set: { emailVerified: true, emailVerifiedAt: now }, $unset: {
        emailVerificationTokenHash: 1, emailVerificationExpires: 1, emailVerificationSentAt: 1,
        openingGrantEligible: 1, openingGrantAmount: 1,
      } };
      user = await User.findOneAndUpdate(
        { ...tokenFilter, role: 'student', openingGrantEligible: true },
        { ...verifiedFields, $inc: { credits: grantAmount } },
        { new: true, session: dbSession },
      );
      if (user) {
        await CreditTransaction.create([{
          type: 'initial_grant', toUser: user._id, amount: grantAmount,
        }], { session: dbSession });
        return;
      }
      // Existing accounts lack the explicit eligibility marker and retain
      // their historical balance. Staff accounts never receive a grant.
      user = await User.findOneAndUpdate(tokenFilter, verifiedFields, { new: true, session: dbSession });
    });
    if (user) return res.json({ success: true, message: 'Email verified. You can now log in.' });
    const expired = await User.exists({
      emailVerificationTokenHash: hash, emailVerified: false, emailVerificationExpires: { $lte: now },
    });
    return res.status(expired ? 410 : 400).json({
      success: false,
      code: expired ? 'VERIFICATION_EXPIRED' : 'VERIFICATION_INVALID',
      message: expired ? 'This verification link has expired.' : 'This verification link is invalid or has already been used.',
    });
  } catch {
    logSecurityEvent('auth.verification_failed', req, { status: 500 });
    return res.status(500).json({ success: false, message: 'Unable to verify email right now.' });
  } finally {
    if (dbSession) await dbSession.endSession();
  }
};

exports.resendVerification = async (req, res) => {
  const generic = { success: true, message: 'If an unverified Acadova account exists for that email, a new verification message has been sent.' };
  const verification = createVerificationToken();
  const cutoff = new Date(Date.now() - 60 * 1000);
  try {
    const user = await User.findOneAndUpdate(
      { email: req.body.email, emailVerified: false, $or: [
        { emailVerificationSentAt: { $exists: false } },
        { emailVerificationSentAt: { $lte: cutoff } },
      ] },
      { $set: {
        emailVerificationTokenHash: verification.hash,
        emailVerificationExpires: verification.expires,
        emailVerificationSentAt: new Date(),
      } },
      { new: true },
    );
    if (user) {
      try {
        await emailService.sendVerificationEmail({ recipient: user.email, name: user.name, token: verification.token });
      } catch {
        logSecurityEvent('auth.verification_delivery_failed', req, { status: 503 });
      }
    }
    return res.json(generic);
  } catch {
    logSecurityEvent('auth.resend_failed', req, { status: 500 });
    return res.status(500).json({ success: false, message: 'Unable to process this request right now.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const genericFailure = () => {
      logSecurityEvent('auth.login_failed', req, { status: 401, sourceIp: req.ip });
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    };
    // Lean avoids applying the new default to legacy MongoDB records where
    // emailVerified does not exist. Only explicit false requires verification.
    const user = await User.findOne({ email })
      .select('+failedLoginAttempts +lastFailedLoginAt +loginCooldownUntil').lean();
    if (!user) {
      await bcrypt.compare(password, UNKNOWN_ACCOUNT_HASH);
      return genericFailure();
    }
    const now = new Date();
    const cooldownResponse = () => res.status(429).json({ success: false,
      message: 'Too many login attempts. Please try again shortly.' });
    if (user.loginCooldownUntil && new Date(user.loginCooldownUntil) > now) return cooldownResponse();
    if (!await bcrypt.compare(password, user.password)) {
      const failure = await loginSecurity.recordFailedLogin(user, now);
      if (failure?.count >= failureThreshold) {
        await auditLoginSafely({ userId: user._id,
          action: failure.count === failureThreshold ? ACTIONS.loginCooldownStarted : ACTIONS.loginCooldownExtended,
          failureCount: failure.count, cooldownSeconds: failure.cooldownSeconds });
      }
      return genericFailure();
    }
    if (user.suspendedAt) {
      return res.status(403).json({ success: false, code: 'ACCOUNT_SUSPENDED', message: 'Account is suspended' });
    }
    if (user.emailVerified === false) {
      return res.status(403).json({ success: false, code: 'EMAIL_VERIFICATION_REQUIRED', message: 'Please verify your email before logging in.' });
    }
    const active = await loginSecurity.resetAfterSuccess(user, now);
    if (!active) {
      // A concurrent suspension, verification change, password change, or
      // cooldown won the race; never issue a JWT from the stale read.
      const current = await User.findById(user._id).select('suspendedAt emailVerified +loginCooldownUntil').lean();
      if (current?.suspendedAt) return res.status(403).json({ success: false,
        code: 'ACCOUNT_SUSPENDED', message: 'Account is suspended' });
      if (current?.emailVerified === false) return res.status(403).json({ success: false,
        code: 'EMAIL_VERIFICATION_REQUIRED', message: 'Please verify your email before logging in.' });
      if (current?.loginCooldownUntil && new Date(current.loginCooldownUntil) > new Date()) return cooldownResponse();
      return genericFailure();
    }
    if (user.failedLoginAttempts > 0) await auditLoginSafely({ userId: user._id,
      action: ACTIONS.loginSuccessAfterFailures, failureCount: user.failedLoginAttempts });
    return res.json({ success: true, message: 'Login successful', data: { token: signToken(active), user: publicUser(active) } });
  } catch {
    logSecurityEvent('auth.login_error', req, { status: 500 });
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
};
