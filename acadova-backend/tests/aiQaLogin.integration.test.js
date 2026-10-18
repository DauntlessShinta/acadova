// No dotenv/provider access. Uses only a PID-named database on the fixed local AI QA replica set.
const test = require('node:test'); const assert = require('node:assert/strict'); const { isDeepStrictEqual } = require('node:util');
const { randomBytes } = require('node:crypto'); const mongoose = require('mongoose'); const bcrypt = require('bcryptjs'); const express = require('express');
const User = require('../models/User'); const AuditLog = require('../models/AuditLog');
const { prepareAccounts, main, QA_URI, emails } = require('../scripts/prepareAiStudyQaLocal.cjs');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
test('synthetic QA credentials authenticate through real login with secure storage, scoped repair and unchanged protections', { skip: process.env.ACADOVA_AI_LOGIN_DB_TESTS !== '1' }, async t => {
  assert.notEqual(process.env.NODE_ENV, 'production');
  const previousEnvironment = process.env.NODE_ENV; const previousSecret = process.env.JWT_SECRET;
  process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const database = `acadova_ai_login_test_${process.pid}`; const secret = 'Qa!' + randomBytes(12).toString('hex') + 'Z'; const repairedSecret = 'Qa!' + randomBytes(12).toString('hex') + 'Y';
  const captured = []; const hashes = []; let server; let ownsDatabase = false;
  const oldConsole = Object.fromEntries(['log', 'info', 'warn', 'error', 'debug'].map(key => [key, console[key]]));
  t.after(async () => {
    for (const [key, value] of Object.entries(oldConsole)) console[key] = value;
    if (server) await new Promise(resolve => server.close(resolve));
    if (ownsDatabase && mongoose.connection.db?.databaseName === database) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (previousEnvironment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnvironment;
    if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
  });
  await mongoose.connect(QA_URI, { dbName: database, serverSelectionTimeoutMS: 5000 });
  assert.equal((await mongoose.connection.db.admin().command({ hello: 1 })).setName, 'acadovaAiQA');
  for (const collection of await mongoose.connection.db.listCollections().toArray()) assert.equal(await mongoose.connection.db.collection(collection.name).countDocuments(), 0, 'Test database must contain no existing records');
  ownsDatabase = true;
  await Promise.all([User.init(), AuditLog.init()]);
  for (const key of Object.keys(oldConsole)) console[key] = (...values) => captured.push(values.join(' '));
  const app = express(); app.use(express.json()); app.use('/api/auth', require('../routes/authRoutes'));
  app.get('/api/qa/me', authenticateToken, requireRole('student'), (req, res) => res.json({ role: req.user.role }));
  app.use(require('../middleware/validation').validationErrorHandler);
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = async (email, password) => { const response = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) }); return { status: response.status, data: await response.json() }; };
  const records = () => User.find({ email: { $in: emails } }).select('+authVersion +failedLoginAttempts +lastFailedLoginAt +loginCooldownUntil').sort({ email: 1 }).lean();
  let oldToken;
  await t.test('new synthetic accounts store bcrypt cost 10 and log in normally as Students', async () => {
    await prepareAccounts({ password: secret });
    const rows = await records(); assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.ok(/^\$2[aby]\$10\$[./A-Za-z0-9]{53}$/.test(row.password), 'Expected bcrypt cost 10, never plaintext');
      assert.ok(await bcrypt.compare(secret, row.password)); hashes.push(row.password);
      assert.equal(row.role, 'student'); assert.equal(row.emailVerified, true); assert.equal(row.credits, 0);
      const result = await login(row.email, secret); assert.equal(result.status, 200); assert.equal(result.data.data.user.role, 'student'); oldToken ||= result.data.data.token;
    }
  });
  await t.test('wrong credentials return 401; a successful login clears ordinary failure metadata', async () => {
    assert.equal((await login(emails[0], repairedSecret)).status, 401);
    assert.equal((await User.findOne({ email: emails[0] }).select('+failedLoginAttempts')).failedLoginAttempts, 1);
    assert.equal((await login(emails[0], secret)).status, 200);
    assert.equal((await User.findOne({ email: emails[0] }).select('+failedLoginAttempts')).failedLoginAttempts, 0);
  });
  await t.test('three failures activate cooldown; plain preparation does not clear it', async () => {
    for (let i = 0; i < 3; i++) assert.equal((await login(emails[0], repairedSecret)).status, 401);
    assert.equal((await login(emails[0], secret)).status, 429);
    const before = await User.findOne({ email: emails[0] }).select('+failedLoginAttempts +loginCooldownUntil').lean();
    await prepareAccounts({ password: secret });
    const after = await User.findOne({ email: emails[0] }).select('+failedLoginAttempts +loginCooldownUntil').lean();
    assert.equal(after.failedLoginAttempts, before.failedLoginAttempts); assert.equal(after.loginCooldownUntil.getTime(), before.loginCooldownUntil.getTime());
    assert.equal((await login(emails[0], secret)).status, 429);
  });
  await t.test('explicit repair replaces legacy plaintext, resets only QA cooldowns, rotates sessions and leaves other users untouched', async () => {
    const unrelated = await User.create({ name: 'Unrelated Local Fixture', email: 'untouched@example.test', password: await bcrypt.hash(repairedSecret, 10), role: 'moderator', emailVerified: true, credits: 57 });
    const before = await User.findById(unrelated._id).select('+authVersion +failedLoginAttempts +loginCooldownUntil').lean(); hashes.push(before.password);
    // Reproduce the old setup defect only in the disposable PID-named test database.
    await User.updateMany({ email: { $in: emails } }, { $set: { password: secret, failedLoginAttempts: 6, lastFailedLoginAt: new Date(), loginCooldownUntil: new Date(Date.now() + 300000) } });
    await assert.rejects(prepareAccounts({ password: secret }), /reset-synthetic-passwords/);
    let target;
    const code = await main({ argv: ['--prepare-synthetic', '--reset-synthetic-passwords'], env: { NODE_ENV: 'test', ACADOVA_AI_QA_PASSWORD: repairedSecret },
      connect: async uri => { target = uri; }, disconnect: async () => {}, log: { log: value => captured.push(value), error: value => captured.push(value) } });
    assert.equal(code, 0); assert.equal(target, QA_URI);
    for (const row of await records()) {
      assert.ok(/^\$2[aby]\$10\$[./A-Za-z0-9]{53}$/.test(row.password)); assert.ok(await bcrypt.compare(repairedSecret, row.password)); assert.ok(!await bcrypt.compare(secret, row.password)); hashes.push(row.password);
      assert.equal(row.failedLoginAttempts, 0); assert.equal(row.loginCooldownUntil, undefined); assert.equal(row.lastFailedLoginAt, undefined); assert.ok(/^[a-f\d]{64}$/.test(row.authVersion));
      assert.equal(row.role, 'student'); assert.equal(row.emailVerified, true); assert.equal(row.credits, 0); assert.equal((await login(row.email, repairedSecret)).status, 200);
    }
    assert.ok(isDeepStrictEqual(before, await User.findById(unrelated._id).select('+authVersion +failedLoginAttempts +loginCooldownUntil').lean()), 'Unrelated user must not change');
    const stale = await fetch(base + '/api/qa/me', { headers: { authorization: `Bearer ${oldToken}` } }); assert.equal(stale.status, 401);
  });
  await t.test('unexpected role, unverified or suspended allowlisted account aborts the entire repair', async () => {
    for (const patch of [{ role: 'moderator' }, { emailVerified: false }, { suspendedAt: new Date() }]) {
      await User.updateOne({ email: emails[1] }, { $set: patch }); const before = await records();
      await assert.rejects(prepareAccounts({ password: secret, resetCredentials: true }), /unexpected role/);
      assert.ok(isDeepStrictEqual(before, await records()), 'Both-account repair must roll back');
      await User.updateOne({ email: emails[1] }, { $set: { role: 'student', emailVerified: true, suspendedAt: null } });
    }
  });
  await t.test('wrong connection metadata is rejected and IP rate limiting remains active', async () => {
    for (const connection of [{ host: 'example.test', port: 27031, name: 'acadova' }, { host: '127.0.0.1', port: 27017, name: 'acadova' }, { host: '127.0.0.1', port: 27031, name: 'production' }]) await assert.rejects(prepareAccounts({ password: secret, connection }), /dedicated loopback/);
    let limited = false; for (let i = 0; i < 21; i++) { if ((await login('unknown@example.test', secret)).status === 429) limited = true; } assert.ok(limited);
  });
  await t.test('setup, auth and error logs contain neither password values nor stored password hashes', () => {
    const logged = captured.join('\n'); assert.ok(captured.length > 0);
    for (const value of [secret, repairedSecret, ...hashes]) assert.ok(!logged.includes(value), 'Credential value leaked to logs');
    assert.ok(!/\$2[aby]\$\d\d\$/.test(logged), 'Password hash leaked to logs');
  });
});
