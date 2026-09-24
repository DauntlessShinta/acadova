const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const emailService = require('../services/emailService');
const { hashVerificationToken } = require('../utils/verificationTokens');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const { validationErrorHandler } = require('../middleware/validation');

test('email verification account flow without MongoDB or Gmail', async (t) => {
  const originals = {
    exists: User.exists, create: User.create, findOne: User.findOne,
    findOneAndUpdate: User.findOneAndUpdate, findById: User.findById,
    updateOne: User.updateOne, send: emailService.sendVerificationEmail,
    jwtSecret: process.env.JWT_SECRET, log: console.info,
  };
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const accounts = new Map();
  const sent = [];
  const logs = [];
  let deliveryFails = false;
  console.info = (line) => logs.push(line);

  const matches = (user, query) => {
    if (query.email && user.email !== query.email) return false;
    if (query.emailVerificationTokenHash && user.emailVerificationTokenHash !== query.emailVerificationTokenHash) return false;
    if (query.emailVerified !== undefined && user.emailVerified !== query.emailVerified) return false;
    if (query.emailVerificationExpires?.$gt && !(user.emailVerificationExpires > query.emailVerificationExpires.$gt)) return false;
    if (query.emailVerificationExpires?.$lte && !(user.emailVerificationExpires <= query.emailVerificationExpires.$lte)) return false;
    if (query.$or && !query.$or.some((condition) => condition.emailVerificationSentAt.$exists === false
      ? !user.emailVerificationSentAt : user.emailVerificationSentAt <= condition.emailVerificationSentAt.$lte)) return false;
    return true;
  };
  User.exists = async (query) => [...accounts.values()].some((user) => matches(user, query));
  User.create = async (input) => {
    const user = new User(input).toObject();
    accounts.set(user.email, user);
    return user;
  };
  User.findOne = ({ email }) => ({ lean: async () => accounts.get(email) || null });
  User.findById = (id) => ({ select: () => ({ lean: async () => [...accounts.values()].find((user) => String(user._id) === String(id)) || null }) });
  User.findOneAndUpdate = async (query, update) => {
    const user = [...accounts.values()].find((account) => matches(account, query));
    if (!user) return null;
    Object.assign(user, update.$set);
    for (const key of Object.keys(update.$unset || {})) delete user[key];
    return user;
  };
  User.updateOne = async (query, update) => {
    const user = [...accounts.values()].find((account) => String(account._id) === String(query._id));
    if (user) for (const key of Object.keys(update.$unset || {})) delete user[key];
  };
  emailService.sendVerificationEmail = async (message) => {
    if (deliveryFails) throw new Error('private Gmail OAuth detail');
    sent.push(message);
  };

  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/authRoutes'));
  app.get('/api/protected', authenticateToken, requireRole('student'), (_req, res) => res.json({ success: true }));
  app.use(validationErrorHandler);
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (path, body, headers = {}) => {
    const response = await fetch(`${base}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, data: await response.json() };
  };

  const password = 'ValidSecret1!';
  const email = 'marie@example.test';
  try {
    await t.test('registration stores a hash and grants no JWT or privileged role', async () => {
      const result = await call('/auth/register', { name: '  María O’Neil   Smith  ', email: ' MARIE@EXAMPLE.TEST ', password });
      assert.equal(result.status, 201);
      assert.equal(result.data.data, undefined);
      const user = accounts.get(email);
      assert.equal(user.name, 'María O’Neil Smith');
      assert.equal(user.role, 'student');
      assert.equal(user.emailVerified, false);
      assert.equal(user.skillsToTeach.length, 0);
      assert.equal(sent.length, 1);
      assert.equal(sent[0].recipient, email);
      assert.match(sent[0].token, /^[a-f0-9]{64}$/);
      assert.equal(user.emailVerificationTokenHash, hashVerificationToken(sent[0].token));
      assert.notEqual(user.emailVerificationTokenHash, sent[0].token);
      assert.ok(user.emailVerificationExpires > new Date());
      assert.equal((await call('/protected', undefined,
        { authorization: `Bearer ${jwt.sign({ id: user._id, role: 'admin' }, process.env.JWT_SECRET)}` })).status, 403);
    });
    await t.test('duplicate unverified registration resumes verification without changing the account', async () => {
      const user = accounts.get(email);
      const original = { name: user.name, password: user.password,
        hash: user.emailVerificationTokenHash, sentAt: user.emailVerificationSentAt };
      const sentCount = sent.length;
      const result = await call('/auth/register', {
        name: 'Another User', email: ' MARIE@EXAMPLE.TEST ', password: 'DifferentPassword2!',
      });
      assert.equal(result.status, 409);
      assert.equal(result.data.code, 'REGISTRATION_PENDING_VERIFICATION');
      assert.equal(result.data.data, undefined);
      assert.equal(result.data.token, undefined);
      assert.equal(accounts.size, 1);
      assert.equal(sent.length, sentCount);
      assert.equal(user.name, original.name);
      assert.equal(user.password, original.password);
      assert.equal(await bcrypt.compare(password, user.password), true);
      assert.equal(await bcrypt.compare('DifferentPassword2!', user.password), false);
      assert.equal(user.emailVerificationTokenHash, original.hash);
      assert.equal(user.emailVerificationSentAt, original.sentAt);
      assert.equal((await call('/auth/register', { name: 'Another User', email: 'other@example.test', password, role: 'admin' })).status, 400);
      assert.equal(accounts.size, 1);
    });
    await t.test('wrong credentials are generic and unverified login has no token', async () => {
      const wrong = await call('/auth/login', { email, password: 'WrongSecret1!' });
      const unknown = await call('/auth/login', { email: 'absent@example.test', password: 'WrongSecret1!' });
      assert.equal(wrong.status, 401);
      assert.deepEqual(wrong.data, unknown.data);
      const blocked = await call('/auth/login', { email, password });
      assert.equal(blocked.status, 403);
      assert.equal(blocked.data.code, 'EMAIL_VERIFICATION_REQUIRED');
      assert.equal(blocked.data.data, undefined);
    });
    await t.test('invalid and expired tokens fail; a valid token works once', async () => {
      assert.equal((await call('/auth/verify-email', { token: randomBytes(32).toString('hex') })).status, 400);
      const user = accounts.get(email);
      user.emailVerificationExpires = new Date(Date.now() - 1000);
      const expired = await call('/auth/verify-email', { token: sent[0].token });
      assert.equal(expired.status, 410);
      assert.equal(expired.data.code, 'VERIFICATION_EXPIRED');
      user.emailVerificationExpires = new Date(Date.now() + 60_000);
      assert.equal((await call('/auth/verify-email', { token: sent[0].token })).status, 200);
      assert.equal(user.emailVerified, true);
      assert.ok(user.emailVerifiedAt instanceof Date);
      assert.equal(user.emailVerificationTokenHash, undefined);
      assert.equal(user.emailVerificationExpires, undefined);
      assert.equal((await call('/auth/verify-email', { token: sent[0].token })).status, 400);
    });
    await t.test('verified Student login retains its role', async () => {
      const result = await call('/auth/login', { email, password });
      assert.equal(result.status, 200);
      assert.equal(result.data.data.user.role, 'student');
      assert.equal(jwt.verify(result.data.data.token, process.env.JWT_SECRET).role, 'student');
    });
    await t.test('verified account keeps its details and offers login', async () => {
      const before = { ...accounts.get(email) };
      const sentCount = sent.length;
      const result = await call('/auth/register', {
        name: 'Changed Name', email, password: 'DifferentPassword2!',
      });
      assert.equal(result.status, 409);
      assert.equal(result.data.code, undefined);
      assert.match(result.data.message, /already exists/);
      assert.deepEqual(accounts.get(email), before);
      assert.equal(sent.length, sentCount);
    });
    await t.test('legacy moderator without verification field keeps old password and RBAC access', async () => {
      const legacyPassword = 'legacy-password';
      const legacy = {
        _id: '507f1f77bcf86cd799439018', name: 'Demo moderator',
        email: 'legacy@example.test', role: 'moderator', credits: 2,
        password: await bcrypt.hash(legacyPassword, 4),
      };
      accounts.set(legacy.email, legacy);
      const result = await call('/auth/login', { email: ' LEGACY@EXAMPLE.TEST ', password: legacyPassword });
      assert.equal(result.status, 200);
      assert.equal(result.data.data.user.role, 'moderator');
      assert.equal(jwt.verify(result.data.data.token, process.env.JWT_SECRET).role, 'moderator');
      const studentOnly = await call('/protected', undefined,
        { authorization: `Bearer ${result.data.data.token}` });
      assert.equal(studentOnly.status, 403);
      const sentCount = sent.length;
      const duplicate = await call('/auth/register', {
        name: 'Changed Name', email: legacy.email, password: 'DifferentPassword2!',
      });
      assert.equal(duplicate.status, 409);
      assert.equal(duplicate.data.code, undefined);
      assert.deepEqual(accounts.get(legacy.email), legacy);
      assert.equal(sent.length, sentCount);
    });
    await t.test('legacy admin remains an existing account without registration mutation', async () => {
      const legacy = {
        _id: '507f1f77bcf86cd799439019', name: 'Demo admin',
        email: 'admin@example.test', role: 'admin', credits: 2,
        password: await bcrypt.hash('AdminSecret1!', 4),
      };
      accounts.set(legacy.email, legacy);
      const sentCount = sent.length;
      const result = await call('/auth/register', {
        name: 'Changed Name', email: ' ADMIN@EXAMPLE.TEST ', password: 'DifferentPassword2!',
      });
      assert.equal(result.status, 409);
      assert.equal(result.data.code, undefined);
      assert.deepEqual(accounts.get(legacy.email), legacy);
      assert.equal(sent.length, sentCount);
    });
    await t.test('resend replaces old token and gives an enumeration-safe response', async () => {
      const secondEmail = 'second@example.test';
      assert.equal((await call('/auth/register', { name: 'Second User', email: secondEmail, password })).status, 201);
      const oldToken = sent.at(-1).token;
      accounts.get(secondEmail).emailVerificationSentAt = new Date(Date.now() - 61_000);
      const resent = await call('/auth/resend-verification', { email: secondEmail });
      const unknown = await call('/auth/resend-verification', { email: 'absent@example.test' });
      assert.equal(resent.status, 200);
      assert.deepEqual(resent.data, unknown.data);
      assert.notEqual(sent.at(-1).token, oldToken);
      assert.equal(accounts.get(secondEmail).emailVerificationTokenHash, hashVerificationToken(sent.at(-1).token));
      assert.equal((await call('/auth/verify-email', { token: oldToken })).status, 400);
      assert.equal((await call('/auth/verify-email', { token: sent.at(-1).token })).status, 200);
    });
    await t.test('delivery failure retains recoverable account without logging secrets', async () => {
      deliveryFails = true;
      const result = await call('/auth/register', { name: 'Third User', email: 'third@example.test', password });
      assert.equal(result.status, 503);
      assert.equal(result.data.code, 'VERIFICATION_EMAIL_UNAVAILABLE');
      assert.equal(accounts.get('third@example.test').emailVerified, false);
      assert.equal(accounts.get('third@example.test').emailVerificationSentAt, undefined);
      deliveryFails = false;
      assert.equal((await call('/auth/resend-verification', { email: 'third@example.test' })).status, 200);
      assert.equal(sent.at(-1).recipient, 'third@example.test');
      assert.doesNotMatch(logs.join('\n'), /private Gmail|ValidSecret1!|Bearer |mongodb|[a-f0-9]{64}/);
    });
    await t.test('resend endpoint is rate limited', async () => {
      let limited = false;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const result = await call('/auth/resend-verification', { email: 'absent@example.test' });
        if (result.status === 429) { limited = true; break; }
        assert.equal(result.status, 200);
      }
      assert.equal(limited, true);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    User.exists = originals.exists;
    User.create = originals.create;
    User.findOne = originals.findOne;
    User.findOneAndUpdate = originals.findOneAndUpdate;
    User.findById = originals.findById;
    User.updateOne = originals.updateOne;
    emailService.sendVerificationEmail = originals.send;
    console.info = originals.log;
    if (originals.jwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originals.jwtSecret;
  }
});
