// Synthetic database on the existing dedicated loopback test replica set only.
// Opt in: ACADOVA_LEARNING_WORKFLOW_DB_TESTS=1 node --test tests/learningWorkflow.integration.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const LearningTopic = require('../models/LearningTopic');
const LearningResource = require('../models/LearningResource');
const LearningModule = require('../models/LearningModule');
const Assessment = require('../models/Assessment');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const LessonCompletion = require('../models/LessonCompletion');
const LearningUnlock = require('../models/LearningUnlock');
const CreditTransaction = require('../models/CreditTransaction');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const { validationErrorHandler } = require('../middleware/validation');

test('official Learning curriculum from staff authoring to once-only student reward', {
  skip: process.env.ACADOVA_LEARNING_WORKFLOW_DB_TESTS !== '1',
}, async (t) => {
  assert.notEqual(process.env.NODE_ENV, 'production');
  const database = `acadova_learning_workflow_${process.pid}`;
  const oldSecret = process.env.JWT_SECRET;
  const originalFetch = global.fetch;
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState) {
      assert.equal(mongoose.connection.db.databaseName, database);
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
    global.fetch = originalFetch;
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  });
  await mongoose.connect(`mongodb://127.0.0.1:27029/${database}?replicaSet=acadovaPhase1`, { serverSelectionTimeoutMS: 10000 });
  assert.equal((await mongoose.connection.db.admin().command({ hello: 1 })).setName, 'acadovaPhase1');
  process.env.JWT_SECRET = 'learning-workflow-loopback-test';
  global.fetch = async () => assert.fail('External providers are forbidden');
  await Promise.all([User, LearningTopic, LearningResource, LearningModule, Assessment,
    AssessmentAttempt, LessonCompletion, LearningUnlock, CreditTransaction, AuditLog, Notification].map((model) => model.init()));
  const [student, moderator, admin] = await User.create(['student', 'moderator', 'admin'].map((role) => ({
    name: `Learning ${role}`, email: `workflow-${role}@example.test`, password: 'test-password',
    role, emailVerified: true, credits: 100,
  })));
  const other = await User.create({ name: 'Other Student', email: 'other-progress@example.test', password: 'test-password', role: 'student', emailVerified: true, credits: 100 });
  const app = express(); app.use(express.json());
  app.use('/api/learning', require('../routes/learningRoutes'));
  app.use('/api/moderator', require('../routes/moderatorRoutes'));
  app.use('/api/assessments', require('../routes/assessmentRoutes'));
  app.use(validationErrorHandler);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const call = async (path, actor = student, method = 'GET', body) => {
    const response = await originalFetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
      method, headers: { authorization: `Bearer ${jwt.sign({ id: String(actor._id) }, process.env.JWT_SECRET)}`,
        'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };
  const write = async (path, actor, body, method = 'POST', expected = 200) => {
    const response = await call(path, actor, method, body);
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(response.body)}`);
    return response.body.data;
  };
  const topic = await write('/moderator/learning/topics', moderator,
    { name: 'Workflow Python', description: 'A guided introduction to Python.' }, 'POST', 201);
  await t.test('draft topic is private; Student cannot author official content; Admin can oversee', async () => {
    assert.equal((await call(`/learning/topics/${topic.id}`)).status, 404);
    for (const path of ['/moderator/learning/topics', '/moderator/learning/modules', '/moderator/assessments']) {
      assert.equal((await call(path, student, 'POST', {})).status, 403);
    }
    assert.equal((await call('/moderator/learning/topics', admin)).body.data[0].id, topic.id);
    await write(`/moderator/learning/topics/${topic.id}/publish`, moderator, {});
  });
  const lessonBody = { topic: topic.id, title: 'Python variables', description: 'Read about variables.',
    resourceType: 'text', textContent: 'Variables refer to values.' };
  const first = await write('/moderator/learning/resources', moderator, lessonBody, 'POST', 201);
  const contributed = await write('/learning/resources/submit', student,
    { ...lessonBody, title: 'Python practice', textContent: 'Try assigning a value to a variable.' }, 'POST', 201);
  await t.test('Student resource waits for approval and becomes an attachable published lesson', async () => {
    assert.equal(contributed.reviewStatus, 'submitted');
    assert.equal((await call(`/learning/resources/${contributed.id}`)).status, 404);
    const pending = (await call('/moderator/learning/resources', moderator)).body.data;
    assert.ok(pending.some((resource) => resource.id === contributed.id && resource.reviewStatus === 'submitted'));
    await write(`/moderator/learning/resources/${first.id}/publish`, moderator, { creditCost: 0 });
    await write(`/moderator/learning/resources/${contributed.id}/publish`, moderator, { creditCost: 0 });
    assert.equal((await call(`/learning/resources/${contributed.id}`)).status, 200);
    assert.equal(await CreditTransaction.countDocuments(), 0);
  });
  await t.test('official drafts remain separate, incomplete content cannot publish, origins cannot be forged', async () => {
    assert.equal(first.reviewStatus, 'draft'); assert.equal(first.creationOrigin, 'staff');
    assert.equal(first.authorRole, 'moderator');
    const unfinished = await write('/moderator/learning/resources', admin,
      { ...lessonBody, textContent: undefined, title: 'Unfinished official lesson' }, 'POST', 201);
    assert.equal(unfinished.reviewStatus, 'draft'); assert.equal(unfinished.authorRole, 'admin');
    assert.equal((await call(`/moderator/learning/resources/${unfinished.id}/publish`, moderator, 'POST', { creditCost: 0 })).status, 400);
    assert.equal((await call(`/moderator/learning/resources/${first.id}/publish`, student, 'POST', { creditCost: 0 })).status, 403);
    assert.equal((await call('/learning/resources/submit', student, 'POST', { ...lessonBody, creationOrigin: 'staff' })).status, 400);
    assert.equal((await call(`/moderator/learning/resources/${first.id}/publish`, moderator, 'POST', { creditCost: 0 })).status, 404);
    const racing = await write('/moderator/learning/resources', moderator, { ...lessonBody, title: 'Concurrent publication' }, 'POST', 201);
    const published = await Promise.all([call(`/moderator/learning/resources/${racing.id}/publish`, moderator, 'POST', { creditCost: 0 }), call(`/moderator/learning/resources/${racing.id}/publish`, admin, 'POST', { creditCost: 0 })]);
    assert.deepEqual(published.map((row) => row.status).sort(), [200, 404]);
    assert.equal(await AuditLog.countDocuments({ targetId: racing.id, action: 'learning.resource_approved' }), 1);
    const unauthorized = await originalFetch(`http://127.0.0.1:${server.address().port}/api/learning/topics/${topic.id}/progress`);
    assert.equal(unauthorized.status, 401);
    const historical = await LearningResource.create(['Introduction to Computer Networks', 'IP Addressing Basics'].map((title) => ({ ...lessonBody, title, submittedBy: moderator._id, reviewStatus: 'submitted' })));
    const snapshots = historical.map((row) => row.toObject());
    const workspace = (await call(`/moderator/learning/topics/${topic.id}`, moderator)).body.data;
    assert.equal(workspace.resources.find((row) => row.id === unfinished.id).reviewStatus, 'draft');
    assert.ok(workspace.resources.filter((row) => row.reviewStatus === 'submitted').every((row) => row.id !== unfinished.id));
    for (let i = 0; i < historical.length; i++) assert.deepEqual((await LearningResource.findById(historical[i]._id)).toObject(), snapshots[i]);
    const audit = await AuditLog.findOne({ targetId: first.id, action: 'learning.resource_approved' }).lean();
    assert.equal(audit.metadata.previousStatus, 'draft'); assert.equal(audit.actorRole, 'moderator');
    assert.equal((await call(`/moderator/learning/topics/${topic.id}`, student)).status, 403);
  });
  const moduleBody = { topic: topic.id, title: 'Python foundations', description: 'Read, practice, then assess.',
    resources: [contributed.id, first.id] };
  const module = await write('/moderator/learning/modules', moderator, moduleBody, 'POST', 201);
  const assessment = await write('/moderator/assessments', moderator, {
    title: 'Python foundations assessment', topic: 'Workflow Python', learningTopic: topic.id, passingScore: 70,
    questions: [0, 1, 0].map((correctIndex, index) => ({ prompt: `Choose the Python answer ${index + 1}?`,
      options: ['First answer', 'Second answer'], correctIndex })),
  }, 'POST', 201);
  await t.test('draft module cannot attach a draft assessment; published governed identity survives a name change', async () => {
    assert.equal((await call(`/learning/modules/${module.id}`)).status, 404);
    assert.equal((await call(`/moderator/learning/modules/${module.id}`, moderator, 'PATCH',
      { ...moduleBody, assessment: assessment.id })).status, 400);
    await write(`/moderator/assessments/${assessment.id}/publish`, moderator, {});
    // Synthetic historical-name compatibility; never application or production data.
    await LearningTopic.updateOne({ _id: topic.id }, { $set: { name: 'Workflow Python Foundations' } });
    const staffList = (await call('/moderator/assessments', moderator)).body.data;
    assert.equal(staffList[0].learningTopic, topic.id);
    assert.equal(staffList[0].topic, 'Workflow Python');
    assert.equal(JSON.stringify(staffList).includes('correctIndex'), false);
    await write(`/moderator/learning/modules/${module.id}`, moderator,
      { ...moduleBody, resources: [first.id, contributed.id], assessment: assessment.id }, 'PATCH');
    await write(`/moderator/learning/modules/${module.id}/publish`, moderator, { creditCost: 0 });
  });
  await t.test('Student sees the saved curriculum order and assessment; studying earns no credits', async () => {
    const detail = (await call(`/learning/modules/${module.id}`)).body.data;
    assert.deepEqual(detail.resources.map((resource) => resource.id), [first.id, contributed.id]);
    assert.equal(detail.assessment, assessment.id);
    assert.equal(detail.resources[0].textContent, lessonBody.textContent);
    const detailTopic = (await call(`/learning/topics/${topic.id}`)).body.data;
    assert.equal(detailTopic.modules[0].id, module.id);
    assert.equal(detailTopic.assessments[0].id, assessment.id);
    assert.equal(JSON.stringify((await call(`/assessments/${assessment.id}`)).body).includes('correctIndex'), false);
    assert.equal(await CreditTransaction.countDocuments(), 0);
    assert.equal((await User.findById(student._id)).credits, 100);
  });
  const completionPath = (moduleId, resourceId) => `/learning/modules/${moduleId}/resources/${resourceId}/complete`;
  const progressPath = `/learning/modules/${module.id}/progress`;
  const progress = async (actor = student) => (await call(progressPath, actor)).body.data;
  await t.test('completion is explicit, own-user, concurrent-idempotent and never earns credits', async () => {
    assert.equal((await progress()).percent, 0); assert.equal(await LessonCompletion.countDocuments(), 0);
    assert.equal((await call(completionPath(module.id, first.id), moderator, 'POST', {})).status, 403);
    assert.equal((await call(completionPath(module.id, first.id), student, 'POST', { student: String(other._id), percent: 100 })).status, 400);
    const results = await Promise.all(Array.from({ length: 6 }, () => write(completionPath(module.id, first.id), student, {})));
    assert.ok(results.every((row) => row.completedAt === results[0].completedAt));
    assert.equal(await LessonCompletion.countDocuments(), 1);
    assert.equal((await progress()).percent, 33); assert.equal((await progress(other)).percent, 0);
    assert.equal(await CreditTransaction.countDocuments(), 0); assert.equal((await User.findById(student._id)).credits, 100);
    await write(completionPath(module.id, contributed.id), student, {});
    assert.equal((await progress()).percent, 67);
    const workspace = (await call(`/moderator/learning/topics/${topic.id}`, moderator)).body.data;
    assert.equal(workspace.modules[0].assessment, assessment.id);
    assert.ok(workspace.assessments.some((row) => row.id === assessment.id));
    assert.equal(JSON.stringify(workspace.assessments).includes('correctIndex'), false);
    const foreign = await write('/moderator/learning/topics', admin, { name: 'Other governed topic', description: 'Unrelated curriculum' }, 'POST', 201);
    assert.deepEqual((await call(`/moderator/learning/topics/${foreign.id}`, moderator)).body.data.resources, []);
  });
  await t.test('paid module and resource access, draft/archived content and unrelated lessons are enforced', async () => {
    const paid = await write('/moderator/learning/resources', moderator, { ...lessonBody, title: 'Paid lesson' }, 'POST', 201);
    await write(`/moderator/learning/resources/${paid.id}/publish`, moderator, { creditCost: 25 });
    const locked = await write('/moderator/learning/modules', moderator, { ...moduleBody, title: 'Paid module', resources: [paid.id] }, 'POST', 201);
    assert.equal((await call(completionPath(locked.id, paid.id), student, 'POST', {})).status, 404);
    await write(`/moderator/learning/modules/${locked.id}/publish`, moderator, { creditCost: 30 });
    assert.equal((await call(completionPath(locked.id, paid.id), student, 'POST', {})).status, 403);
    await write(`/learning/resources/${paid.id}/unlock`, student, {});
    assert.equal((await call(completionPath(locked.id, paid.id), student, 'POST', {})).status, 403);
    await write(`/learning/modules/${locked.id}/unlock`, student, {});
    await write(completionPath(locked.id, paid.id), student, {});
    assert.equal((await call(completionPath(module.id, paid.id), student, 'POST', {})).status, 404);
    const unknownPrice = await LearningModule.create({ ...moduleBody, title: 'Legacy missing price', status: 'published', createdBy: moderator._id });
    await LearningModule.collection.updateOne({ _id: unknownPrice._id }, { $unset: { creditCost: 1 } });
    assert.equal((await call(completionPath(String(unknownPrice._id), first.id), student, 'POST', {})).status, 403);
    await LearningModule.updateOne({ _id: unknownPrice._id }, { $set: { status: 'archived' } });
    const free = await write('/moderator/learning/modules', moderator, { ...moduleBody, title: 'Free module with paid lesson', resources: [paid.id] }, 'POST', 201);
    await write(`/moderator/learning/modules/${free.id}/publish`, moderator, { creditCost: 0 });
    assert.equal((await call(completionPath(free.id, paid.id), other, 'POST', {})).status, 403);
    await write(completionPath(free.id, paid.id), student, {});
    assert.equal((await call(`/learning/modules/${free.id}/progress`)).body.data.percent, 100);
    // Shared lesson completion does not complete a requirement in another module.
    const duplicate = await write('/moderator/learning/modules', moderator, { ...moduleBody, title: 'Separate module requirement', resources: [first.id] }, 'POST', 201);
    await write(`/moderator/learning/modules/${duplicate.id}/publish`, moderator, { creditCost: 0 });
    assert.equal((await call(`/learning/modules/${duplicate.id}/progress`)).body.data.percent, 0);
    await write(`/moderator/learning/resources/${paid.id}/archive`, moderator, {});
    assert.equal((await call(completionPath(locked.id, paid.id), student, 'POST', {})).status, 404);
    assert.equal((await call(`/learning/modules/${locked.id}/progress`)).body.data.percent, null);
    await write(`/moderator/learning/modules/${duplicate.id}/archive`, moderator, {});
    await write(`/moderator/learning/modules/${locked.id}/archive`, moderator, {});
    await write(`/moderator/learning/modules/${free.id}/archive`, moderator, {});
  });
  await t.test('failed attempt retains eligibility; concurrent first passes and repeat practice reward once', async () => {
    const path = `/assessments/${assessment.id}/submit`;
    const failed = await write(path, student, { answers: [1, 0, 1] });
    assert.equal(failed.passed, false); assert.equal(failed.rewardEligible, true);
    assert.equal((await progress()).percent, 67);
    const practice = await write(`/assessments/${assessment.id}/practice`, student, { answers: [0, 1, 0] });
    assert.equal(practice.passed, true); assert.equal((await progress()).percent, 67);
    const results = await Promise.all([write(path, student, { answers: [0, 1, 0] }), write(path, student, { answers: [0, 1, 0] })]);
    assert.equal(results.filter((result) => result.rewardIssued).length, 1);
    assert.equal(results.reduce((total, result) => total + result.creditsAwarded, 0), 20);
    const repeat = await write(path, student, { answers: [0, 1, 0] });
    assert.equal(repeat.mode, 'practice'); assert.equal(repeat.creditsAwarded, 0);
    assert.equal(await CreditTransaction.countDocuments({ type: 'assessment_reward', assessment: assessment.id, toUser: student._id }), 1);
    assert.equal((await User.findById(student._id)).credits, 65);
    assert.equal((await progress()).percent, 100);
    const topicProgress = (await call(`/learning/topics/${topic.id}/progress`)).body.data;
    assert.equal(topicProgress.percent, 100); assert.equal(topicProgress.completedModules, 1);
  });
  await t.test('assessment integrity: cross-Topic rejection, privacy, standalone access and shared-pass policy', async () => {
    const integrityStaff = await User.create({ name: 'Integrity Moderator', email: 'integrity-staff@example.test', password: 'test-password', role: 'moderator', emailVerified: true, credits: 0 });
    const foreignTopic = await write('/moderator/learning/topics', integrityStaff, { name: 'Foreign Curriculum', description: 'A separate governed curriculum.' }, 'POST', 201);
    await write(`/moderator/learning/topics/${foreignTopic.id}/publish`, integrityStaff, {});
    const foreign = await write('/moderator/assessments', integrityStaff, { title: 'Unrelated assessment', topic: 'Foreign Curriculum', learningTopic: foreignTopic.id,
      passingScore: 70, questions: [1,2,3].map((i) => ({ prompt: `Choose the correct foreign answer ${i}?`, options: ['Correct', 'Incorrect'], correctIndex: 0 })) }, 'POST', 201);
    assert.equal((await call(`/assessments/${foreign.id}`)).status, 404);
    assert.equal((await call(`/assessments/${foreign.id}/submit`, student, 'POST', { answers: [0,0,0] })).status, 404);
    await write(`/moderator/assessments/${foreign.id}/publish`, integrityStaff, {});
    // Equal legacy text cannot override a conflicting governed ID.
    await Assessment.updateOne({ _id: foreign.id }, { $set: { topic: 'Workflow Python Foundations' } });
    assert.equal((await call('/moderator/learning/modules', integrityStaff, 'POST', { ...moduleBody, assessment: foreign.id })).status, 400);
    const draft = await write('/moderator/learning/modules', integrityStaff, { ...moduleBody, title: 'Integrity draft' }, 'POST', 201);
    assert.equal((await call(`/moderator/learning/modules/${draft.id}`, integrityStaff, 'PATCH', { ...moduleBody, assessment: foreign.id })).status, 400);
    await LearningModule.updateOne({ _id: draft.id }, { $set: { assessment: foreign.id } });
    assert.equal((await call(`/moderator/learning/modules/${draft.id}/publish`, integrityStaff, 'POST', { creditCost: 0 })).status, 409);
    assert.equal((await call(`/assessments/${foreign.id}`, integrityStaff)).status, 403);
    assert.equal((await call(`/moderator/assessments/${foreign.id}`, student)).status, 403);
    assert.equal((await call(`/assessments/${foreign.id}?topic=${topic.id}`)).status, 400);
    assert.equal((await call(`/assessments/${foreign.id}/submit`, other, 'POST', { answers: [0,0,0], module: module.id })).status, 400);
    const publicDetail = (await call(`/assessments/${foreign.id}`, other)).body.data;
    assert.equal(publicDetail.learningTopic, foreignTopic.id);
    assert.equal(JSON.stringify(publicDetail).includes('correctIndex'), false);
    const list = (await call('/assessments', other)).body.data;
    assert.equal(list.find((row) => row.id === foreign.id).learningTopic, foreignTopic.id);
    assert.equal(JSON.stringify(list).includes('correctIndex'), false);
    // Standalone assessment is free; passing it has no effect on another Topic's requirements.
    const unrelatedPass = await write(`/assessments/${foreign.id}/submit`, other, { answers: [0,0,0] });
    assert.equal(unrelatedPass.passed, true); assert.equal((await progress(other)).percent, 0);
    const ownedResult = await AssessmentAttempt.findOne({ student: student._id, assessment: assessment.id });
    assert.equal((await call(`/assessments/attempts/${ownedResult._id}`, other)).status, 404);
    const shared = await write('/moderator/learning/modules', integrityStaff, { ...moduleBody, title: 'Shared assessment requirement', resources: [first.id], assessment: assessment.id }, 'POST', 201);
    await write(`/moderator/learning/modules/${shared.id}/publish`, integrityStaff, { creditCost: 0 });
    const sharedProgress = (await call(`/learning/modules/${shared.id}/progress`)).body.data;
    assert.equal(sharedProgress.percent, 50); assert.equal(sharedProgress.assessment.passed, true);
    assert.equal((await progress()).percent, 100);
    assert.equal(await CreditTransaction.countDocuments({ type: 'assessment_reward', assessment: assessment.id, toUser: student._id }), 1);
    const beforeRead = await CreditTransaction.countDocuments();
    await call(`/learning/topics/${topic.id}/progress`); await call(`/learning/modules/${shared.id}/progress`);
    assert.equal(await CreditTransaction.countDocuments(), beforeRead);
    await write(`/moderator/learning/modules/${shared.id}/archive`, integrityStaff, {});
    // Unsupported historical archived status is excluded by published-only APIs, without adding an archive feature.
    await Assessment.collection.updateOne({ _id: new mongoose.Types.ObjectId(foreign.id) }, { $set: { status: 'archived' } });
    assert.equal((await call(`/assessments/${foreign.id}`, other)).status, 404);
    assert.equal((await call(`/assessments/${foreign.id}/submit`, other, 'POST', { answers: [0,0,0] })).status, 404);
  });
  await t.test('current curriculum recalculates without deleting historical completions or rewarding reads', async () => {
    const count = await LessonCompletion.countDocuments(); const ledger = await CreditTransaction.countDocuments();
    await LearningModule.updateOne({ _id: module.id }, { $set: { resources: [contributed.id, first.id] } });
    assert.equal((await progress()).percent, 100);
    const added = await write('/moderator/learning/resources', admin, { ...lessonBody, title: 'New curriculum lesson' }, 'POST', 201);
    await write(`/moderator/learning/resources/${added.id}/publish`, admin, { creditCost: 0 });
    await LearningModule.updateOne({ _id: module.id }, { $push: { resources: added.id } });
    assert.equal((await progress()).percent, 75);
    await LearningModule.updateOne({ _id: module.id }, { $set: { resources: [added.id] }, $unset: { assessment: 1 } });
    assert.equal((await progress()).percent, 0);
    await LearningModule.updateOne({ _id: module.id }, { $set: { resources: [first.id], assessment: assessment.id } });
    assert.equal((await progress()).percent, 100);
    await AssessmentAttempt.create({ student: other._id, assessment: assessment.id, answers: [0,1,0], score: 100, passed: true, rewardIssued: false });
    assert.equal((await progress(other)).percent, 50); // Legacy official pass; no fabricated lesson completion.
    await Assessment.updateOne({ _id: assessment.id }, { $set: { learningTopic: new mongoose.Types.ObjectId() } });
    assert.equal((await progress(other)).percent, 0); // Governed ID takes precedence over matching topic text.
    await Assessment.updateOne({ _id: assessment.id }, { $set: { learningTopic: topic.id } });
    await LearningResource.updateOne({ _id: first.id }, { $set: { reviewStatus: 'archived' } });
    assert.equal((await progress()).totalRequirements, 1);
    await LearningModule.updateOne({ _id: module.id }, { $unset: { assessment: 1 } });
    assert.equal((await progress()).percent, null); assert.equal((await progress()).complete, false);
    await LearningModule.updateOne({ _id: module.id }, { $set: { status: 'archived' } });
    const empty = (await call(`/learning/topics/${topic.id}/progress`)).body.data;
    assert.equal(empty.percent, null); assert.equal(empty.publishedModules, 0);
    assert.equal(await LessonCompletion.countDocuments(), count); assert.equal(await CreditTransaction.countDocuments(), ledger);
    assert.equal((await call(completionPath(module.id, first.id), student, 'POST', {})).status, 404);
  });
  await t.test('missing production completion index fails closed with no progress write', async () => {
    const temp = await LearningModule.create({ ...moduleBody, status: 'published', createdBy: moderator._id });
    const before = process.env.NODE_ENV; const indexes = LessonCompletion.collection.indexes;
    const count = await LessonCompletion.countDocuments();
    try {
      process.env.NODE_ENV = 'production'; LessonCompletion.collection.indexes = async () => [{ name: 'uniq_student_module_lesson', unique: true, key: { student: 1, module: 1 } }];
      assert.equal((await call(completionPath(String(temp._id), contributed.id), other, 'POST', {})).status, 503);
      assert.equal(await LessonCompletion.countDocuments(), count);
    } finally { if (before === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = before; LessonCompletion.collection.indexes = indexes; }
  });

});
