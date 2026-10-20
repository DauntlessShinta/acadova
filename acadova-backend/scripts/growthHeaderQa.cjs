// Isolated header preview only. Never import server.js or load dotenv here.
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
async function main() {
  if (!process.argv.includes('--serve') || process.env.NODE_ENV === 'production') throw new Error('Explicit local preview invocation required.');
  const localDevelopment = process.argv.includes('--local-development');
  const frontendOrigin = localDevelopment ? 'http://localhost:5173' : 'http://127.0.0.1:5176';
  const run = process.env.ACADOVA_MANUAL_QA_RUN, password = process.env.ACADOVA_BUNDLE_C_QA_PASSWORD;
  if (!run || !fs.existsSync(path.join(run, 'credentials.clixml')) || !require('../middleware/validation').isValidPassword(password)) throw new Error('Use the guarded preview launcher.');
  delete process.env.ACADOVA_BUNDLE_C_QA_PASSWORD;
  for (const name of Object.keys(process.env)) if (/MONGO|BREVO|ONESIGNAL|GEMINI|GOOGLE|SMTP|MAIL_|RESEND|TRUST_PROXY/i.test(name)) delete process.env[name];
  Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: randomBytes(48).toString('hex'), FRONTEND_URL: frontendOrigin, FRONTEND_ORIGIN: frontendOrigin, AI_STUDY_ENABLED: 'false', ACADI_GEMINI_ENABLED: 'false' });
  const nativeFetch = global.fetch;
  global.fetch = (url, ...args) => {
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(String(url)).hostname)) throw new Error('External preview network blocked.');
    return nativeFetch(url, ...args);
  };
  const mail = require('../services/emailService');
  for (const name of Object.keys(mail).filter(n => n.startsWith('send'))) mail[name] = async () => { throw new Error('Email disabled in Growth preview.'); };
  require('../services/notificationService').notifySafely = async () => {};
  await mongoose.connect('mongodb://127.0.0.1:27032/admin?directConnection=true', { serverSelectionTimeoutMS: 10000 });
  try { await mongoose.connection.db.admin().command({ replSetInitiate: { _id: 'acadovaExpQA', members: [{ _id: 0, host: '127.0.0.1:27032' }] } }); }
  catch (error) { if (error.codeName !== 'AlreadyInitialized') throw error; }
  await mongoose.disconnect();
  const database = 'acadova_exp_engine_test_' + randomBytes(16).toString('hex');
  await mongoose.connect(`mongodb://127.0.0.1:27032/${database}?replicaSet=acadovaExpQA`, { serverSelectionTimeoutMS: 25000 });
  if (localDevelopment) {
    const c = mongoose.connection, hello = await c.db.admin().command({hello:1});
    if (c.host !== '127.0.0.1' || c.port !== 27032 || c.name !== database
      || hello.setName !== 'acadovaExpQA' || hello.hosts?.length !== 1
      || hello.hosts[0] !== '127.0.0.1:27032'
      || (await c.db.listCollections({}, {nameOnly:true}).toArray()).length !== 0) throw new Error('Fresh owned loopback database/topology required before any setup.');
  }
  const policy = require('../config/studentExperience');
  if (policy.active()) throw new Error('Preview must begin inactive.');
  const before = await require('../services/growthPresentation').summary(new mongoose.Types.ObjectId());
  if (before.active !== false || before.totalExp !== null) throw new Error('Inactive contract mismatch.');
  // Exact existing source-owned test capability; same verified client/database only.
  if (!localDevelopment) await policy.activateIsolatedStudentExperience();
  for (const name of fs.readdirSync(path.join(__dirname, '../models')).filter(n => n.endsWith('.js'))) {
    const model = require('../models/' + name);
    // EXP models deliberately disable automatic index creation. Explicit setup
    // is safe only here, after fresh loopback topology verification (or the existing capability).
    await model.createCollection(); await model.createIndexes();
  }
  if (localDevelopment) {
    // Fresh owned data only: do not reuse a normal account/database or resolve
    // legacy obligations implicitly. Explicit index/transaction prerequisites.
    for (const modelName of ['User','Session','CreditTransaction','ExpLedgerEntry','ExpAward']) {
      if (await require('../models/' + modelName).countDocuments() !== 0) throw new Error('Fresh empty local database required.');
    }
    for (const [modelName, indexName, key] of [
      ['ExpLedgerEntry','uniq_exp_owner_event',{owner:1,eventKey:1}],
      ['ExpLedgerEntry','uniq_exp_reversal',{reversalOf:1}],
      ['ExpAward','uniq_exp_claim_owner_event',{owner:1,eventKey:1}],
      ['LegacyCreditReview','uniq_legacy_credit_review_session',{session:1}],
    ]) {
      const indexes = await require('../models/' + modelName).collection.indexes();
      const index = indexes.find(index => index.name === indexName);
      if (!index?.unique || JSON.stringify(index.key) !== JSON.stringify(key)
        || (indexName === 'uniq_exp_reversal' && JSON.stringify(index.partialFilterExpression) !== JSON.stringify({reversalOf:{$exists:true}}))) throw new Error('Required local correctness index unavailable.');
    }
    const transaction = await mongoose.startSession(), probeId = new mongoose.Types.ObjectId();
    try {
      transaction.startTransaction({readConcern:{level:'snapshot'},writeConcern:{w:'majority'}});
      await require('../models/ExpAccountLock').create([{_id:probeId,revision:0}],{session:transaction});
      await transaction.abortTransaction();
      if (await require('../models/ExpAccountLock').exists({_id:probeId})) throw new Error('Local transaction rollback unavailable.');
    } finally { await transaction.endSession(); }
    await policy.activateIsolatedStudentExperience();
  }
  const User = require('../models/User');
  const hashed = await require('bcryptjs').hash(password, 10);
  const student = await User.create({ name: localDevelopment ? 'Synthetic Local Student' : 'Synthetic Growth Student', email: localDevelopment ? 'qa-free-student@example.test' : 'qa-growth@example.test', password: hashed, role: 'student', emailVerified: true, credits: 0, onboardingFinishedAt: new Date() });
  const moderator = await User.create({ name: 'Synthetic Assessment Author', email: localDevelopment ? 'qa-free-moderator@example.test' : 'qa-author@example.test', password: hashed, role: 'moderator', emailVerified: true, credits: 0 });
  if (localDevelopment) {
    await User.create({name:'Synthetic Local Tutor',email:'qa-free-tutor@example.test',password:hashed,role:'student',emailVerified:true,credits:0,onboardingFinishedAt:new Date(),skillsToTeach:['Arithmetic QA'],skillsToLearn:['Networking'],weeklyAvailability:{timezone:'Asia/Manila',ranges:[{day:1,start:'09:00',end:'17:00'}]}});
    await User.create({name:'Synthetic Local Admin',email:'qa-free-admin@example.test',password:hashed,role:'admin',emailVerified:true,credits:0,onboardingFinishedAt:new Date()});
  }
  const publishedAt = new Date(Date.now() - 60000);
  const assessments = [];
  for (let milestone = 1; milestone <= 5; milestone += 1) {
    const assessment = await require('../models/Assessment').create({ title: `Synthetic Growth QA assessment ${milestone}`, topic: 'Arithmetic QA', status: 'published', createdBy: moderator._id, approvedBy: moderator._id, publishedAt, passingScore: 70,
      questions: [0, 1, 2].map(i => ({ prompt: `Synthetic practice ${i + 1}: two plus two equals?`, options: ['Four', 'Five'], correctIndex: 0 })) });
    await require('../models/AuditLog').create({ actor: moderator._id, actorRole: 'moderator', action: require('../services/auditService').ACTIONS.assessmentPublished, targetType: 'Assessment', targetId: String(assessment._id), summary: 'Synthetic assessment publication for isolated Growth QA', createdAt: publishedAt });
    assessments.push(assessment);
  }
  const assessment = assessments[0];
  const express = require('express'), app = express();
  app.use(require('../middleware/httpSecurity').securityHeaders, require('../middleware/httpSecurity').corsMiddleware, express.json());
  for (const [prefix, name] of [['auth','authRoutes'],['users','userRoutes'],['growth','growthRoutes'],['academic','academicWorkspaceRoutes'],['assessments','assessmentRoutes'],['notifications','notificationRoutes'],['sessions','sessionRoutes'],['study-sets','studyRoutes']]) app.use('/api/' + prefix, require('../routes/' + name));
  if (localDevelopment) {
    for (const [prefix, name] of [['ratings','ratingRoutes'],['analytics','analyticsRoutes'],['credits','creditRoutes'],['acadi','acadiRoutes'],['ai-study','aiStudyRoutes'],['study-circles','studyCircleRoutes'],['study-sharing','studySharingRoutes'],['learning','learningRoutes'],['moderator/study-sets','studyModerationRoutes'],['moderator','moderatorRoutes'],['admin','adminRoutes']]) app.use('/api/' + prefix, require('../routes/' + name));
  }
  app.get('/api/health', (req, res) => res.json({ localQa: true, growthHeaderPreview: !localDevelopment, localFreeDevelopment: localDevelopment, syntheticData: true, database, ...policy.capabilities(), providers: 'disabled' }));
  app.use('/api', require('../middleware/apiErrors').apiNotFound);
  app.use(require('../middleware/validation').validationErrorHandler, require('../middleware/apiErrors').unexpectedError);
  const server = app.listen(5004, '127.0.0.1'); await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const origin = 'http://127.0.0.1:5004';
  async function call(route, body, token) {
    const r = await fetch(origin + '/api/' + route, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const value = await r.json(); if (!r.ok || value.success === false) throw new Error('Synthetic preview HTTP verification failed: ' + r.status);
    return value.data;
  }
  const login = await call('auth/login', { email: student.email, password });
  const empty = await call('growth', null, login.token);
  if (empty.totalExp !== 0 || !empty.active) throw new Error('Empty ledger must report zero.');
  if (!localDevelopment) {
    await call(`assessments/${assessment._id}/submit`, { answers: [0, 0, 0] }, login.token);
    await call(`assessments/${assessment._id}/submit`, { answers: [0, 0, 0] }, login.token);
  }
  const actual = await call('growth', null, login.token), me = await call('users/me', null, login.token);
  if (actual.totalExp !== (localDevelopment ? 0 : 20) || actual.rank.level !== 1 || me.experience.expActive !== true || me.role !== 'student') throw new Error('Persisted header contract mismatch.');
  if (await require('../models/ExpLedgerEntry').countDocuments({ owner: student._id }) !== (localDevelopment ? 0 : 1) || await require('../models/CreditTransaction').countDocuments() !== 0) throw new Error('Preview must award once and never write Credits.');
  fs.writeFileSync(path.join(run, 'verification.json'), JSON.stringify({ isolated: true, database, actualRole: me.role, actualCapabilities: me.experience, inactiveResponse: before, emptyTotal: empty.totalExp, persistedGrowth: { active: actual.active, totalExp: actual.totalExp, rank: actual.rank }, positiveLedgerEntries: localDevelopment ? 0 : 1, localFreeDevelopment: localDevelopment, zeroHistorySyntheticAccount: localDevelopment, creditTransactions: 0, duplicateSubmissionAwardedAgain: localDevelopment ? null : false, providers: 'disabled' }, null, 2));
  fs.writeFileSync(path.join(run, 'fixture-summary.json'), JSON.stringify({ database, email: student.email, assessments: assessments.map(a => String(a._id)), alreadyCompleted: localDevelopment ? null : String(assessment._id), providers: 'disabled' }, null, 2));
  console.log(localDevelopment ? 'Isolated free local development ready on loopback 5004. Synthetic zero-EXP accounts; no credentials logged.' : 'Isolated Growth preview ready on loopback 5004. Synthetic assessment verified; no credentials logged.');
  const stop = () => server.close(async () => { await mongoose.disconnect(); process.exit(0); });
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
if (require.main === module) main().catch(() => { console.error('Isolated Growth preview failed; normal configuration was not loaded.'); process.exit(1); });
