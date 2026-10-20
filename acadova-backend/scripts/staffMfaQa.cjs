// Actual staff auth/routes, fresh loopback database, existing MFA capability only.
const fs = require('node:fs'), path = require('node:path');
const { randomBytes, createHash } = require('node:crypto');
const mongoose = require('mongoose'), mailbox = require('./localMfaMailbox.cjs');
const emails = { admin: 'qa-mfa-admin@example.test', moderator: 'qa-mfa-moderator@example.test', student: 'qa-mfa-student@example.test' };
async function main() {
  if (!process.argv.includes('--serve') || process.env.NODE_ENV === 'production') throw new Error('Explicit local QA invocation required.');
  const run = process.env.ACADOVA_MANUAL_QA_RUN, password = process.env.ACADOVA_BUNDLE_C_QA_PASSWORD;
  if (!run || !fs.existsSync(path.join(run, 'credentials.clixml')) || !require('../middleware/validation').isValidPassword(password)) throw new Error('Use guarded launcher.');
  delete process.env.ACADOVA_BUNDLE_C_QA_PASSWORD;
  for (const key of Object.keys(process.env)) if (/MONGO|BREVO|ONESIGNAL|GEMINI|GOOGLE|SMTP|MAIL_|RESEND|TRUST_PROXY/i.test(key)) delete process.env[key];
  Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: randomBytes(48).toString('hex'), STAFF_MFA_HMAC_KEY: randomBytes(48).toString('hex'), FRONTEND_URL: 'http://127.0.0.1:5178', FRONTEND_ORIGIN: 'http://127.0.0.1:5178', AI_STUDY_ENABLED: 'false', ACADI_GEMINI_ENABLED: 'false' });
  const nativeFetch = global.fetch;
  global.fetch = (url, ...args) => {
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(String(url)).hostname)) throw new Error('External QA request blocked.');
    return nativeFetch(url, ...args);
  };
  const mail = require('../services/emailService'), codes = new Map();
  for (const name of Object.keys(mail).filter(n => n.startsWith('send'))) mail[name] = async () => { throw new Error('Email disabled in preview.'); };
  mail.sendStaffMfaEmail = async ({ recipient, code }) => {
    const role = Object.keys(emails).find(role => emails[role] === recipient);
    if (!['admin', 'moderator'].includes(role)) throw new Error('Unknown synthetic recipient.');
    mailbox.deliver(run, role, code); codes.set(role, code);
  };
  require('../services/notificationService').notifySafely = async () => {};
  await mongoose.connect('mongodb://127.0.0.1:27032/admin?directConnection=true', { serverSelectionTimeoutMS: 10000 });
  try { await mongoose.connection.db.admin().command({ replSetInitiate: { _id: 'acadovaExpQA', members: [{ _id: 0, host: '127.0.0.1:27032' }] } }); }
  catch (error) { if (error.codeName !== 'AlreadyInitialized') throw error; }
  await mongoose.disconnect();
  const database = 'acadova_staff_mfa_test_' + randomBytes(16).toString('hex');
  await mongoose.connect(`mongodb://127.0.0.1:27032/${database}?replicaSet=acadovaExpQA`, { serverSelectionTimeoutMS: 25000 });
  await require('../config/staffMfa').activateIsolatedStaffMfa();
  if (require('../config/studentExperience').active()) throw new Error('EXP must remain inactive here.');
  for (const name of fs.readdirSync(path.join(__dirname, '../models')).filter(n => n.endsWith('.js'))) {
    const model = require('../models/' + name); await model.createCollection(); await model.createIndexes();
  }
  const User = require('../models/User'), Challenge = require('../models/StaffMfaChallenge');
  const hash = await require('bcryptjs').hash(password, 10);
  for (const [role, email] of Object.entries(emails)) await User.create({ name: 'Synthetic MFA ' + role, email, password: hash, role, emailVerified: true, credits: 0, onboardingFinishedAt: new Date() });
  const express = require('express');
  function makeApp() {
    const app = express(); app.use(require('../middleware/httpSecurity').securityHeaders, require('../middleware/httpSecurity').corsMiddleware, express.json());
    for (const [prefix, name] of [['auth','authRoutes'],['users','userRoutes'],['admin','adminRoutes'],['moderator','moderatorRoutes'],['notifications','notificationRoutes'],['academic','academicWorkspaceRoutes'],['sessions','sessionRoutes'],['study-sets','studyRoutes'],['growth','growthRoutes']]) app.use('/api/' + prefix, require('../routes/' + name));
    app.get('/api/health', (req, res) => res.json({ localQa: true, staffMfaPreview: true, database, mfaEnabled: require('../config/staffMfa').enabled(), expActive: require('../config/studentExperience').active(), providers: 'local-dpapi-mock' }));
    app.use('/api', require('../middleware/apiErrors').apiNotFound);
    app.use(require('../middleware/validation').validationErrorHandler, require('../middleware/apiErrors').unexpectedError);
    return app;
  }
  const listen = async () => { const s = makeApp().listen(5006, '127.0.0.1'); await new Promise((resolve, reject) => { s.once('listening', resolve); s.once('error', reject); }); return s; };
  let server = await listen();
  const results = [];
  async function call(route, body, token) {
    const response = await fetch('http://127.0.0.1:5006/api/' + route, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  }
  function check(name, condition) { if (!condition) throw new Error('Synthetic MFA check failed: ' + name); results.push({ name, passed: true }); }
  const login = role => call('auth/login', { email: emails[role], password });
  const verify = (pending, code) => call('auth/staff-mfa/verify', { challenge: pending.body.data.challenge, code });
  const row = pending => ({ handleHash: createHash('sha256').update(pending.body.data.challenge).digest('hex') });
  const student = await login('student'); check('student_direct_login', student.status === 200 && !!student.body.data.token && !student.body.data.mfaRequired);
  for (const role of ['admin', 'moderator']) {
    const pending = await login(role), code = codes.get(role);
    check(role + '_password_only_pending', pending.status === 200 && pending.body.data.mfaRequired && !pending.body.data.token);
    check(role + '_pending_denied', (await call(role + '/overview', null, pending.body.data.challenge)).status === 401);
    check(role + '_encrypted_mailbox_roundtrip', mailbox.read(run, role) === code);
    check(role + '_wrong_code', (await verify(pending, code === '000000' ? '111111' : '000000')).status === 400);
    const success = await verify(pending, code);
    check(role + '_correct_code', success.status === 200 && success.body.data.user.role === role);
    check(role + '_protected_dashboard', (await call(role + '/overview', null, success.body.data.token)).status === 200);
    if (role === 'moderator') check('moderator_admin_denied', (await call('admin/overview', null, success.body.data.token)).status === 403);
    check(role + '_replay_denied', (await verify(pending, code)).status === 401);
  }
  const pending = await login('admin'), oldCode = codes.get('admin');
  check('resend_cooldown', (await call('auth/staff-mfa/resend', { challenge: pending.body.data.challenge })).status === 429);
  // Synthetic fixture timestamps only; real UI retains 60s/5min production rules.
  await Challenge.updateOne(row(pending), { $set: { sentAt: new Date(Date.now() - 61000) } });
  const resent = await call('auth/staff-mfa/resend', { challenge: pending.body.data.challenge });
  check('resend_rotates_without_extending_expiry', resent.status === 200 && codes.get('admin') !== oldCode && resent.body.data.expiresAt === pending.body.data.expiresAt);
  check('old_resent_code_denied', (await verify(pending, oldCode)).status === 400);
  check('new_resent_code_succeeds', (await verify(pending, codes.get('admin'))).status === 200);
  const expired = await login('moderator');
  await Challenge.updateOne(row(expired), { $set: { expiresAt: new Date(Date.now() - 1000) } });
  check('expired_code_denied', (await verify(expired, codes.get('moderator'))).status === 401);
  check('credits_and_exp_unmodified', await require('../models/CreditTransaction').countDocuments() === 0 && await require('../models/ExpLedgerEntry').countDocuments() === 0 && !require('../config/studentExperience').active());
  // A new router instance gives the human the ordinary full login rate budget,
  // rather than inheriting bootstrap test hits. Limit values are never changed.
  await new Promise(resolve => server.close(resolve)); delete require.cache[require.resolve('../routes/authRoutes')]; server = await listen();
  codes.clear(); for (const role of ['admin', 'moderator']) mailbox.requireFreshLogin(run, role);
  fs.writeFileSync(path.join(run, 'verification.json'), JSON.stringify({ database, emails, results, mfaEnabled: true, expActive: false, providers: 'local-dpapi-mock' }, null, 2));
  console.log('Isolated staff MFA preview ready on loopback 5006. Mailbox/password values are never logged.');
  const stop = () => server.close(async () => { await mongoose.disconnect(); process.exit(0); });
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
if (require.main === module) main().catch(() => { console.error('Isolated staff MFA preview failed. Normal configuration was not loaded.'); process.exit(1); });
