// Explicit opt-in; fixed fresh loopback DB only. Never reads dotenv/production URI.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Rating = require('../models/Rating');
const Session = require('../models/Session');
const CreditTransaction = require('../models/CreditTransaction');
const AuditLog = require('../models/AuditLog');

test('C.2 profile privacy and account management in isolated replica set', { skip: process.env.ACADOVA_PHASEC2_DB_TESTS !== '1' }, async t => {
  assert.notEqual(process.env.NODE_ENV, 'production');
  const database = `acadova_phasec2_${process.pid}`;
  await mongoose.connect(`mongodb://127.0.0.1:27029/${database}?replicaSet=acadovaPhase1`, { serverSelectionTimeoutMS: 10000 });
  assert.equal((await mongoose.connection.db.admin().command({ hello: 1 })).setName, 'acadovaPhase1');
  const oldSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = randomBytes(32).toString('hex'); let server;
  const providerKeys = ['BREVO_API_KEY', 'MAIL_FROM', 'ONESIGNAL_APP_ID', 'ONESIGNAL_REST_API_KEY', 'ONESIGNAL_IDENTITY_SECRET'];
  const priorProviders = Object.fromEntries(providerKeys.map(key => [key, process.env[key]]));
  for (const key of providerKeys) delete process.env[key];
  t.after(async () => { if (server) await new Promise(resolve => server.close(resolve)); assert.equal(mongoose.connection.db.databaseName, database); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret; for (const key of providerKeys) { if (priorProviders[key] === undefined) delete process.env[key]; else process.env[key] = priorProviders[key]; } });
  await Promise.all([User, Rating, Session, CreditTransaction, AuditLog].map(model => model.init()));
  const password = 'IsolatedProfileFixture1!'; const hash = await require('bcryptjs').hash(password, 4);
  const [student, peer, admin, moderator, unverified] = await User.create(['student', 'student', 'admin', 'moderator', 'student'].map((role, i) => ({ name: ['Learner Fixture', 'Peer Fixture', 'Admin Fixture', 'Moderator Fixture', 'Unverified Fixture'][i], email: `c2-${i}@example.test`, password: hash, role, credits: 100, emailVerified: i !== 4, skillsToTeach: ['Java'], weeklyAvailability: { timezone: 'Asia/Manila', ranges: [{ day: 1, start: '09:00', end: '12:00' }] } })));
  const legacy = new mongoose.Types.ObjectId(); await User.collection.insertOne({ _id: legacy, name: 'Legacy Student', email: 'legacy-c2@example.test', password: hash, role: 'student', credits: 100, skillsToTeach: ['Java'] });
  await Rating.create([{ session: new mongoose.Types.ObjectId(), fromUser: student._id, toUser: peer._id, rating: 4, comment: 'Visible review' }, { session: new mongoose.Types.ObjectId(), fromUser: student._id, toUser: peer._id, rating: 1, comment: 'PRIVATE_HIDDEN_REVIEW', isHidden: true }]);
  const app = express(); app.use(require('cors')({ origin: (origin, callback) => callback(null, !origin || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) })); app.use(express.json());
  app.use('/api/users', require('../routes/userRoutes')); app.use('/api/auth', require('../routes/authRoutes')); app.use('/api/admin', require('../routes/adminRoutes')); app.use('/api/sessions', require('../routes/sessionRoutes')); app.use('/api/credits', require('../routes/creditRoutes')); app.use('/api/notifications', require('../routes/notificationRoutes')); app.use(require('../middleware/validation').validationErrorHandler);
  app.use('/api/analytics', require('../routes/analyticsRoutes')); app.use('/api/learning', require('../routes/learningRoutes'));
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const call = async (route, actor = student, method = 'GET', body) => { const response = await fetch(`http://127.0.0.1:${server.address().port}/api${route}`, { method, headers: { authorization: `Bearer ${jwt.sign({ id: String(actor._id || actor), role: 'admin' }, process.env.JWT_SECRET)}`, ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: response.status, body: await response.json() }; };
  await t.test('missing optional fields and historical verification absence stay compatible', async () => {
    const result = await call(`/users/${legacy}`); assert.equal(result.status, 200); assert.equal(result.body.data.ratingCount, 0); assert.equal(result.body.data.rating, null); assert.ok(!('university' in result.body.data));
    const owner = await call('/users/me', legacy); assert.equal(owner.status, 200); assert.ok(!('emailVerified' in owner.body.data));
    assert.equal((await call('/users/me', unverified)).status, 403);
  });
  await t.test('owner-only optional values persist privately and reload without a migration', async () => {
    const patch = { bio: 'Collaborative learning.', university: 'Private University', yearLevel: '3rd year', languages: ['English', 'Filipino'] };
    assert.equal((await call('/users/me', peer, 'PATCH', patch)).status, 200);
    const own = (await call('/users/me', peer)).body.data; assert.equal(own.university, patch.university); assert.deepEqual(own.languages, patch.languages);
    const other = (await call(`/users/${peer._id}`)).body.data; for (const key of Object.keys(patch)) assert.ok(!(key in other));
    assert.ok(!(await User.findById(student._id).lean()).university);
  });
  await t.test('explicit visibility exposes only chosen safe fields and can be revoked', async () => {
    assert.equal((await call('/users/me', peer, 'PATCH', { profileVisibility: { university: true, languages: true } })).status, 200);
    const data = (await call(`/users/${peer._id}`)).body.data; assert.equal(data.university, 'Private University'); assert.deepEqual(data.languages, ['English', 'Filipino']); assert.ok(!('bio' in data) && !('yearLevel' in data));
    for (const key of ['email', 'password', 'emailVerified', 'profileVisibility', 'authVersion', 'failedLoginAttempts', 'credits', 'createdAt']) assert.ok(!(key in data), key);
    assert.equal((await call('/users/me', peer, 'PATCH', { profileVisibility: {} })).status, 200); assert.ok(!('university' in (await call(`/users/${peer._id}`)).body.data));
  });
  await t.test('invalid values and privileged mass assignment cause no writes', async () => {
    for (const body of [{ university: 'x'.repeat(121) }, { yearLevel: 'invalid' }, { languages: ['English', 'English'] }, { profileVisibility: { email: true } }, { bio: 'Hello', role: 'admin' }, { university: 'School', credits: 999 }, { university: 'School', id: String(peer._id) }]) assert.equal((await call('/users/me', student, 'PATCH', body)).status, 400);
    assert.equal((await User.findById(student._id).lean()).role, 'student'); assert.equal((await User.findById(student._id).lean()).credits, 100);
  });
  await t.test('hidden reviews and stored rating defaults never become public reputation', async () => {
    const profile = (await call(`/users/${peer._id}`)).body.data; assert.equal(profile.rating, 4); assert.equal(profile.ratingCount, 1);
    const reviews = (await call(`/users/${peer._id}/reviews`)).body.data; assert.equal(reviews.length, 1); assert.equal(reviews[0].comment, 'Visible review'); assert.ok(!JSON.stringify(reviews).includes('example.test'));
  });
  await t.test('database roles retain Admin protections and recorded consequences', async () => {
    assert.equal((await call('/admin/users', student)).status, 403); assert.equal((await call('/admin/users', moderator)).status, 403);
    assert.equal((await call(`/admin/users/${peer._id}/role`, student, 'PATCH', { role: 'moderator' })).status, 403);
    assert.equal((await call(`/admin/users/${admin._id}/role`, admin, 'PATCH', { role: 'student' })).status, 400);
    assert.equal((await call(`/admin/users/${legacy}/role`, admin, 'PATCH', { role: 'moderator' })).status, 200);
    assert.equal((await call(`/admin/users/${legacy}/role`, admin, 'PATCH', { role: 'student' })).status, 200);
    assert.equal(await AuditLog.countDocuments({ action: 'user.role_changed', targetId: String(legacy) }), 2);
    assert.equal((await call(`/admin/users/${admin._id}/status`, admin, 'PATCH', { status: 'suspended', reason: 'Synthetic safety review' })).status, 400);
    assert.equal((await call(`/admin/users/${legacy}/status`, admin, 'PATCH', { status: 'suspended', reason: 'Synthetic safety review' })).status, 200);
    assert.equal((await call(`/users/${legacy}`)).status, 404);
    assert.equal((await call(`/admin/users/${legacy}/status`, admin, 'PATCH', { status: 'active' })).status, 200);
  });
  await t.test('real Chrome owner/public profile, directory and existing request flow', { skip: process.env.ACADOVA_PHASEC2_BROWSER !== '1' }, async () => {
    const path = require('node:path'); const { spawn } = require('node:child_process');
    const config = { url: `http://127.0.0.1:${server.address().port}/`, token: jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET), studentEmail: student.email, peerEmail: peer.email, peerId: String(peer._id), studentId: String(student._id), password };
    const child = spawn(process.execPath, ['--max-old-space-size=256', '--max-semi-space-size=4', 'tests/browser-demo.mjs', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'browser-release-c2-live.jsx', '1366', path.join(require('node:os').tmpdir(), 'acadova-c2-live.png'), '768', '/none'], { cwd: path.resolve(__dirname, '../../acadova-frontend'), windowsHide: true, env: { ...process.env, ACADOVA_LOCAL_BROWSER_CONFIG: JSON.stringify(config) }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
    assert.equal(await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); }), 0, output); console.log(output.trim());
    assert.equal((await User.findById(student._id)).credits, 100); assert.equal((await User.findById(peer._id)).credits, 100); assert.equal(await CreditTransaction.countDocuments(), 0);
    const request = await Session.findOne({ learner: student._id, tutor: peer._id }).lean(); assert.equal(request.status, 'pending'); assert.equal(request.meetingMethod, 'online'); assert.equal(request.creditAmount, 20);
    assert.equal((await call(`/admin/users/${peer._id}/role`, admin, 'PATCH', { role: 'moderator' })).status, 409);
  });
});
