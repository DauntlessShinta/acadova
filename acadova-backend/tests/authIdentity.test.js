const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const AuditLog = require('../models/AuditLog');
const CreditConfig = require('../models/CreditConfig');
const emailService = require('../services/emailService');
const googleIdentity = require('../services/googleIdentityService');
const loginSecurity = require('../services/loginSecurityService');
const { OAuth2Client } = require('google-auth-library');
const auth = require('../controllers/authController');
const { hashVerificationToken } = require('../utils/verificationTokens');
const { validateBody, schemas } = require('../middleware/validation');
const { updateMe } = require('../controllers/userController');

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; } });
const request = (body) => ({ body, ip: '127.0.0.1', method: 'POST', originalUrl: '/api/auth/test' });

test('password recovery has generic responses and single-use, expiring hashed tokens', async (t) => {
  const original = { findOneAndUpdate: User.findOneAndUpdate, exists: User.exists,
    send: emailService.sendPasswordResetEmail };
  t.after(() => Object.assign(User, { findOneAndUpdate: original.findOneAndUpdate,
    exists: original.exists }) && (emailService.sendPasswordResetEmail = original.send));
  const user = { email: 'student@example.test', name: 'Student One',
    password: await bcrypt.hash('OldPassword1!', 10) };
  const sent = [];
  User.findOneAndUpdate = async (filter, update) => {
    if (filter.email) {
      if (filter.email !== user.email) return null;
    } else if (filter.passwordResetTokenHash !== user.passwordResetTokenHash
      || !(user.passwordResetExpires > filter.passwordResetExpires.$gt)) return null;
    Object.assign(user, update.$set);
    for (const key of Object.keys(update.$unset || {})) delete user[key];
    return user;
  };
  User.exists = async (filter) => user.passwordResetTokenHash === filter.passwordResetTokenHash
    && user.passwordResetExpires <= filter.passwordResetExpires.$lte;
  emailService.sendPasswordResetEmail = async (mail) => sent.push(mail);
  const known = response();
  await auth.forgotPassword(request({ email: user.email }), known);
  const unknown = response();
  await auth.forgotPassword(request({ email: 'missing@example.test' }), unknown);
  assert.deepEqual(known.body, unknown.body);
  assert.equal(sent.length, 1);
  assert.equal(user.passwordResetTokenHash, hashVerificationToken(sent[0].token));
  assert.notEqual(user.passwordResetTokenHash, sent[0].token);
  assert.ok(user.passwordResetExpires > new Date());
  assert.doesNotMatch(JSON.stringify(known.body), new RegExp(sent[0].token));
  const oldHash = user.password;
  const valid = response();
  await auth.resetPassword(request({ token: sent[0].token, password: 'NewPassword2!' }), valid);
  assert.equal(valid.statusCode, 200);
  assert.equal(await bcrypt.compare('NewPassword2!', user.password), true);
  assert.equal(await bcrypt.compare('OldPassword1!', user.password), false);
  assert.notEqual(user.password, oldHash);
  assert.equal(user.passwordResetTokenHash, undefined);
  const reused = response();
  await auth.resetPassword(request({ token: sent[0].token, password: 'AnotherPass3!' }), reused);
  assert.equal(reused.statusCode, 400);
  assert.equal(reused.body.code, 'RESET_INVALID');
  const invalid = response();
  await auth.resetPassword(request({ token: 'a'.repeat(64), password: 'AnotherPass3!' }), invalid);
  assert.equal(invalid.statusCode, 400);
  await auth.forgotPassword(request({ email: user.email }), response());
  user.passwordResetExpires = new Date(Date.now() - 1);
  const expired = response();
  await auth.resetPassword(request({ token: sent.at(-1).token, password: 'AnotherPass3!' }), expired);
  assert.equal(expired.statusCode, 410);
  assert.equal(expired.body.code, 'RESET_EXPIRED');
  assert.equal(await bcrypt.compare('NewPassword2!', user.password), true);
});

test('Google identity links existing users and grants only new or pending verified Students once', async (t) => {
  const original = { findOne: User.findOne, findOneAndUpdate: User.findOneAndUpdate,
    create: User.create, startSession: mongoose.startSession, transactionCreate: CreditTransaction.create,
    configFind: CreditConfig.findById, verify: googleIdentity.verifyGoogleCredential,
    resetLogin: loginSecurity.resetAfterSuccess,
    jwtSecret: process.env.JWT_SECRET, auditCreate: AuditLog.create };
  t.after(() => {
    User.findOne = original.findOne; User.findOneAndUpdate = original.findOneAndUpdate;
    User.create = original.create; mongoose.startSession = original.startSession;
    CreditTransaction.create = original.transactionCreate; CreditConfig.findById = original.configFind;
    googleIdentity.verifyGoogleCredential = original.verify;
    AuditLog.create = original.auditCreate;
    loginSecurity.resetAfterSuccess = original.resetLogin;
    if (original.jwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original.jwtSecret;
  });
  process.env.JWT_SECRET = 'test-secret-with-enough-random-looking-characters';
  AuditLog.create = async ([entry]) => [entry];
  const users = [];
  const grants = [];
  let identity = { sub: 'google-student-1', email: 'new@example.test', name: 'Google Student' };
  googleIdentity.verifyGoogleCredential = async () => identity;
  loginSecurity.resetAfterSuccess = async (account) => account.suspendedAt
    || account.loginCooldownUntil > new Date() ? null : account;
  User.findOne = (filter) => ({
    select() { return this; }, session() { return Promise.resolve(users.find((user) =>
      filter.googleSub ? user.googleSub === filter.googleSub : user.email === filter.email) || null); },
  });
  User.findOneAndUpdate = async (filter, update) => {
    const user = users.find((candidate) => String(candidate._id) === String(filter._id));
    if (!user || user.suspendedAt || user.emailVerified !== filter.emailVerified
      || (user.googleSub || undefined) !== (typeof filter.googleSub === 'string' ? filter.googleSub : undefined)
      || user.loginCooldownUntil > new Date()) return null;
    Object.assign(user, update.$set);
    if (update.$inc) user.credits += update.$inc.credits;
    for (const key of Object.keys(update.$unset || {})) delete user[key];
    return user;
  };
  User.create = async ([input]) => {
    if (users.some((user) => user.email === input.email || user.googleSub === input.googleSub)) {
      throw Object.assign(new Error('duplicate'), { code: 11000 });
    }
    const user = { ...input, _id: new mongoose.Types.ObjectId() };
    users.push(user); return [user];
  };
  mongoose.startSession = async () => ({ withTransaction: async (callback) => callback(), endSession: async () => {} });
  CreditTransaction.create = async ([row]) => {
    if (grants.some((grant) => String(grant.toUser) === String(row.toUser))) {
      throw Object.assign(new Error('duplicate grant'), { code: 11000 });
    }
    grants.push(row);
  };
  CreditConfig.findById = () => ({ lean: async () => null });
  const call = async (policyAccepted) => {
    const res = response();
    await auth.googleLogin(request({ credential: 'credential-is-never-logged',
      ...(policyAccepted ? { policyAccepted: true } : {}) }), res);
    return res;
  };
  const missingPolicy = await call();
  assert.equal(missingPolicy.statusCode, 409);
  assert.equal(missingPolicy.body.code, 'POLICY_ACCEPTANCE_REQUIRED');
  assert.equal(users.length, 0);
  const first = await call(true);
  assert.equal(first.statusCode, 200);
  assert.equal(users.length, 1);
  assert.equal(users[0].role, 'student');
  assert.equal(users[0].emailVerified, true);
  assert.equal(users[0].credits, 100);
  assert.ok(users[0].policyAcceptedAt instanceof Date);
  assert.equal(grants.length, 1);
  assert.equal(grants[0].type, 'initial_grant');
  const repeat = await call();
  assert.equal(repeat.statusCode, 200);
  assert.equal(users.length, 1);
  assert.equal(grants.length, 1);
  assert.equal(first.body.data.user.id, repeat.body.data.user.id);
  assert.doesNotMatch(JSON.stringify(first.body.data.user), /googleSub|password|credential/);

  const staff = { _id: new mongoose.Types.ObjectId(), email: 'staff@example.test',
    role: 'moderator', emailVerified: true, credits: 8 };
  users.push(staff);
  identity = { sub: 'google-staff', email: staff.email, name: 'Different Name' };
  const linked = await call();
  assert.equal(linked.statusCode, 200);
  assert.equal(linked.body.data.user.role, 'moderator');
  assert.equal(staff.googleSub, 'google-staff');
  assert.equal(staff.credits, 8);
  assert.equal(users.length, 2);
  assert.equal(grants.length, 1);
  staff.suspendedAt = new Date();
  assert.equal((await call()).statusCode, 403);
  staff.suspendedAt = null;
  staff.loginCooldownUntil = new Date(Date.now() + 60_000);
  assert.equal((await call()).statusCode, 429);
  staff.loginCooldownUntil = null;
  identity = { sub: 'another-google-id', email: staff.email, name: 'Someone Else' };
  assert.equal((await call()).statusCode, 409);
  assert.equal(staff.googleSub, 'google-staff');

  const pending = { _id: new mongoose.Types.ObjectId(), email: 'pending@example.test',
    role: 'student', emailVerified: false, openingGrantEligible: true,
    openingGrantAmount: 30, credits: 0 };
  users.push(pending);
  identity = { sub: 'google-pending', email: pending.email, name: 'Pending Student' };
  assert.equal((await call()).statusCode, 200);
  assert.equal(pending.credits, 30);
  assert.equal(grants.length, 2);
  assert.equal((await call()).statusCode, 200);
  assert.equal(grants.length, 2);
  googleIdentity.verifyGoogleCredential = async () => { throw new Error('secret credential'); };
  const invalid = await call();
  assert.equal(invalid.statusCode, 401);
  assert.doesNotMatch(JSON.stringify(invalid.body), /secret|credential-is-never-logged/);
  googleIdentity.verifyGoogleCredential = async () => null;
  assert.equal((await call()).statusCode, 401);
});

test('profile updates keep skills contextual and reject protected identity fields', async (t) => {
  const validate = validateBody(schemas.profile, { requireOne: true });
  const rejected = response();
  validate(request({ name: 'Student Name', role: 'admin', credits: 500 }),
    rejected, () => assert.fail('protected fields reached controller'));
  assert.equal(rejected.statusCode, 400);
  const rejectedRole = response();
  validate(request({ learnerRole: true }), rejectedRole,
    () => assert.fail('permanent learner role reached controller'));
  assert.equal(rejectedRole.statusCode, 400);
  const accepted = request({ name: 'Student Name', skillsToLearn: ['Python'],
    skillsToTeach: ['Java'] });
  validate(accepted, response(), () => {});
  assert.deepEqual(accepted.body, { name: 'Student Name',
    skillsToLearn: ['Python'], skillsToTeach: ['Java'] });
  const original = User.findByIdAndUpdate;
  t.after(() => { User.findByIdAndUpdate = original; });
  let written;
  User.findByIdAndUpdate = (_id, update) => {
    written = update;
    return { select: async () => ({ _id, ...update, role: 'student' }) };
  };
  accepted.user = { id: new mongoose.Types.ObjectId().toString(), role: 'student' };
  const saved = response();
  await updateMe(accepted, saved);
  assert.equal(saved.statusCode, 200);
  assert.deepEqual(written, accepted.body);
  assert.equal(saved.body.data.role, 'student');
});

test('Google verifier pins the configured audience and requires verified email and stable sub', async (t) => {
  const previous = process.env.GOOGLE_CLIENT_ID;
  t.after(() => {
    if (previous === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = previous;
  });
  process.env.GOOGLE_CLIENT_ID = 'acadova-web-client-id';
  let payload = { sub: 'stable-google-sub', email: 'student@gmail.com',
    email_verified: true, name: 'Google Student' };
  const calls = [];
  t.mock.method(OAuth2Client.prototype, 'verifyIdToken', async (options) => {
    calls.push(options);
    return { getPayload: () => payload };
  });
  assert.deepEqual(await googleIdentity.verifyGoogleCredential('private-id-token'), {
    sub: 'stable-google-sub', email: 'student@gmail.com', name: 'Google Student',
  });
  assert.deepEqual(calls, [{ idToken: 'private-id-token', audience: 'acadova-web-client-id' }]);
  payload = { ...payload, email_verified: false };
  assert.equal(await googleIdentity.verifyGoogleCredential('another-id-token'), null);
  payload = { ...payload, email_verified: true, sub: '' };
  assert.equal(await googleIdentity.verifyGoogleCredential('another-id-token'), null);
});
