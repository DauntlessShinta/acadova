// Explicit disposable local QA only. Never loads dotenv or accepts a database URI.
const mongoose = require('mongoose'); const express = require('express'); const bcrypt = require('bcryptjs'); const { randomBytes } = require('node:crypto');
async function main() {
  if (process.argv[2] !== '--serve' || process.env.NODE_ENV === 'production') throw new Error('Use --serve in local development only.');
  const password = process.env.ACADOVA_BUNDLE_C_QA_PASSWORD;
  if (typeof password !== 'string' || password.length < 12 || password.length > 64 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) throw new Error('Set ACADOVA_BUNDLE_C_QA_PASSWORD to a synthetic 12–64 character mixed-case password containing a digit.');
  for (const name of ['BREVO_API_KEY', 'MAIL_FROM', 'ONESIGNAL_APP_ID', 'ONESIGNAL_REST_API_KEY', 'ONESIGNAL_IDENTITY_SECRET', 'GEMINI_API_KEY', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CLIENT_ID']) delete process.env[name];
  process.env.NODE_ENV = 'development'; process.env.JWT_SECRET = randomBytes(48).toString('hex'); process.env.AI_STUDY_ENABLED = 'false'; process.env.AI_STUDY_LOCAL_QA = 'false'; process.env.FRONTEND_URL = 'http://127.0.0.1:5174'; process.env.FRONTEND_ORIGIN = 'http://127.0.0.1:5174';
  const database = `acadova_bundle_c_manual_${Date.now()}_${process.pid}`;
  await mongoose.connect(`mongodb://127.0.0.1:27031/${database}?replicaSet=acadovaAiQA`, { serverSelectionTimeoutMS: 10000 });
  if ((await mongoose.connection.db.admin().command({ hello: 1 })).setName !== 'acadovaAiQA' || mongoose.connection.host !== '127.0.0.1') throw new Error('Requires the dedicated loopback QA replica set.');
  const fs = require('node:fs'); const path = require('node:path'); const models = fs.readdirSync(path.join(__dirname, '../models')).filter(p => p.endsWith('.js')).map(p => require(path.join(__dirname, '../models', p))); await Promise.all(models.map(m => m.init()));
  const User = require('../models/User'); const hashed = await bcrypt.hash(password, 10);
  const [a, b] = await User.create(['a', 'b', 'c', 'staff'].map(label => ({ name: `Synthetic C ${label.toUpperCase()}`, email: `bundle-c-${label}@example.test`, password: hashed, emailVerified: true, role: label === 'staff' ? 'moderator' : 'student', credits: 100, skillsToTeach: [], skillsToLearn: [], onboardingFinishedAt: new Date() })));
  const historical = await require('../models/Session').create({ learner: a._id, tutor: b._id, subject: 'Synthetic historical paid session', creditAmount: 50, status: 'completed', creditsSettledAt: new Date() });
  await require('../models/CreditTransaction').create({ type: 'session_payment', fromUser: a._id, toUser: b._id, amount: 50, session: historical._id });
  const app = express(); const { securityHeaders, corsMiddleware } = require('../middleware/httpSecurity'); app.use(securityHeaders, corsMiddleware, express.json({ limit: '100kb' }));
  const sanitize = require('express-mongo-sanitize'); app.use((req, res, next) => { if (req.body) req.body = sanitize.sanitize(req.body, { replaceWith: '_' }); next(); });
  for (const [prefix, file] of [['auth', 'authRoutes'], ['users', 'userRoutes'], ['notifications', 'notificationRoutes'], ['academic', 'academicWorkspaceRoutes'], ['study-circles', 'studyCircleRoutes'], ['study-sharing', 'studySharingRoutes'], ['study-sets', 'studyRoutes'], ['moderator/study-sets', 'studyModerationRoutes'], ['moderator', 'moderatorRoutes'], ['sessions', 'sessionRoutes'], ['credits', 'creditRoutes'], ['learning', 'learningRoutes'], ['ai-study', 'aiStudyRoutes'], ['assessments', 'assessmentRoutes']]) app.use('/api/' + prefix, require('../routes/' + file));
  app.get('/api/health', (req, res) => res.json({ success: true, localQa: true, database }));
  app.use(require('../middleware/validation').validationErrorHandler); app.use(require('../middleware/apiErrors').unexpectedError);
  const server = app.listen(5002, '127.0.0.1'); await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  console.log(`Disposable Bundle C QA API: http://127.0.0.1:5002\nDatabase: ${database}\nAccounts: bundle-c-a@example.test, bundle-c-b@example.test, bundle-c-c@example.test, bundle-c-staff@example.test\nPassword: the synthetic value you set; never printed. AI/email/push providers disabled. Ctrl+C stops this process; the disposable database is retained.`);
  const stop = () => server.close(async () => { await mongoose.disconnect(); process.exit(0); }); process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
if (process.argv.includes('--manual-all-roles')) {
  require('./manualQaLocal.cjs').main().catch(async () => { console.error('Disposable local QA setup failed. No credentials disclosed.'); await mongoose.disconnect(); process.exitCode = 1; });
} else {
  main().catch(async error => { console.error(error.message); await mongoose.disconnect(); process.exitCode = 1; });
}
