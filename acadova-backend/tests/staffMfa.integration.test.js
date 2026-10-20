const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const mongoose = require('mongoose'), express = require('express'), bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken');
const User = require('../models/User'), Challenge = require('../models/StaffMfaChallenge'), Audit = require('../models/AuditLog');
const policy = require('../config/staffMfa'), email = require('../services/emailService');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const hash = s => createHash('sha256').update(s).digest('hex');

test('durable staff verification on owned synthetic replica', { skip: process.env.ACADOVA_STAFF_MFA_DB_TESTS !== '1' }, async t => {
  assert.equal(process.env.NODE_ENV, 'test');
  const database = 'acadova_staff_mfa_test_' + randomUUID().replaceAll('-', '');
  await mongoose.connect('mongodb://127.0.0.1:27032/admin?directConnection=true', { serverSelectionTimeoutMS: 10000 });
  try { await mongoose.connection.db.admin().command({ replSetInitiate: { _id: 'acadovaExpQA', members: [{ _id: 0, host: '127.0.0.1:27032' }] } }); }
  catch (e) { if (e.codeName !== 'AlreadyInitialized') throw e; }
  await mongoose.disconnect();
  await mongoose.connect(`mongodb://127.0.0.1:27032/${database}?replicaSet=acadovaExpQA`, { serverSelectionTimeoutMS: 20000 });
  t.after(async () => { assert.equal(mongoose.connection.name, database); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  for (const model of [User, Challenge, Audit]) { await model.createCollection(); await model.createIndexes(); }
  const previous = { JWT_SECRET: process.env.JWT_SECRET, STAFF_MFA_HMAC_KEY: process.env.STAFF_MFA_HMAC_KEY };
  for (const name of Object.keys(previous)) process.env[name] = randomBytes(48).toString('hex');
  const sent = new Map(); let deliveryFails = false;
  const originalEmail = email.sendStaffMfaEmail;
  const notifications = require('../services/notificationService'), originalNotify = notifications.notifySafely;
  notifications.notifySafely = async () => {};
  t.after(() => { notifications.notifySafely = originalNotify; });
  email.sendStaffMfaEmail = async ({ recipient, code }) => { if (deliveryFails) throw new Error('synthetic failure'); assert.match(code, /^[0-9]{6}$/); sent.set(recipient, code); };
  t.after(() => { email.sendStaffMfaEmail = originalEmail; for (const [name, value] of Object.entries(previous)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } });
  const password = randomBytes(18).toString('hex'); const passwordHash = await bcrypt.hash(password, 4);
  const [student, admin, moderator] = await User.create(['student', 'admin', 'moderator'].map(role => ({ name: 'Synthetic ' + role, email: `${role}@example.test`, password: passwordHash, role, emailVerified: true })));
  let syntheticClient = 1;
  t.beforeEach(() => { syntheticClient += 1; });
  const app = express(); app.use(express.json());
  // Distinct synthetic client per case; real limiters remain installed unchanged.
  app.use((req, res, next) => { Object.defineProperty(req, 'ip', { value: '127.0.0.' + syntheticClient }); next(); });
  app.use('/api/auth', require('../routes/authRoutes'));
  app.use('/api/admin', require('../routes/adminRoutes'));
  app.get('/staff', authenticateToken, requireRole('admin', 'moderator'), (req, res) => res.json({ role: req.user.role }));
  app.get('/admin', authenticateToken, requireRole('admin'), (req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function call(path, body, token, method) {
    const r = await fetch(origin + path, { method: method || (body ? 'POST' : 'GET'), headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: r.status, body: await r.json() };
  }
  const login = user => call('/api/auth/login', { email: user.email, password });
  const verify = (pending, code) => call('/api/auth/staff-mfa/verify', { challenge: pending.body.data.challenge, code });
  const oldToken = user => jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
  const row = p => ({ handleHash: hash(p.body.data.challenge) });
  let studentToken, adminPending, adminToken;
  await t.test('environment alone cannot activate production policy; new indexes are unique and TTL', async () => {
    process.env.STAFF_MFA_ENABLED = 'true'; assert.equal(policy.enabled(), false); assert.equal(policy.RELEASE_APPROVED, false); delete process.env.STAFF_MFA_ENABLED;
    assert.equal(require('../config/studentExperience').active(), false);
    const indexes = await Challenge.collection.indexes(); assert.ok(indexes.find(i => i.key.handleHash === 1 && i.unique)); assert.ok(indexes.find(i => i.key.expiresAt === 1 && i.expireAfterSeconds === 0));
    await policy.activateIsolatedStaffMfa(); assert.equal(policy.enabled(), true);
  });
  await t.test('student password flow unchanged; incorrect staff password creates no challenge or token', async () => {
    const r = await login(student); assert.equal(r.status, 200); studentToken = r.body.data.token; assert.equal(r.body.data.user.role, 'student');
    const bad = await call('/api/auth/login', { email: admin.email, password: 'incorrect-password' }); assert.equal(bad.status, 401); assert.equal(bad.body.data, undefined); assert.equal(await Challenge.countDocuments(), 0);
  });
  await t.test('both authoritative staff roles require challenge; password alone grants no session', async () => {
    for (const actor of [admin, moderator]) {
      const r = await login(actor); assert.equal(r.status, 200); assert.equal(r.body.data.mfaRequired, true); assert.equal(r.body.data.token, undefined); assert.equal(r.body.data.user, undefined);
      assert.equal(r.body.data.maskedEmail.includes(actor.email), false);
      assert.equal((await call('/staff', null, r.body.data.challenge)).status, 401);
      assert.equal((await call('/staff', null, oldToken(actor))).status, 401);
      const raw = JSON.stringify(await Challenge.collection.findOne(row(r))); assert.equal(raw.includes(sent.get(actor.email)), false);
      if (actor === admin) adminPending = r;
      else { const v = await verify(r, sent.get(actor.email)); assert.equal(v.status, 200); assert.equal((await call('/admin', null, v.body.data.token)).status, 403); }
    }
  });
  await t.test('wrong code rejected; correct code issues scoped staff proof; replay denied', async () => {
    const correct = sent.get(admin.email), wrong = correct === '000000' ? '111111' : '000000';
    assert.equal((await verify(adminPending, wrong)).status, 400);
    const r = await verify(adminPending, correct); assert.equal(r.status, 200); adminToken = r.body.data.token;
    assert.equal(jwt.verify(adminToken, process.env.JWT_SECRET).staffMfa, true); assert.equal((await call('/admin', null, adminToken)).status, 200);
    assert.equal((await verify(adminPending, correct)).status, 401);
  });
  await t.test('concurrent verification consumes once and persists one verification audit', async () => {
    const p = await login(moderator), code = sent.get(moderator.email);
    const before = await Audit.countDocuments({ action: 'auth.staff_mfa_verified' });
    const r = await Promise.all([verify(p, code), verify(p, code)]); assert.deepEqual(r.map(x => x.status).sort(), [200, 401]);
    assert.equal(await Audit.countDocuments({ action: 'auth.staff_mfa_verified' }), before + 1);
  });
  await t.test('expiry, five wrong attempts and fabricated handles fail closed', async () => {
    const p = await login(moderator); await Challenge.updateOne(row(p), { $set: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await verify(p, sent.get(moderator.email))).status, 401);
    const q = await login(moderator), correct = sent.get(moderator.email), wrong = correct === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) assert.equal((await verify(q, wrong)).status, i === 4 ? 429 : 400);
    assert.equal((await verify(q, correct)).status, 401);
    assert.equal((await call('/api/auth/staff-mfa/verify', { challenge: randomBytes(32).toString('hex'), code: '123456' })).status, 401);
  });
  await t.test('resend cooldown, rotation, no expiry extension and delivery failure protection', async () => {
    const p = await login(moderator), previousCode = sent.get(moderator.email);
    assert.equal((await call('/api/auth/staff-mfa/resend', { challenge: p.body.data.challenge })).status, 429);
    await Challenge.updateOne(row(p), { $set: { sentAt: new Date(Date.now() - 61000) } });
    const r = await call('/api/auth/staff-mfa/resend', { challenge: p.body.data.challenge }); assert.equal(r.status, 200); assert.equal(r.body.data.expiresAt, p.body.data.expiresAt);
    assert.notEqual(previousCode, sent.get(moderator.email));
    assert.equal((await verify(p, previousCode)).status, 400);
    assert.equal((await verify(p, sent.get(moderator.email))).status, 200);
    deliveryFails = true; const f = await login(moderator); deliveryFails = false;
    assert.equal(f.status, 503); assert.equal(f.body.data, undefined); assert.equal(f.body.code, 'MFA_DELIVERY_UNAVAILABLE');
  });
  await t.test('challenge survives service reload and verifier key is mandatory', async () => {
    const p = await login(moderator), code = sent.get(moderator.email);
    delete require.cache[require.resolve('../services/staffMfaService')];
    assert.equal((await verify(p, code)).status, 200);
    const key = process.env.STAFF_MFA_HMAC_KEY; delete process.env.STAFF_MFA_HMAC_KEY;
    assert.equal((await login(moderator)).status, 503); process.env.STAFF_MFA_HMAC_KEY = key;
  });
  await t.test('unverified/historical staff cannot bypass and every new login challenges', async () => {
    for (const state of [false, undefined]) {
      await User.collection.updateOne({ _id: moderator._id }, state === undefined ? { $unset: { emailVerified: 1 } } : { $set: { emailVerified: false } });
      assert.equal((await login(moderator)).status, 403);
    }
    await User.updateOne({ _id: moderator._id }, { $set: { emailVerified: true } });
    assert.equal((await login(moderator)).body.data.mfaRequired, true);
  });
  await t.test('account changes invalidate pending proof and signed staff sessions', async () => {
    const p = await login(moderator), code = sent.get(moderator.email);
    await User.updateOne({ _id: moderator._id }, { $set: { suspendedAt: new Date() } }); assert.equal((await verify(p, code)).status, 401);
    await User.updateOne({ _id: moderator._id }, { $unset: { suspendedAt: 1 } });
    const q = await login(moderator), next = sent.get(moderator.email);
    await User.updateOne({ _id: moderator._id }, { $set: { email: 'changed@example.test' } }); assert.equal((await verify(q, next)).status, 401);
    await User.updateOne({ _id: moderator._id }, { $set: { email: moderator.email } });
    const s = await login(moderator); await User.updateOne({ _id: moderator._id }, { $set: { authVersion: randomBytes(32).toString('hex') } });
    assert.equal((await verify(s, sent.get(moderator.email))).status, 401);
    await User.updateOne({ _id: admin._id }, { $set: { email: 'newadmin@example.test' } }); assert.equal((await call('/staff', null, adminToken)).status, 401);
    await User.updateOne({ _id: admin._id }, { $set: { email: admin.email } });
    await User.updateOne({ _id: student._id }, { $set: { role: 'moderator' } }); assert.equal((await call('/staff', null, studentToken)).status, 401);
    const r = await login(student); assert.equal(r.body.data.mfaRequired, true);
    await User.updateOne({ _id: student._id }, { $set: { role: 'student' } }); assert.equal((await verify(r, sent.get(student.email))).status, 401);
  });
  await t.test('Google staff authentication also challenges; client role injection rejected', async () => {
    const google = require('../services/googleIdentityService'), original = google.verifyGoogleCredential;
    google.verifyGoogleCredential = async () => ({ email: admin.email, sub: 'synthetic-sub', name: 'Synthetic Admin' });
    try { const r = await call('/api/auth/google', { credential: 'synthetic-only-google-credential' }); assert.equal(r.status, 200); assert.equal(r.body.data.mfaRequired, true); assert.equal(r.body.data.token, undefined); }
    finally { google.verifyGoogleCredential = original; }
    assert.equal((await call('/api/auth/login', { email: student.email, password, role: 'admin' })).status, 400);
  });
  await t.test('audit failure rolls back consumption; concurrent failures cannot exceed five attempts', async () => {
    const p = await login(admin), code = sent.get(admin.email), original = Audit.create;
    Audit.create = async () => { throw new Error('synthetic audit outage'); };
    try { assert.equal((await verify(p, code)).status, 503); }
    finally { Audit.create = original; }
    assert.equal((await Challenge.findOne(row(p))).state, 'ready');
    assert.equal((await verify(p, code)).status, 200);
    const q = await login(admin), good = sent.get(admin.email), wrong = good === '000000' ? '111111' : '000000';
    const responses = await Promise.all(Array.from({ length: 7 }, () => verify(q, wrong)));
    assert.equal(responses.some(r => r.status === 200), false);
    assert.equal((await Challenge.findOne(row(q))).attempts, 5);
    assert.equal((await verify(q, good)).status, 401);
  });
  await t.test('real role and suspension controllers revoke old sessions and pending challenges', async () => {
    const p = await login(student), oldStudent = p.body.data.token;
    assert.equal((await call(`/api/admin/users/${student._id}/role`, { role: 'moderator' }, adminToken, 'PATCH')).status, 200);
    assert.equal((await call('/staff', null, oldStudent)).status, 401);
    const pending = await login(student), code = sent.get(student.email);
    assert.equal((await call(`/api/admin/users/${student._id}/role`, { role: 'student' }, adminToken, 'PATCH')).status, 200);
    assert.equal((await verify(pending, code)).status, 401);
    const q = await login(moderator), modCode = sent.get(moderator.email);
    assert.equal((await call(`/api/admin/users/${moderator._id}/status`, { status: 'suspended', reason: 'Synthetic security check' }, adminToken, 'PATCH')).status, 200);
    assert.equal((await verify(q, modCode)).status, 401);
    assert.equal((await call(`/api/admin/users/${moderator._id}/status`, { status: 'active' }, adminToken, 'PATCH')).status, 200);
    assert.equal((await verify(q, modCode)).status, 401);
  });
  await t.test('actual password reset revokes pending challenge and previous staff token', async () => {
    const p = await login(admin), code = sent.get(admin.email), reset = randomBytes(32).toString('hex');
    await User.updateOne({ _id: admin._id }, { $set: { passwordResetTokenHash: hash(reset), passwordResetExpires: new Date(Date.now() + 60000) } });
    assert.equal((await call('/api/auth/reset-password', { token: reset, password: 'SyntheticNewPassword1!' })).status, 200);
    assert.equal((await verify(p, code)).status, 401);
    assert.equal((await call('/staff', null, adminToken)).status, 401);
    const r = await call('/api/auth/login', { email: admin.email, password: 'SyntheticNewPassword1!' }); assert.equal(r.body.data.mfaRequired, true);
  });
  await t.test('confirmed isolated signing failure has safe operation diagnostics; historical cause remains unknown', async () => {
    const log = console.info, events = []; console.info = s => events.push(JSON.parse(s));
    const secret = process.env.JWT_SECRET; delete process.env.JWT_SECRET;
    try { const r = await login(student); assert.equal(r.status, 500); assert.ok(events.some(e => e.event === 'auth.login_error' && e.stage === 'token_signing')); }
    finally { console.info = log; process.env.JWT_SECRET = secret; }
    assert.equal(JSON.stringify(events).includes(password), false);
    const records = JSON.stringify(await Audit.find({}).lean()); for (const code of sent.values()) assert.equal(records.includes(code), false);
  });
  await t.test('strict input and endpoint rate limits remain enforced', async () => {
    assert.equal((await call('/api/auth/staff-mfa/verify', { challenge: 'bad', code: '123456' })).status, 400);
    let limited = false;
    for (let i = 0; i < 35; i++) if ((await call('/api/auth/staff-mfa/verify', { challenge: randomBytes(32).toString('hex'), code: '123456' })).status === 429) { limited = true; break; }
    assert.equal(limited, true);
    for (let i = 0; i < 20; i++) await call('/api/auth/login', { email: 'absent@example.test', password });
    assert.equal((await call('/api/auth/login', { email: 'absent@example.test', password })).status, 429);
  });
});
