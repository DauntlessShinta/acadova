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
const { randomBytes } = require('node:crypto');
const googleIdentity = require('../services/googleIdentityService');
const { isValidEmail } = require('../middleware/validation');
const { policyVersion } = require('../config/policy');
const { validAuthVersion } = require('../utils/authVersion');
const { registrationDomains, normalizeInstitutionalEmail } = require('../config/institutionalRegistration');

// Unknown accounts still perform a password comparison to avoid an obvious
// fast path that reveals whether an email is registered.
const UNKNOWN_ACCOUNT_HASH = bcrypt.hashSync('acadova-unknown-account', 10);

async function auditLoginSafely(event) {
  try { await recordLoginSecurityAudit(event); }
  catch { logSecurityEvent('auth.audit_unavailable', {}, { action: event.action }); }
}

const suspendedAuditAt = new Map();
function auditSuspendedLoginSafely(userId) {
  const key = String(userId);
  const now = Date.now();
  if (now - (suspendedAuditAt.get(key) || 0) < 15 * 60 * 1000) return;
  if (suspendedAuditAt.size > 5000) suspendedAuditAt.clear();
  suspendedAuditAt.set(key, now);
  void auditLoginSafely({ userId, action: ACTIONS.suspendedLoginAttempt, failureCount: 0 });
}

function signToken(user, staffVerified = false) {
  if (!validAuthVersion(user.authVersion)) throw new Error('Invalid authentication state');
  return jwt.sign({ id: user._id, role: user.role,
    ...(staffVerified ? { staffMfa: true, mfaEmail: require('../services/staffMfaService').emailFingerprint(user.email) } : {}),
    ...(user.authVersion !== undefined ? { authVersion: user.authVersion } : {}) },
  process.env.JWT_SECRET, { expiresIn: '7d' });
}

function publicUser(user) {
  return { experience:require('../config/studentExperience').capabilities(), id: user._id, name: user.name, email: user.email, credits: user.credits,
    role: user.role, skillsToLearn: user.skillsToLearn || [], skillsToTeach: user.skillsToTeach || [] };
}

function existingRegistrationResponse(res) {
  // Do not disclose whether an eligible institutional address already exists,
  // or overwrite an existing account's password or verification state.
  return res.status(201).json({ success: true, message: 'Check your email to verify your account, or sign in if you already registered.' });
}

exports.registrationPolicy = (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { return res.json({ success: true, data: { domains: registrationDomains(), aliasesAllowed: false } }); }
  catch { return res.status(503).json({ success: false, message: 'Institutional registration is temporarily unavailable.' }); }
};

exports.register = async (req, res) => {
  try {
    const { name, password } = req.body;
    const email = normalizeInstitutionalEmail(req.body.email);
    if (!email) return res.status(400).json({ success: false, code: 'INSTITUTIONAL_EMAIL_REQUIRED',
      message: 'Use your approved PHINMAED institutional email address without a plus alias.' });
    req.body.email = email;
    const existing = await User.findOne({ email }).lean();
    if (existing) return existingRegistrationResponse(res, existing);
    const verification = createVerificationToken();
    const rules = require('../config/studentExperience').active()?{startingCreditGrant:0}:await getEffectiveCreditRules();
    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 10),
      credits: 0,
      emailVerified: false,
      ...(!require('../config/studentExperience').active()?{openingGrantEligible:true,openingGrantAmount:rules.startingCreditGrant}:{}),
      emailVerificationTokenHash: verification.hash,
      emailVerificationExpires: verification.expires,
      emailVerificationSentAt: new Date(),
      policyAcceptedAt: new Date(), policyVersion,
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
    return existingRegistrationResponse(res, null);
  } catch (error) {
    if (error.status === 503) return res.status(503).json({ success: false, code: 'REGISTRATION_POLICY_UNAVAILABLE',
      message: 'Institutional registration is temporarily unavailable. Try again later.' });
    if (error.code === 11000) {
      // The unique-email race has the same non-enumerating receipt.
      return existingRegistrationResponse(res);
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
      if(require('../config/studentExperience').active()){delete verifiedFields.$unset.openingGrantEligible;delete verifiedFields.$unset.openingGrantAmount;if(pending)verifiedFields.$set.openingGrantFrozenAt=now;}
      user = !require('../config/studentExperience').active() && await User.findOneAndUpdate(
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
  let stage = 'account_lookup';
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
    stage = 'password_check';
    if (!await bcrypt.compare(password, user.password)) {
      stage = 'failure_counter';
      const failure = await loginSecurity.recordFailedLogin(user, now);
      if (failure?.count >= failureThreshold) {
        await auditLoginSafely({ userId: user._id,
          action: failure.count === failureThreshold ? ACTIONS.loginCooldownStarted : ACTIONS.loginCooldownExtended,
          failureCount: failure.count, cooldownSeconds: failure.cooldownSeconds });
      }
      return genericFailure();
    }
    if (user.suspendedAt) {
      auditSuspendedLoginSafely(user._id);
      return res.status(403).json({ success: false, code: 'ACCOUNT_SUSPENDED', message: 'Account is suspended' });
    }
    if (user.emailVerified === false) {
      return res.status(403).json({ success: false, code: 'EMAIL_VERIFICATION_REQUIRED', message: 'Please verify your email before logging in.' });
    }
    stage = 'success_revalidation';
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
    stage = 'staff_verification';
    if (require('../config/staffMfa').enabled() && require('../config/staffMfa').isStaff(active.role)) {
      return res.json({ success: true, data: await require('../services/staffMfaService').begin(active) });
    }
    stage = 'token_signing';
    return res.json({ success: true, message: 'Login successful', data: { token: signToken(active), user: publicUser(active) } });
  } catch (error) {
    if (stage === 'staff_verification' && error.status
      && (error.code?.startsWith('MFA_') || error.code === 'STAFF_EMAIL_VERIFICATION_REQUIRED')) {
      return res.status(error.status).json({ success: false, code: error.code, message: error.message });
    }
    logSecurityEvent('auth.login_error', req, { status: 500, stage });
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

const resetLifetimeMs = 30 * 60 * 1000;
const recoveryConfirmation = {
  success: true,
  message: 'If an account exists for that email, a password reset link has been sent.',
};

exports.forgotPassword = async (req, res) => {
  const token = randomBytes(32).toString('hex');
  const hash = hashVerificationToken(token);
  try {
    const user = await User.findOneAndUpdate(
      { email: req.body.email },
      { $set: { passwordResetTokenHash: hash,
        passwordResetExpires: new Date(Date.now() + resetLifetimeMs) } },
      { new: true },
    );
    if (user) {
      // Keep delivery off the response path so provider latency does not reveal
      // whether the email belongs to an account.
      void emailService.sendPasswordResetEmail({ recipient: user.email, name: user.name, token }).catch(() => {
        logSecurityEvent('auth.password_reset_delivery_failed', req, { status: 503 });
      });
    }
    return res.json(recoveryConfirmation);
  } catch {
    logSecurityEvent('auth.password_recovery_failed', req, { status: 500 });
    return res.status(500).json({ success: false, message: 'Unable to process this request right now.' });
  }
};

exports.resetPassword = async (req, res) => {
  const hash = hashVerificationToken(req.body.token);
  const now = new Date();
  try {
    const user = await User.findOneAndUpdate(
      { passwordResetTokenHash: hash, passwordResetExpires: { $gt: now } },
      { $set: { password: await bcrypt.hash(req.body.password, 10),
        authVersion: randomBytes(32).toString('hex') },
        $unset: { passwordResetTokenHash: 1, passwordResetExpires: 1 } },
      { new: true },
    );
    if (user) return res.json({ success: true, message: 'Password updated. You can now log in.' });
    const expired = await User.exists({ passwordResetTokenHash: hash,
      passwordResetExpires: { $lte: now } });
    return res.status(expired ? 410 : 400).json({ success: false,
      code: expired ? 'RESET_EXPIRED' : 'RESET_INVALID',
      message: expired ? 'This reset link has expired.' : 'This reset link is invalid or has already been used.' });
  } catch {
    logSecurityEvent('auth.password_reset_failed', req, { status: 500 });
    return res.status(500).json({ success: false, message: 'Unable to reset password right now.' });
  }
};

function safeGoogleName(name) {
  const clean = typeof name === 'string' ? name.trim().replace(/ +/g, ' ') : '';
  return clean.length >= 2 && clean.length <= 80
    && !/[\p{Cc}\p{Cf}]/u.test(clean) ? clean : 'Acadova Student';
}

exports.googleLogin = async (req, res) => {
  let identity;
  try {
    identity = await googleIdentity.verifyGoogleCredential(req.body.credential);
  } catch {
    return res.status(401).json({ success: false, message: 'Google sign-in could not be verified.' });
  }
  const email = identity?.email?.trim().toLowerCase();
  if (!identity || !isValidEmail(email)) {
    return res.status(401).json({ success: false, message: 'Google sign-in could not be verified.' });
  }
  let dbSession;
  try {
    const now = new Date();
    dbSession = await mongoose.startSession();
    let account;
    let denied;
    let suspendedId;
    await dbSession.withTransaction(async () => {
      denied = null;
      const bySub = await User.findOne({ googleSub: identity.sub })
        .select('+googleSub +loginCooldownUntil').lean().session(dbSession);
      const byEmail = await User.findOne({ email })
        .select('+googleSub +loginCooldownUntil +openingGrantEligible +openingGrantAmount').lean().session(dbSession);
      if (bySub && byEmail && String(bySub._id) !== String(byEmail._id)) {
        denied = 'IDENTITY_CONFLICT'; return;
      }
      const existing = bySub || byEmail;
      if (existing && require('../config/staffMfa').enabled() && require('../config/staffMfa').isStaff(existing.role)
        && existing.emailVerified !== true) { denied = 'STAFF_EMAIL_VERIFICATION_REQUIRED'; return; }
      if (existing?.googleSub && existing.googleSub !== identity.sub) {
        denied = 'IDENTITY_CONFLICT'; return;
      }
      if (existing?.suspendedAt) { denied = 'ACCOUNT_SUSPENDED'; suspendedId = existing._id; return; }
      if (existing?.loginCooldownUntil && existing.loginCooldownUntil > now) {
        denied = 'LOGIN_COOLDOWN'; return;
      }
      if (existing) {
        const eligible = !require('../config/studentExperience').active() && existing.role === 'student'
          && existing.emailVerified === false && existing.openingGrantEligible === true;
        const grantAmount = eligible ? (existing.openingGrantAmount || startingCredits) : 0;
        const update = { $set: { googleSub: identity.sub, emailVerified: true,
          emailVerifiedAt: existing.emailVerifiedAt || now },
        $unset: { emailVerificationTokenHash: 1, emailVerificationExpires: 1,
          emailVerificationSentAt: 1, openingGrantEligible: 1, openingGrantAmount: 1 } };
        if (existing.emailVerified === false) {
          // Email ownership was never established for the preregistration password.
          // The owner may choose a local password later through ordinary recovery.
          update.$set.password = await bcrypt.hash(randomBytes(48).toString('hex'), 10);
          update.$set.authVersion = randomBytes(32).toString('hex');
          update.$unset.passwordResetTokenHash = 1;
          update.$unset.passwordResetExpires = 1;
        }
        if(require('../config/studentExperience').active()){delete update.$unset.openingGrantEligible;delete update.$unset.openingGrantAmount;if(existing.openingGrantEligible)update.$set.openingGrantFrozenAt=now;}
        if (grantAmount) update.$inc = { credits: grantAmount };
        account = await User.findOneAndUpdate(
          { _id: existing._id, suspendedAt: null,
            emailVerified: existing.emailVerified === undefined ? { $exists: false } : existing.emailVerified,
            googleSub: existing.googleSub || { $exists: false },
            ...loginSecurity.cooldownExpired(now) },
          update, { new: true, session: dbSession },
        );
        if (!account) { denied = 'ACCOUNT_CHANGED'; return; }
        if (grantAmount) await CreditTransaction.create([{
          type: 'initial_grant', toUser: account._id, amount: grantAmount,
        }], { session: dbSession });
      } else {
        if (!normalizeInstitutionalEmail(email)) { denied = 'INSTITUTIONAL_EMAIL_REQUIRED'; return; }
        if (req.body.policyAccepted !== true) { denied = 'POLICY_ACCEPTANCE_REQUIRED'; return; }
        // Unknown local password is never disclosed; password recovery can set one later.
        const password = await bcrypt.hash(randomBytes(48).toString('hex'), 10);
        const rules = require('../config/studentExperience').active()?{startingCreditGrant:0}:await getEffectiveCreditRules();
        const [created] = await User.create([{
          name: safeGoogleName(identity.name), email, googleSub: identity.sub,
          password, role: 'student', emailVerified: true, emailVerifiedAt: now,
          credits: rules.startingCreditGrant,
          policyAcceptedAt: now, policyVersion,
        }], { session: dbSession });
        if (!require('../config/studentExperience').active()) await CreditTransaction.create([{
          type: 'initial_grant', toUser: created._id, amount: rules.startingCreditGrant,
        }], { session: dbSession });
        account = created;
      }
    });
    if (denied === 'INSTITUTIONAL_EMAIL_REQUIRED') return res.status(400).json({ success: false,
      code: denied, message: 'Use your approved PHINMAED institutional email address without a plus alias.' });
    if (denied === 'POLICY_ACCEPTANCE_REQUIRED') return res.status(409).json({ success: false,
      code: denied, message: 'Please accept the account policies to create your account.' });
    if (denied === 'STAFF_EMAIL_VERIFICATION_REQUIRED') return res.status(403).json({ success: false,
      code: denied, message: 'A verified staff email is required. Contact an administrator.' });
    if (denied === 'ACCOUNT_SUSPENDED') {
      if (suspendedId) auditSuspendedLoginSafely(suspendedId);
      return res.status(403).json({ success: false,
      code: denied, message: 'Account is suspended' });
    }
    if (denied === 'LOGIN_COOLDOWN') return res.status(429).json({ success: false,
      message: 'Too many login attempts. Please try again shortly.' });
    if (denied) return res.status(409).json({ success: false,
      message: 'This Google identity cannot be linked to that account.' });
    const active = await loginSecurity.resetAfterSuccess(account, new Date());
    if (!active) return res.status(409).json({ success: false,
      message: 'Account state changed during sign-in. Please try again.' });
    if (require('../config/staffMfa').enabled() && require('../config/staffMfa').isStaff(active.role)) {
      return res.json({ success: true, data: await require('../services/staffMfaService').begin(active) });
    }
    return res.json({ success: true, message: 'Login successful',
      data: { token: signToken(active), user: publicUser(active) } });
  } catch (error) {
    // Unique email/sub conflicts can occur under concurrent sign-ins. Retry safely.
    if (error.status && error.code?.startsWith('MFA_')) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
    if (error.code === 11000 || error.hasErrorLabel?.('TransientTransactionError')) {
      return res.status(409).json({ success: false,
        message: 'Sign-in is in progress. Please try again.' });
    }
    logSecurityEvent('auth.google_login_error', req, { status: 500 });
    return res.status(500).json({ success: false, message: 'Google sign-in is temporarily unavailable.' });
  } finally {
    if (dbSession) await dbSession.endSession();
  }
};

async function staffMfaAction(req, res, resend = false) {
  res.set('Cache-Control', 'no-store');
  try {
    const service = require('../services/staffMfaService');
    if (resend) return res.json({ success: true, data: await service.resend(req.body.challenge) });
    const user = await service.verify(req.body.challenge, req.body.code);
    return res.json({ success: true, data: { token: signToken(user, true), user: publicUser(user) } });
  } catch (error) {
    const safe = error.code?.startsWith('MFA_');
    if (!safe) logSecurityEvent('auth.staff_mfa_unavailable', req, { status: 503 });
    return res.status(safe ? error.status : 503).json({ success: false,
      code: safe ? error.code : 'MFA_UNAVAILABLE',
      message: safe ? error.message : 'Staff verification is unavailable. Return to sign-in or contact an administrator.' });
  }
}
exports.verifyStaffMfa = (req, res) => staffMfaAction(req, res);
exports.resendStaffMfa = (req, res) => staffMfaAction(req, res, true);
