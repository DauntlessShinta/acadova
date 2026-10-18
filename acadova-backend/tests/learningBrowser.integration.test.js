// Opt-in genuine Chrome + HTTP + MongoDB; never loads dotenv or accepts external database URIs.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { spawn } = require('node:child_process');
const { writeFile } = require('node:fs/promises');
const path = require('node:path');
const models = Object.fromEntries(['User', 'LearningTopic', 'LearningResource', 'LearningModule', 'Assessment',
  'AssessmentAttempt', 'LessonCompletion', 'LearningUnlock', 'CreditTransaction', 'AuditLog', 'Notification'].map((name) => [name, require('../models/' + name)]));
const { validationErrorHandler } = require('../middleware/validation');

test('live local Learning defense rehearsal in Chrome', { skip: process.env.ACADOVA_LEARNING_BROWSER_DB_TESTS !== '1' }, async (t) => {
  assert.notEqual(process.env.NODE_ENV, 'production');
  const evidenceDir = process.env.ACADOVA_LEARNING_BROWSER_EVIDENCE || '../docs/learning-progress-evidence';
  assert.ok(['../docs/learning-progress-evidence', '../docs/topic-ux-evidence'].includes(evidenceDir));
  const database = `acadova_learning_browser_${process.pid}`;
  const secret = process.env.JWT_SECRET; const nativeFetch = global.fetch; let server;
  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState) {
      assert.equal(mongoose.connection.db.databaseName, database); await mongoose.connection.dropDatabase(); await mongoose.disconnect();
    }
    global.fetch = nativeFetch;
    if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret;
  });
  await mongoose.connect(`mongodb://127.0.0.1:27029/${database}?replicaSet=acadovaPhase1`, { serverSelectionTimeoutMS: 5000 });
  assert.equal((await mongoose.connection.db.admin().command({ hello: 1 })).setName, 'acadovaPhase1');
  await Promise.all(Object.values(models).map((model) => model.init()));
  process.env.JWT_SECRET = 'learning-browser-synthetic-only';
  global.fetch = async () => assert.fail('External providers forbidden');
  const app = express();
  app.use(cors({ origin: (origin, callback) => callback(null, !origin || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) }));
  app.use(express.json());
  for (const [base, file] of [['learning', 'learningRoutes'], ['moderator', 'moderatorRoutes'], ['users', 'userRoutes'], ['assessments', 'assessmentRoutes'], ['notifications', 'notificationRoutes']]) app.use('/api/' + base, require('../routes/' + file));
  app.use(validationErrorHandler);
  server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  for (const width of [390, 1366]) await t.test(`${width}px authenticated end-to-end curriculum and progress`, async () => {
    const [moderator, student] = await models.User.create(['moderator', 'student'].map((role) => ({ name: `Live ${role} Fixture`, email: `live-${role}-${width}@example.test`, password: 'synthetic-only-password', role, emailVerified: true, credits: 100, onboardingFinishedAt: new Date() })));
    const topic = await models.LearningTopic.create({ name: `Live Learning ${width}`, slug: `live-${width}`, description: 'Synthetic curriculum for live local defense rehearsal.', status: 'published', createdBy: moderator._id });
    const assessment = await models.Assessment.create({ title: 'Live defense assessment', topic: topic.name, learningTopic: topic._id, status: 'published', passingScore: 70, createdBy: moderator._id,
      questions: [1,2,3].map((index) => ({ prompt: `Which value is correct for item ${index}?`, options: ['Correct answer', 'Incorrect answer'], correctIndex: 0 })) });
    const token = (actor) => jwt.sign({ id: String(actor._id) }, process.env.JWT_SECRET);
    const config = { url: `http://127.0.0.1:${server.address().port}/`, token: token(moderator), studentToken: token(student), topicId: String(topic._id), assessmentId: String(assessment._id) };
    let output = '';
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['tests/browser-demo.mjs', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'browser-learning-progress-live.jsx', String(width), `${evidenceDir}/live-${width}.png`, width === 390 ? '844' : '900'], {
        cwd: path.resolve('../acadova-frontend'), windowsHide: true,
        env: { ...process.env, ACADOVA_LOCAL_BROWSER_CONFIG: JSON.stringify(config), ACADOVA_SCREENSHOT_DIR: evidenceDir }, stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout.on('data', (data) => { output += data; }); child.stderr.on('data', (data) => { output += data; });
      child.once('error', reject); child.once('exit', resolve);
    });
    await writeFile(path.resolve(`${evidenceDir}/live-${width}.txt`), output);
    assert.equal(code, 0, output);
    assert.equal(await models.LessonCompletion.countDocuments({ student: student._id }), 1);
    assert.equal(await models.CreditTransaction.countDocuments({ toUser: student._id, type: 'assessment_reward' }), 1);
    assert.equal((await models.User.findById(student._id)).credits, 120);
    assert.equal(await models.AuditLog.countDocuments({ actor: moderator._id, action: 'learning.resource_created' }), 1);
    assert.equal(await models.AuditLog.countDocuments({ actor: moderator._id, action: 'learning.resource_approved' }), 1);
    console.log(output.trim());
  });
});
