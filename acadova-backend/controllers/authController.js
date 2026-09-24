const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const emailService = require('../services/emailService');
const { createVerificationToken, hashVerificationToken } = require('../utils/verificationTokens');
const { logSecurityEvent } = require('../utils/securityLogger');

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
    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 10),
      emailVerified: false,
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
  try {
    const user = await User.findOneAndUpdate(
      { emailVerificationTokenHash: hash, emailVerified: false, emailVerificationExpires: { $gt: now } },
      { $set: { emailVerified: true, emailVerifiedAt: now }, $unset: {
        emailVerificationTokenHash: 1, emailVerificationExpires: 1, emailVerificationSentAt: 1,
      } },
      { new: true },
    );
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
    const user = await User.findOne({ email }).lean();
    if (!user || !await bcrypt.compare(password, user.password)) return genericFailure();
    if (user.emailVerified === false) {
      return res.status(403).json({ success: false, code: 'EMAIL_VERIFICATION_REQUIRED', message: 'Please verify your email before logging in.' });
    }
    return res.json({ success: true, message: 'Login successful', data: { token: signToken(user), user: publicUser(user) } });
  } catch {
    logSecurityEvent('auth.login_error', req, { status: 500 });
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
};
