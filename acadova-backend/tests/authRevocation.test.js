const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authVersionMatches } = require('../utils/authVersion');
const { hashVerificationToken } = require('../utils/verificationTokens');

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; } });

test('recovery revokes earlier bearer sessions and fresh password login remains usable', async (t) => {
  const secret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  t.after(() => { if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret; });
  const reset = randomBytes(32).toString('hex');
  const user = { _id: '507f1f77bcf86cd799439011', role: 'student', name: 'Local Student',
    email: 'recovery@example.test', credits: 100, emailVerified: true,
    password: await bcrypt.hash('OldPassword1!', 10),
    passwordResetTokenHash: hashVerificationToken(reset), passwordResetExpires: new Date(Date.now() + 60_000) };
  const query = () => ({ select() { return this; }, lean: async () => ({ ...user }) });
  t.mock.method(User, 'findOne', query);
  t.mock.method(User, 'findById', query);
  t.mock.method(User, 'findOneAndUpdate', async (filter, update, options) => {
    if (filter.passwordResetTokenHash && (filter.passwordResetTokenHash !== user.passwordResetTokenHash
      || !(user.passwordResetExpires > filter.passwordResetExpires.$gt))) return null;
    if (filter.password && filter.password !== user.password) return null;
    if (filter.password) assert.equal(options.select, '+authVersion');
    Object.assign(user, update.$set);
    for (const key of Object.keys(update.$unset || {})) delete user[key];
    return { ...user };
  });
  t.mock.method(User, 'exists', async () => false);
  const access = async (token) => {
    const res = response(); let accepted = false;
    await authenticateToken({ headers: { authorization: `Bearer ${token}` } }, res, () => { accepted = true; });
    return { status: res.statusCode, accepted };
  };
  const login = async (password) => {
    const res = response(); await auth.login({ body: { email: user.email, password } }, res); return res;
  };
  const before = await login('OldPassword1!');
  assert.equal(before.statusCode, 200);
  const legacy = jwt.sign({ id: user._id, role: 'student' }, process.env.JWT_SECRET);
  assert.equal((await access(before.body.data.token)).accepted, true);
  assert.equal((await access(legacy)).accepted, true);
  const changed = response();
  await auth.resetPassword({ body: { token: reset, password: 'NewPassword2!' } }, changed);
  assert.equal(changed.statusCode, 200);
  assert.equal((await access(before.body.data.token)).status, 401);
  assert.equal((await access(legacy)).status, 401);
  const after = await login('NewPassword2!');
  assert.equal(after.statusCode, 200);
  assert.equal((await access(after.body.data.token)).accepted, true);
  assert.equal(after.body.data.user.authVersion, undefined);
  assert.equal(await bcrypt.compare('OldPassword1!', user.password), false);
  const reused = response();
  await auth.resetPassword({ body: { token: reset, password: 'AnotherPassword3!' } }, reused);
  assert.equal(reused.statusCode, 400);
  assert.equal((await access(after.body.data.token)).accepted, true);
});

test('only absent legacy versions or matching canonical session versions authenticate', () => {
  const version = randomBytes(32).toString('hex');
  assert.equal(authVersionMatches(undefined, undefined), true);
  assert.equal(authVersionMatches(version, version), true);
  assert.equal(authVersionMatches(undefined, version), false);
  assert.equal(authVersionMatches(version, undefined), false);
  assert.equal(authVersionMatches(randomBytes(32).toString('hex'), version), false);
  for (const malformed of [null, 0, -1, 0.5, Number.MAX_SAFE_INTEGER, {}, [], 'bad', 'A'.repeat(64)]) {
    assert.equal(authVersionMatches(malformed, malformed), false);
    assert.equal(authVersionMatches(malformed, version), false);
  }
  assert.equal(User.schema.path('authVersion').options.select, false);
});
