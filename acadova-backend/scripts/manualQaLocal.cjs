// Extended mode of bundleCqaLocal: real routes + existing P7 demo, fresh local data only.
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const emails = Object.freeze({ student: 'qa-student@example.test', moderator: 'qa-moderator@example.test', admin: 'qa-admin@example.test', peer: 'qa-peer@example.test' });
async function main() {
  if (process.env.NODE_ENV === 'production' || !process.argv.includes('--serve') || !process.argv.includes('--manual-all-roles')) throw new Error('Explicit local invocation required.');
  const password = process.env.ACADOVA_BUNDLE_C_QA_PASSWORD;
  const runDir = process.env.ACADOVA_MANUAL_QA_RUN;
  if (!runDir || !fs.existsSync(path.join(runDir, 'credentials.clixml')) || !require('../middleware/validation').isValidPassword(password) || password.length < 16) throw new Error('Use the local PowerShell launcher.');
  delete process.env.ACADOVA_BUNDLE_C_QA_PASSWORD;
  for (const key of Object.keys(process.env)) if (/MONGO|BREVO|ONESIGNAL|GEMINI|GOOGLE|SMTP|MAIL_|RESEND|TRUST_PROXY/i.test(key)) delete process.env[key];
  Object.assign(process.env, { NODE_ENV: 'development', JWT_SECRET: randomBytes(48).toString('hex'), FRONTEND_URL: 'http://127.0.0.1:5174', FRONTEND_ORIGIN: 'http://127.0.0.1:5174', AI_STUDY_ENABLED: 'false', AI_STUDY_LOCAL_QA: 'false', STUDENT_EMAIL_DOMAINS: 'phinmaed.com' });
  // Network defense in depth: injected mocks below cannot fall through to live services.
  const nativeFetch = global.fetch;
  global.fetch = (url, ...args) => {
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(String(url)).hostname)) throw new Error('External QA network request blocked.');
    return nativeFetch(url, ...args);
  };
  const mailbox = [];
  const mail = require('../services/emailService');
  for (const [method, route] of [['sendVerificationEmail', '/verify-email'], ['sendPasswordResetEmail', '/reset-password'], ['sendProposalEmail', '/sessions']]) {
    mail[method] = async message => {
      mailbox.push({ kind: method, recipient: message.recipient, at: new Date().toISOString(), url: message.token ? `http://127.0.0.1:5174${route}?token=${encodeURIComponent(message.token)}` : `http://127.0.0.1:5174${message.reviewPath || route}` });
      fs.writeFileSync(path.join(runDir, 'mock-mailbox.json'), JSON.stringify(mailbox.slice(-100), null, 2));
    };
  }
  await mongoose.connect('mongodb://127.0.0.1:27031/admin?directConnection=true', { serverSelectionTimeoutMS: 10000 });
  try { await mongoose.connection.db.admin().command({ replSetInitiate: { _id: 'acadovaAiQA', members: [{ _id: 0, host: '127.0.0.1:27031' }] } }); }
  catch (error) { if (error.codeName !== 'AlreadyInitialized') throw error; }
  await mongoose.disconnect();
  const database = `acadova_manual_qa_${randomBytes(16).toString('hex')}`;
  await mongoose.connect(`mongodb://127.0.0.1:27031/${database}?replicaSet=acadovaAiQA`, { serverSelectionTimeoutMS: 25000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (mongoose.connection.host !== '127.0.0.1' || hello.setName !== 'acadovaAiQA' || hello.hosts?.length !== 1 || hello.hosts[0] !== '127.0.0.1:27031') throw new Error('Unexpected topology.');
  // Initialize existing active models sequentially; leave inactive EXP storage untouched.
  for (const name of fs.readdirSync(path.join(__dirname, '../models')).filter(n => n.endsWith('.js') && !n.startsWith('Exp'))) await require('../models/' + name).init();
  const User = require('../models/User');
  const Credit = require('../models/CreditTransaction');
  const hash = await require('bcryptjs').hash(password, 10);
  const actors = {};
  for (const [label, email] of Object.entries(emails)) {
    const role = ['admin', 'moderator'].includes(label) ? label : 'student';
    actors[label] = await User.create({ name: `QA ${label === 'peer' ? 'Jordan Peer' : label === 'student' ? 'Alex Student' : label === 'admin' ? 'Morgan Admin' : 'Sam Moderator'}`, email, password: hash, role, emailVerified: true, emailVerifiedAt: new Date(), credits: role === 'student' ? 100 : 0, onboardingFinishedAt: new Date(), skillsToTeach: role === 'student' ? ['JavaScript', 'Mathematics'] : [], skillsToLearn: role === 'student' ? ['Algorithms', 'Physics'] : [] });
    if (role === 'student') await Credit.create({ type: 'initial_grant', toUser: actors[label]._id, amount: 100 });
  }
  const { validateBody, schemas } = require('../middleware/validation');
  const invoke = async (controller, actor, body, schema, id) => {
    const req = { user: { id: String(actor._id), role: actor.role, credits: actor.credits }, body, params: id ? { id: String(id) } : {}, method: 'POST', ip: '127.0.0.1' };
    const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(value) { this.body = value; return this; } };
    let valid = false; validateBody(schema)(req, res, () => { valid = true; });
    if (!valid) {
      console.error(JSON.stringify({ qaSetup: 'fixture_validation_failed', fields: Object.keys(body), role: actor.role }));
      throw new Error('Invalid synthetic fixture input.');
    }
    await controller(req, res);
    if (!res.body?.success) {
      console.error(JSON.stringify({ qaSetup: 'fixture_action_failed', fields: Object.keys(body), role: actor.role, status: res.statusCode, code: res.body?.code }));
      throw new Error('Synthetic demo action failed.');
    }
    return res.body.data;
  };
  await require('./prepareP7Local').prepareDemo({ actors: [actors.student, actors.peer, actors.moderator], invoke, schemas });
  // The reused demo normally contains an external meeting bookmark. This fresh
  // manual QA database uses reserved test links instead; there is no live room.
  await require('../models/Session').updateMany({ meetingLink: { $exists: true } }, { $set: { meetingLink: 'https://meet.example.test/qa-only' } });
  const content = await seedAcademic(actors);
  const express = require('express'); const app = express();
  const { securityHeaders, corsMiddleware } = require('../middleware/httpSecurity');
  app.use(securityHeaders, corsMiddleware, express.json({ limit: '100kb' }));
  app.use((req, res, next) => { if (req.body) req.body = require('express-mongo-sanitize').sanitize(req.body, { replaceWith: '_' }); next(); });
  const standard = require('../tests/fixtures/aiStudyDocuments.cjs');
  const strict = require('../tests/fixtures/strictStudyDocuments.cjs');
  const mockProvider = { async generate({ document, mode, type }) {
    await new Promise(resolve => setTimeout(resolve, 1200));
    const result = mode === 'strict_source' ? strict.output(document) : standard.output();
    if (mode !== 'strict_source' && !document.segments?.some(s => /binary search/i.test(s.text))) throw Object.assign(new Error('Use the supplied synthetic binary-search document in this mock.'), { status: 400 });
    return { ...result, ...(type === 'quiz' ? { flashcards: [] } : type === 'flashcards' ? { questions: [] } : {}), modelVersion: 'synthetic-mock-only' };
  } };
  const config = { ...require('../config/aiStudy').aiStudyConfig({ NODE_ENV: 'test', AI_STUDY_ENABLED: 'true', AI_STUDY_LOCAL_QA: 'true', GEMINI_API_KEY: 'not-a-provider-key' }), model: 'synthetic-mock-only' };
  for (const [prefix, file] of [['auth','authRoutes'],['users','userRoutes'],['notifications','notificationRoutes'],['academic','academicWorkspaceRoutes'],['study-circles','studyCircleRoutes'],['study-sharing','studySharingRoutes'],['study-sets','studyRoutes'],['moderator/study-sets','studyModerationRoutes'],['moderator','moderatorRoutes'],['admin','adminRoutes'],['sessions','sessionRoutes'],['credits','creditRoutes'],['growth','growthRoutes'],['learning','learningRoutes'],['assessments','assessmentRoutes'],['ratings','ratingRoutes'],['analytics','analyticsRoutes']]) app.use('/api/' + prefix, require('../routes/' + file));
  app.use('/api/ai-study', require('../routes/aiStudyRoutes').createAiStudyRouter({ provider: mockProvider, configFor: () => config }));
  app.get('/api/health', (req, res) => res.json({ success: true, localQa: true, manualAllRoles: true, database, expActive: require('../config/growthPolicy').EXP_ACTIVE, providers: 'mock-only' }));
  app.use('/api', require('../middleware/apiErrors').apiNotFound);
  app.use(require('../middleware/validation').validationErrorHandler, require('../middleware/apiErrors').unexpectedError);
  const server = app.listen(5002, '127.0.0.1'); await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  fs.writeFileSync(path.join(runDir, 'fixture-summary.json'), JSON.stringify({ database, emails, content, expActive: false, providers: 'mock-only', mailbox: path.join(runDir, 'mock-mailbox.json') }, null, 2));
  fs.writeFileSync(path.join(runDir, 'synthetic-search.pptx'), strict.source().buffer);
  console.log('All-role manual QA ready on loopback 5002. Passwords/tokens are never logged. EXP hard-off; email/AI mocked; data retained.');
  const stop = () => server.close(async () => { await mongoose.disconnect(); process.exit(0); });
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
async function seedAcademic(a) {
  const owner = a.student._id;
  const Term = require('../models/AcademicTerm'); const Subject = require('../models/PersonalSubject');
  const Module = require('../models/PersonalModule'); const Period = require('../models/ExaminationPeriod');
  const Resource = require('../models/AcademicResource'); const Set = require('../models/StudySet');
  const terms = [];
  for (const [startYear, semester] of [[2026,'First Semester'],[2026,'Second Semester'],[2025,'First Semester']]) terms.push(await Term.create({ owner, startYear, endYear: startYear + 1, semester }));
  await require('../models/User').updateOne({ _id: owner }, { $set: { currentTermId: terms[0]._id } });
  const sources = require('../tests/fixtures/strictStudyDocuments.cjs');
  const subjects = [];
  for (const [index, [name, code]] of [['Data Structures and Algorithms','CS201'],['Discrete Mathematics','MATH202'],['Fundamentals of Physics','PHY101'],['Database Systems','CS203']].entries()) {
    const subject = await Subject.create({ owner, termId: terms[0]._id, name, courseCode: code, instructor: 'Synthetic Instructor', section: 'QA-01', order: index }); subjects.push(String(subject._id));
    for (const [n, label] of ['Prelim','Midterm','Finals'].entries()) {
      const period = await Period.create({ owner, subjectId: subject._id, label, order: n });
      const module = await Module.create({ owner, subjectId: subject._id, periodId: period._id, title: ['Core concepts','Worked examples','Review and practice'][n], order: n, status: n === 0 ? 'in_progress' : 'not_started', ...(n === 0 ? { lastReviewedAt: new Date() } : {}) });
      await Resource.create({ owner, subjectId: subject._id, moduleId: module._id, kind: 'note', title: 'Synthetic revision notes', note: 'QA sample only. Review the core definitions, write a worked example, then check the practice questions.' });
      if (index === 0 && n === 0) {
        const doc = sources.source();
        await Resource.create({ owner, subjectId: subject._id, moduleId: module._id, kind: 'pptx', title: 'Search methods - synthetic source', fileName: 'synthetic-search.pptx', content: doc.buffer, bytes: doc.buffer.length });
      }
      await Set.create({ owner, subjectId: subject._id, moduleId: module._id, title: `${name}: ${['Foundations','Practice','Revision'][n]}`, subject: name, description: 'Hand-authored synthetic QA practice; no EXP award.', questions: [{ prompt: 'Which statement describes binary search?', options: ['It halves sorted input','It requires no input','It always sorts input','It checks random entries'], correctIndex: 0, explanation: 'Binary search repeatedly halves an already sorted search space.' }], flashcards: [{ front: 'Binary search prerequisite', back: 'Sorted input.' }, { front: 'Learning goal', back: 'Explain the steps with a worked example.' }] });
      if (n === 0) await require('../models/StudyPlanItem').create({ owner, subjectId: subject._id, moduleId: module._id, kind: index % 2 ? 'exam' : 'task', title: `${index % 2 ? 'Practice exam' : 'Review'}: ${name}`, notes: 'Synthetic planning record; dates are local QA examples.', timezone: 'Asia/Manila', dueAt: new Date(Date.now() + (index + 1) * 86400000) });
    }
  }
  await Subject.create({ owner, termId: terms[1]._id, name: 'Software Engineering', courseCode: 'CS301' });
  await Subject.create({ owner, termId: terms[2]._id, name: 'Introduction to Computing', courseCode: 'CS101' });
  const pending = await Set.create({ owner: a.peer._id, title: 'Synthetic search study guide - review queue', subject: 'Algorithms', state: 'pending', submittedAt: new Date(), questions: [{ prompt: 'What input does binary search require?', options: ['Sorted','Unsorted'], correctIndex: 0 }], flashcards: [{ front: 'Search', back: 'Locate a target.' }] });
  await Set.create({ ...require('../tests/fixtures/aiStudyDocuments.cjs').output(), owner, subjectId: subjects[0], origin: 'ai', title: 'Synthetic mock AI search practice', subject: 'Data Structures and Algorithms', description: 'Pre-seeded synthetic mock data for manual inspection; no live provider generated this set.', ai: { generationType: 'both', generationMode: 'standard', sourceName: 'synthetic-search.pptx', sourceFormat: 'pptx', sourceUnits: 4, model: 'synthetic-mock-only', modelVersion: 'synthetic-mock-only', limitation: 'Synthetic QA fixture only; no live provider call.' } });
  const published = await Set.create({ owner: a.peer._id, title: 'Synthetic public search practice', subject: 'Algorithms', state: 'published', approvedRevision: 1, publicationId: 'manual-qa-public-1', publishedAt: new Date(), questions: [{ prompt: 'Which search checks entries in sequence?', options: ['Linear search','Binary search'], correctIndex: 0 }], flashcards: [{ front: 'Linear search', back: 'Checks each entry in sequence.' }], decision: { actor: a.moderator._id, reason: 'Synthetic approval evidence for local inspection.', outcome: 'approve', at: new Date() } });
  await require('../models/StudyReport').create({ studySet: published._id, reporter: owner, reason: 'Synthetic content report: please review wording.', revision: 1, publicationId: published.publicationId });
  for (let i = 0; i < 3; i++) await require('../models/StudyCircle').create({ host: i === 0 ? owner : a.peer._id, title: ['Algorithms problem solving','Discrete mathematics review','Physics practice group'][i], description: 'Synthetic free QA circle. Meeting links use a reserved test domain; no real meeting exists.', tags: [i === 2 ? 'Physics' : 'Mathematics'], startsAt: new Date(Date.now() + (i + 1) * 86400000), endsAt: new Date(Date.now() + (i + 1) * 86400000 + 3600000), timezone: 'Asia/Manila', meetingUrl: 'https://meet.example.test/qa-only', capacity: 12, participants: i === 1 ? [owner] : [], reports: i === 2 ? [{ reporter: owner, reason: 'Synthetic circle report for moderator review.', at: new Date(), open: true }] : [] });
  await require('../models/VolunteerHost').create({ owner: a.peer._id, enabled: true, expertise: 'JavaScript and mathematics practice', interests: 'Synthetic peer learning and worked examples' });
  const sessions = require('../models/Session');
  await sessions.create({ learner: owner, tutor: a.peer._id, lifecycleVersion: 1, subject: 'Mathematics', creditAmount: 20, status: 'scheduled', scheduledAt: new Date(Date.now() + 3 * 86400000), meetingMethod: 'online', meetingLink: 'https://meet.example.test/qa-only', requestMessage: 'Synthetic scheduled session for interface inspection.' });
  await require('../models/AuditLog').create({ actor: a.admin._id, actorRole: 'admin', action: 'qa.environment_prepared', targetType: 'User', targetId: String(owner), summary: 'Synthetic local manual QA initialized; no production access', metadata: { localOnly: true } });
  return { academicYears: 2, terms: 3, subjects: 6, modules: 12, privateResources: 13, privateManualStudySets: 12, privateMockAiSets: 1, studyCircles: 3, subjectIds: subjects, pendingSetId: String(pending._id) };
}
module.exports = { main, emails };
