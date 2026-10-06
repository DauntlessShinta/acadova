const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const auth = require('../controllers/authController');
const loginSecurity = require('../services/loginSecurityService');
const { cooldownSecondsFor, failureThreshold, maxCooldownSeconds } = require('../config/loginSecurity');
const { ACTIONS, recordLoginSecurityAudit } = require('../services/auditService');
const userController = require('../controllers/userController');
const adminAudit = require('../controllers/adminAuditController');
const { validateBody, schemas } = require('../middleware/validation');

const userId = '507f1f77bcf86cd799439011';
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; } });

test('policy starts at three failures, doubles, caps at five minutes, and never permanently locks', () => {
  assert.equal(failureThreshold, 3);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 30].map(cooldownSecondsFor),
    [0, 0, 15, 30, 60, 120, 240, 300]);
  assert.equal(maxCooldownSeconds, 300);
  assert.equal(User.schema.path('failedLoginAttempts').options.select, false);
  assert.equal(User.schema.path('loginCooldownUntil').options.select, false);
  assert.equal(User.schema.path('permanentLock'), undefined);
  assert.equal(User.schema.indexes().some(([key]) => key.failedLoginAttempts || key.loginCooldownUntil), false);
});

test('failure recording uses one atomic document update based on persisted values', async () => {
  const old = User.findOneAndUpdate;
  const captured = [];
  let count = 0;
  User.findOneAndUpdate = (filter, update, options) => {
    captured.push({ filter, update, options });
    count += 1;
    return { select: async () => ({ failedLoginAttempts: count }) };
  };
  try {
    const user = { _id: userId, password: 'hash' };
    const results = await Promise.all(Array.from({ length: 8 }, () => loginSecurity.recordFailedLogin(user)));
    assert.equal(count, 8);
    assert.deepEqual(results.map((item) => item.count), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(results[7].cooldownSeconds, 300);
    assert.ok(captured.every(({ filter, update, options }) => filter._id === userId
      && filter.password === 'hash' && Array.isArray(update) && options.new === true));
    const expression = JSON.stringify(captured[0].update);
    assert.match(expression, /\$add|\$dateAdd|\$ifNull|\$min/);
    assert.doesNotMatch(expression, /password|email/);
    assert.equal(captured[0].filter.$or.length, 2); // active cooldown cannot be shortened
  } finally { User.findOneAndUpdate = old; }
});

test('success reset is conditional and clears only login failure state', async () => {
  const old = User.findOneAndUpdate;
  let write;
  User.findOneAndUpdate = async (filter, update) => { write = { filter, update };
    return { _id: userId, role: 'student', credits: 100 }; };
  try {
    const result = await loginSecurity.resetAfterSuccess({ _id: userId, password: 'hash' });
    assert.equal(result._id, userId);
    assert.equal(write.filter.suspendedAt, null);
    assert.deepEqual(write.filter.emailVerified, { $ne: false });
    assert.equal(write.update.$set.failedLoginAttempts, 0);
    assert.deepEqual(Object.keys(write.update.$unset).sort(), ['lastFailedLoginAt', 'loginCooldownUntil']);
    assert.equal(write.update.$set.suspendedAt, undefined);
    assert.equal(write.update.$set.emailVerified, undefined);
  } finally { User.findOneAndUpdate = old; }
});

test('system audit records meaningful events with fixed safe metadata, not credentials', async () => {
  const old = AuditLog.create; const writes = [];
  AuditLog.create = async ([entry]) => { writes.push(entry); return [entry]; };
  try {
    await recordLoginSecurityAudit({ userId, action: ACTIONS.loginCooldownStarted,
      failureCount: 3, cooldownSeconds: 15, password: 'secret', token: 'secret' });
    assert.equal(writes[0].actorRole, 'system');
    assert.equal(writes[0].actor, undefined);
    assert.equal(writes[0].targetType, 'User');
    assert.deepEqual(writes[0].metadata, { failureCount: 3, cooldownSeconds: 15 });
    assert.doesNotMatch(JSON.stringify(writes), /secret|password|token|Authorization/);
    await assert.rejects(recordLoginSecurityAudit({ userId, action: ACTIONS.role,
      failureCount: 3 }));
  } finally { AuditLog.create = old; }
});

test('system AuditLog may omit an actor while privileged actions still require one', async () => {
  const system = new AuditLog({ actorRole: 'system', action: ACTIONS.loginCooldownStarted,
    targetType: 'User', targetId: userId, summary: 'Account login cooldown started' });
  await system.validate();
  const privileged = new AuditLog({ actorRole: 'admin', action: ACTIONS.role,
    targetType: 'User', targetId: userId, summary: 'Role changed' });
  await assert.rejects(privileged.validate(), (error) => Boolean(error.errors?.actor));
});

test('existing Admin audit listing accepts a security action filter', async () => {
  const old = { count: AuditLog.countDocuments, find: AuditLog.find };
  let filter;
  AuditLog.countDocuments = async (query) => { filter = query; return 1; };
  AuditLog.find = () => ({ select() { return this; }, sort() { return this; },
    skip() { return this; }, limit() { return this; }, populate() { return this; },
    lean: async () => [{ action: ACTIONS.loginCooldownStarted, actorRole: 'system' }] });
  try {
    const res = response(); await adminAudit.listAuditLogs({ query: {
      action: ACTIONS.loginCooldownStarted } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(filter, { action: ACTIONS.loginCooldownStarted });
    assert.equal(res.body.data[0].actorRole, 'system');
  } finally { AuditLog.countDocuments = old.count; AuditLog.find = old.find; }
});

test('login enforces progressive temporary cooldown and resets after valid credentials', async () => {
  const old = { find: User.findOne, findById: User.findById,
    fail: loginSecurity.recordFailedLogin, reset: loginSecurity.resetAfterSuccess,
    audit: AuditLog.create, compare: bcrypt.compare, jwt: process.env.JWT_SECRET, log: console.info };
  process.env.JWT_SECRET = 'p6-test-secret';
  const password = 'ValidSecret1!';
  const account = { _id: userId, email: 'student@example.test', name: 'Student',
    password: await bcrypt.hash(password, 4), role: 'student', credits: 100,
    emailVerified: true, failedLoginAttempts: 0 };
  const auditRows = []; const logs = []; let comparisons = 0;
  User.findOne = ({ email }) => ({ select() { return this; }, lean: async () => email === account.email ? { ...account } : null });
  User.findById = () => ({ select() { return this; }, lean: async () => ({ ...account }) });
  loginSecurity.recordFailedLogin = async () => {
    account.failedLoginAttempts += 1;
    const cooldownSeconds = cooldownSecondsFor(account.failedLoginAttempts);
    account.loginCooldownUntil = cooldownSeconds ? new Date(Date.now() + cooldownSeconds * 1000) : null;
    return { count: account.failedLoginAttempts, cooldownSeconds };
  };
  loginSecurity.resetAfterSuccess = async () => {
    if (account.loginCooldownUntil && account.loginCooldownUntil > new Date()) return null;
    account.failedLoginAttempts = 0; account.loginCooldownUntil = null;
    return { ...account };
  };
  AuditLog.create = async ([entry]) => { auditRows.push(entry); return [entry]; };
  bcrypt.compare = async (...args) => { comparisons += 1; return old.compare(...args); };
  console.info = (line) => logs.push(line);
  const invoke = async (email, suppliedPassword) => {
    const res = response(); await auth.login({ body: { email, password: suppliedPassword },
      ip: '127.0.0.1' }, res); return res;
  };
  try {
    const wrong = await invoke(account.email, 'wrong');
    const unknown = await invoke('unknown@example.test', 'wrong');
    assert.equal(wrong.statusCode, 401);
    assert.deepEqual(wrong.body, unknown.body);
    assert.equal(account.failedLoginAttempts, 1);
    const earlySuccess = await invoke(account.email, password);
    assert.equal(earlySuccess.statusCode, 200);
    assert.equal(account.failedLoginAttempts, 0);
    assert.equal((await invoke(account.email, 'wrong')).statusCode, 401);
    assert.equal((await invoke(account.email, 'wrong')).statusCode, 401);
    assert.equal((await invoke(account.email, 'wrong')).statusCode, 401);
    assert.equal(account.failedLoginAttempts, 3);
    assert.equal(auditRows.at(-1).action, ACTIONS.loginCooldownStarted);
    const before = comparisons;
    const blocked = await invoke(account.email, password);
    assert.equal(blocked.statusCode, 429);
    assert.equal(comparisons, before);
    assert.equal(blocked.body.data?.token, undefined);
    account.loginCooldownUntil = new Date(Date.now() - 1000);
    assert.equal((await invoke(account.email, 'wrong')).statusCode, 401);
    assert.equal(auditRows.at(-1).action, ACTIONS.loginCooldownExtended);
    account.loginCooldownUntil = new Date(Date.now() - 1000);
    const good = await invoke(account.email, password);
    assert.equal(good.statusCode, 200);
    assert.equal(account.failedLoginAttempts, 0);
    assert.equal(account.loginCooldownUntil, null);
    assert.equal(jwt.verify(good.body.data.token, process.env.JWT_SECRET).id, userId);
    assert.equal(auditRows.at(-1).action, ACTIONS.loginSuccessAfterFailures);
    account.suspendedAt = new Date();
    assert.equal((await invoke(account.email, password)).statusCode, 403);
    account.suspendedAt = null;
    assert.equal((await invoke(account.email, password)).statusCode, 200);
    assert.doesNotMatch(JSON.stringify(auditRows) + logs.join(''), /ValidSecret1!|wrong|Bearer |p6-test-secret/);
  } finally {
    User.findOne = old.find; User.findById = old.findById;
    loginSecurity.recordFailedLogin = old.fail; loginSecurity.resetAfterSuccess = old.reset;
    AuditLog.create = old.audit; bcrypt.compare = old.compare; console.info = old.log;
    if (old.jwt === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = old.jwt;
  }
});

test('profile updater whitelists fields even if security state is submitted', async () => {
  const old = User.findByIdAndUpdate; let update;
  User.findByIdAndUpdate = (_, value) => { update = value; return {
    select: async () => ({ name: value.name }),
  }; };
  try {
    const res = response(); await userController.updateMe({ user: { id: userId },
      body: { name: 'Student', failedLoginAttempts: 0, loginCooldownUntil: null,
        role: 'admin', suspendedAt: null, emailVerified: true } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(update, { name: 'Student' });
  } finally { User.findByIdAndUpdate = old; }
});

test('registration and profile validation reject client-supplied login security state', () => {
  for (const [schema, body] of [
    [schemas.register, { name: 'Student Name', email: 'student@example.test',
      password: 'ValidSecret1!', failedLoginAttempts: 0 }],
    [schemas.profile, { name: 'Student Name', loginCooldownUntil: null }],
  ]) {
    const res = response(); let proceeded = false;
    validateBody(schema)({ body }, res, () => { proceeded = true; });
    assert.equal(res.statusCode, 400);
    assert.equal(proceeded, false);
  }
});

// Keep the installed Mongoose Model/Query intact; intercept only the driver boundary.
test('installed Mongoose constructs and executes the login pipeline at the collection boundary', async (t) => {
  const mongoose = require('mongoose');
  t.diagnostic('Installed Mongoose: ' + mongoose.version);
  assert.throws(() => User.findOneAndUpdate({}, []), /updatePipeline/);
  const old = User.collection.findOneAndUpdate;
  t.after(() => { User.collection.findOneAndUpdate = old; });
  const calls = [];
  let failures = 0;
  User.collection.findOneAndUpdate = async (filter, update, options) => {
    calls.push({ filter, update, options });
    failures = Array.isArray(update) ? failures + 1 : 0;
    return { _id: new mongoose.Types.ObjectId(userId), password: 'hash',
      role: 'student', failedLoginAttempts: failures };
  };
  for (let count = 1; count <= 4; count++) {
    const result = await loginSecurity.recordFailedLogin({ _id: userId, password: 'hash' });
    assert.deepEqual(result, { count, cooldownSeconds: cooldownSecondsFor(count) });
  }
  const reset = await loginSecurity.resetAfterSuccess({ _id: userId, password: 'hash' });
  assert.equal(reset.failedLoginAttempts, 0);
  assert.equal(calls.length, 5);
  assert.ok(calls[0].filter._id instanceof mongoose.Types.ObjectId);
  assert.ok(Array.isArray(calls[0].update));
  assert.equal(calls[0].options.returnDocument, 'after');
  assert.match(JSON.stringify(calls[0].update), /\$dateAdd/);
  assert.equal(calls[4].update.$set.failedLoginAttempts, 0);
});
