// Explicit operator tool, never imported by the API and never loads dotenv.
const { randomBytes } = require('node:crypto');

function checkInvocation(argv, env) {
  const allowed = new Set(['--local-only', '--demo', '--rotate-passwords']);
  if (!argv.includes('--local-only') || argv.some((arg) => !allowed.has(arg))) {
    throw new Error('Use --local-only, optionally --demo or --rotate-passwords');
  }
  if (String(env.NODE_ENV || '').toLowerCase() === 'production' || env.MONGO_URI) {
    throw new Error('Run from a clean local shell without production mode or MONGO_URI');
  }
  if (argv.includes('--rotate-passwords') && !env.P7_DEMO_PASSWORD) {
    throw new Error('Password rotation requires a privately entered P7_DEMO_PASSWORD');
  }
}

async function main(argv = process.argv.slice(2)) {
  checkInvocation(argv, process.env);
  process.env.NODE_ENV = 'development';
  // Local setup cannot send external mail or push, even in an inherited shell.
  for (const name of ['BREVO_API_KEY', 'ONESIGNAL_APP_ID', 'ONESIGNAL_REST_API_KEY',
    'ONESIGNAL_IDENTITY_SECRET', 'GOOGLE_CLIENT_ID']) delete process.env[name];
  const mongoose = require('mongoose');
  const bcrypt = require('bcryptjs');
  const User = require('../models/User');
  const CreditTransaction = require('../models/CreditTransaction');
  const auth = require('../controllers/authController');
  const { createVerificationToken } = require('../utils/verificationTokens');
  const { getEffectiveCreditRules } = require('../services/creditRuleService');
  const { policyVersion } = require('../config/policy');
  const { validateBody, schemas } = require('../middleware/validation');
  const target = ['mongodb:', '', '127.0.0.1:27027', 'acadova?replicaSet=acadovaP7'].join('/');
  const result = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } });
  const invoke = async (controller, actor, body, schema, id) => {
    const req = { user: { id: String(actor._id), role: actor.role, credits: actor.credits },
      body, params: id ? { id: String(id) } : {}, method: 'POST', ip: '127.0.0.1' };
    const res = result(); let valid = false;
    validateBody(schema)(req, res, () => { valid = true; });
    if (!valid) throw new Error('Fixture input validation failed');
    await controller(req, res);
    if (!res.body?.success) throw new Error('Normal local fixture action failed');
    return res.body.data;
  };
  try {
    await mongoose.connect(target, { serverSelectionTimeoutMS: 5000 });
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (hello.setName !== 'acadovaP7' || !hello.isWritablePrimary) {
      throw new Error('Isolated P7 replica set is required');
    }
    await Promise.all([User.init(), CreditTransaction.init()]);
    const seed = await User.findOne({ email: 'p7-learner@example.test' });
    if (!seed || seed.role !== 'student' || !/^\$2[aby]\$10\$/.test(seed.password)) {
      throw new Error('First register p7-learner@example.test through the local registration UI');
    }
    const rules = await getEffectiveCreditRules();
    const definitions = [
      { email: 'p7-learner@example.test', name: 'P7 Student A', role: 'student' },
      { email: 'p7-tutor@example.test', name: 'P7 Student B', role: 'student', grant: true,
        skillsToTeach: ['P7 JavaScript'], skillsToLearn: ['Mathematics'] },
      { email: 'p7-moderator@example.test', name: 'P7 Moderator', role: 'moderator' },
      { email: 'p7-admin@example.test', name: 'P7 Admin', role: 'admin' },
      { email: 'p7-unrelated@example.test', name: 'P7 Student C', role: 'student' },
    ];
    let rotatedPassword;
    if (argv.includes('--rotate-passwords')) {
      let valid = false;
      const req = { body: { token: randomBytes(32).toString('hex'), password: process.env.P7_DEMO_PASSWORD } };
      validateBody(schemas.resetPassword)(req, result(), () => { valid = true; });
      if (!valid) throw new Error('Demo password must meet normal registration requirements');
      rotatedPassword = await bcrypt.hash(req.body.password, 10);
      delete process.env.P7_DEMO_PASSWORD;
    }
    const actors = [];
    for (const { grant, ...definition } of definitions) {
      let user = await User.findOne({ email: definition.email });
      if (user && user.role !== definition.role) throw new Error('Existing fixture role mismatch');
      if (!user) user = await User.create({ ...definition, password: seed.password, credits: 0,
        emailVerified: false, openingGrantEligible: grant === true,
        openingGrantAmount: grant ? rules.startingCreditGrant : undefined,
        policyAcceptedAt: new Date(), policyVersion });
      if (!user.emailVerified) {
        const verification = createVerificationToken();
        await User.updateOne({ _id: user._id, emailVerified: false }, { $set: {
          emailVerificationTokenHash: verification.hash, emailVerificationExpires: verification.expires } });
        await invoke(auth.verifyEmail, user, { token: verification.token }, schemas.verifyEmail);
      }
      if (rotatedPassword) await User.updateOne({ _id: user._id }, {
        $set: { password: rotatedPassword, authVersion: randomBytes(32).toString('hex') },
        $unset: { passwordResetTokenHash: 1, passwordResetExpires: 1 } });
      actors.push(await User.findById(user._id));
    }
    if (argv.includes('--demo')) await prepareDemo({ actors, invoke, schemas });
    console.log(JSON.stringify({ actors: actors.map((actor) => ({ name: actor.name,
      email: actor.email, role: actor.role, credits: actor.credits })), prepared: true }));
  } finally {
    delete process.env.P7_DEMO_PASSWORD;
    await mongoose.disconnect();
  }
}

async function prepareDemo({ actors: [learner, tutor, moderator], invoke, schemas }) {
  const Topic = require('../models/LearningTopic');
  const Resource = require('../models/LearningResource');
  const Module = require('../models/LearningModule');
  const Assessment = require('../models/Assessment');
  const Session = require('../models/Session');
  const learning = require('../controllers/learningController');
  const assessment = require('../controllers/assessmentController');
  const sessions = require('../controllers/sessionController');
  const Notification = require('../models/Notification');
  await Promise.all([Topic.init(), Resource.init(), Module.init(), Assessment.init(), Session.init(), Notification.init()]);
  let topic = await Topic.findOne({ slug: 'p7-javascript' });
  if (!topic) {
    const created = await invoke(learning.createTopic, moderator, { name: 'P7 JavaScript',
      description: 'Local defense examples for learning, assessments and credit unlocks.' }, schemas.learningTopic);
    topic = await Topic.findById(created.id);
  }
  if (topic.status === 'draft') await invoke(learning.publishTopic, moderator, {}, {}, topic._id);
  if (!['draft', 'published'].includes(topic.status)) throw new Error('Existing fixture topic was archived; preserve it');
  const resource = async (title, body, cost, publish = true, actor = moderator) => {
    let row = await Resource.findOne({ topic: topic._id, title });
    if (!row) {
      const created = await invoke(actor.role === 'student' ? learning.submitResource : learning.createStaffResource,
        actor, { topic: String(topic._id), title, description: 'Synthetic P7 teaching material.', ...body }, schemas.learningResource);
      row = await Resource.findById(created.id);
    }
    if (publish && row.reviewStatus === 'submitted') await invoke(learning.publishResource, moderator,
      { creditCost: cost }, schemas.learningReview, row._id);
    return row;
  };
  const first = await resource('P7 Functions', { resourceType: 'text',
    textContent: 'A function is a reusable block. Example: function double(n) { return n * 2; }. Calling double(3) returns 6.' }, 0);
  const second = await resource('P7 JavaScript Reference', { resourceType: 'url',
    externalUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions' }, 0);
  await resource('P7 Paid Practice', { resourceType: 'text', textContent: 'Practice: write a function that returns n + 1.' }, 5);
  await resource('P7 Submission to Review', { resourceType: 'text', textContent: 'Student explanation awaiting an actionable moderation decision.' }, 0, false, learner);
  let quiz = await Assessment.findOne({ learningTopic: topic._id, title: 'P7 Functions Check' });
  if (!quiz) {
    const created = await invoke(assessment.createAssessment, moderator, { title: 'P7 Functions Check',
      topic: topic.name, learningTopic: String(topic._id), passingScore: 100, questions: [
        { prompt: 'What is a function?', options: ['A reusable block', 'A browser window'], correctIndex: 0 },
        { prompt: 'What does double(3) return?', options: ['6', '3'], correctIndex: 0 },
        { prompt: 'Which word returns a result?', options: ['break', 'return'], correctIndex: 1 },
      ] }, schemas.assessmentCreate);
    quiz = await Assessment.findById(created.id);
  }
  if (quiz.status === 'draft') await invoke(assessment.publishAssessment, moderator, {}, {}, quiz._id);
  for (const [title, cost] of [['P7 Functions Path', 0], ['P7 Paid Module', 10]]) {
    let row = await Module.findOne({ topic: topic._id, title });
    if (!row) {
      const created = await invoke(learning.createModule, moderator, { topic: String(topic._id), title,
        description: 'Ordered local demo with a qualifying assessment.', resources: [String(first._id), String(second._id)],
        assessment: String(quiz._id) }, schemas.learningModule);
      row = await Module.findById(created.id);
    }
    if (row.status === 'draft') await invoke(learning.publishModule, moderator, { creditCost: cost }, schemas.learningModulePublish, row._id);
  }
  for (const [subject, dispute] of [['P7 JavaScript defense tutoring', false], ['P7 JavaScript moderation case', true]]) {
    let row = await Session.findOne({ learner: learner._id, tutor: tutor._id, subject });
    if (!row) {
      const created = await invoke(sessions.createSession, learner, { tutorId: String(tutor._id), subject,
        scheduledAt: new Date(Date.now() + 5 * 60_000).toISOString(), meetingMethod: 'online',
        requestMessage: 'Synthetic local P7 demo. Help me understand functions.' }, schemas.session);
      row = await Session.findById(created._id);
      if (dispute) {
        await invoke(sessions.updateSessionStatus, tutor, { status: 'scheduled' }, schemas.sessionStatus, row._id);
        await invoke(sessions.updateCoordination, tutor, { meetingLink: 'https://meet.google.com/p7-local-demo' }, schemas.coordination, row._id);
        await invoke(sessions.checkIn, learner, {}, {}, row._id);
        await invoke(sessions.checkIn, tutor, {}, {}, row._id);
        await invoke(sessions.finishSession, tutor, {}, {}, row._id);
        await invoke(sessions.disputeSession, learner, { reason: 'P7 local test conflict: please review the demonstrated session evidence.' }, schemas.dispute, row._id);
      }
    }
  }
  console.log('Local demo learning, pending tutoring and disputed session are ready; no settlement or assessment reward was performed.');
}

if (require.main === module) main().catch(() => {
  console.error('P7 local preparation failed; no credentials or connection details disclosed.'); process.exitCode = 1;
});
module.exports = { checkInvocation, main };
