const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const LearningTopic = require('../models/LearningTopic');
const LearningResource = require('../models/LearningResource');
const LearningModule = require('../models/LearningModule');
const Assessment = require('../models/Assessment');
const learning = require('../controllers/learningController');
const assessment = require('../controllers/assessmentController');
const { validateBody, schemas } = require('../middleware/validation');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const actor = { id: '507f1f77bcf86cd799439011', role: 'moderator' };
const topicId = '507f1f77bcf86cd799439012';
const resourceId = '507f1f77bcf86cd799439013';
const moduleId = '507f1f77bcf86cd799439014';
const assessmentId = '507f1f77bcf86cd799439015';
const res = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; } });

test('staff may create and edit only unpublished learning drafts with audit evidence', async (t) => {
  const originals = { start: mongoose.startSession, audit: AuditLog.create,
    topicUpdate: LearningTopic.findOneAndUpdate, topicExists: LearningTopic.exists,
    topicOne: LearningTopic.findOne, resourceCreate: LearningResource.create,
    resourceUpdate: LearningResource.findOneAndUpdate, resourceFind: LearningResource.find,
    moduleUpdate: LearningModule.findOneAndUpdate,
    assessmentUpdate: Assessment.findOneAndUpdate };
  t.after(() => {
    mongoose.startSession = originals.start; AuditLog.create = originals.audit;
    LearningTopic.findOneAndUpdate = originals.topicUpdate;
    LearningTopic.exists = originals.topicExists; LearningTopic.findOne = originals.topicOne;
    LearningResource.create = originals.resourceCreate;
    LearningResource.findOneAndUpdate = originals.resourceUpdate;
    LearningResource.find = originals.resourceFind;
    LearningModule.findOneAndUpdate = originals.moduleUpdate;
    Assessment.findOneAndUpdate = originals.assessmentUpdate;
  });
  mongoose.startSession = async () => ({ withTransaction: async (operation) => operation(),
    endSession: async () => {} });
  const audits = [];
  AuditLog.create = async ([event]) => { audits.push(event); return [event]; };
  let topicFilter;
  LearningTopic.findOneAndUpdate = async (filter, update) => {
    topicFilter = filter;
    return { _id: topicId, ...update.$set, status: 'draft' };
  };
  const topicResult = res();
  await learning.updateTopic({ user: actor, params: { id: topicId },
    body: { name: 'Python Basics', description: 'Start here' } }, topicResult);
  assert.equal(topicResult.statusCode, 200);
  assert.equal(topicResult.body.data.slug, 'python-basics');
  assert.equal(topicFilter.status, 'draft');
  assert.equal(audits.at(-1).action, 'learning.topic_updated');
  LearningTopic.exists = async () => true;
  LearningResource.create = async ([body]) => [{ _id: resourceId, ...body }];
  const resourceBody = { topic: topicId, title: 'Introduction', description: 'Read first',
    resourceType: 'text', textContent: 'Welcome to Python.' };
  const created = res();
  await learning.createStaffResource({ user: actor, body: resourceBody }, created);
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.data.reviewStatus, 'submitted');
  assert.equal(created.body.data.creditCost, 0);
  assert.equal(audits.at(-1).action, 'learning.resource_created');
  let resourceFilter;
  LearningResource.findOneAndUpdate = async (filter, update) => {
    resourceFilter = filter;
    return { _id: resourceId, ...resourceBody, ...update.$set,
      submittedBy: actor.id, reviewStatus: 'submitted', creditCost: 0 };
  };
  const edited = res();
  await learning.updateStaffResource({ user: actor, params: { id: resourceId },
    body: { ...resourceBody, title: 'Introduction updated' } }, edited);
  assert.equal(edited.statusCode, 200);
  assert.equal(resourceFilter.reviewStatus, 'submitted');
  assert.equal(audits.at(-1).action, 'learning.resource_updated');

  LearningTopic.findOne = () => ({ lean: async () => ({ _id: topicId, name: 'Python Basics' }) });
  LearningResource.find = () => ({ select: () => ({ lean: async () => [{ _id: resourceId }] }) });
  let moduleFilter;
  LearningModule.findOneAndUpdate = async (filter, update) => {
    moduleFilter = filter;
    return { _id: moduleId, ...update.$set, status: 'draft', creditCost: 0 };
  };
  const moduleResult = res();
  await learning.updateModule({ user: actor, params: { id: moduleId },
    body: { topic: topicId, title: 'Python module', description: 'A module',
      resources: [resourceId] } }, moduleResult);
  assert.equal(moduleResult.statusCode, 200);
  assert.equal(moduleFilter.status, 'draft');
  assert.equal(audits.at(-1).action, 'learning.module_updated');

  let assessmentFilter;
  Assessment.findOneAndUpdate = async (filter, update) => {
    assessmentFilter = filter; return { _id: assessmentId, ...update.$set };
  };
  const assessmentResult = res();
  await assessment.updateAssessment({ user: actor, params: { id: assessmentId },
    body: { title: 'Python quiz', topic: 'Python', passingScore: 70,
      questions: [0, 1, 2].map((i) => ({
        prompt: 'Question ' + i, options: ['A', 'B'], correctIndex: 1,
      })) } }, assessmentResult);
  assert.equal(assessmentResult.statusCode, 200);
  assert.equal(assessmentFilter.status, 'draft');
  assert.equal(audits.at(-1).action, 'learning.assessment_updated');
  assert.equal(audits.length, 5);
  assert.ok(audits.every((event) => !JSON.stringify(event.metadata).includes('Welcome to Python')));
});

test('learning authoring validation rejects protected fields and invalid assessment structure', () => {
  const request = { body: { topic: topicId, title: 'Lesson', description: 'A lesson',
    resourceType: 'text', textContent: 'Body', creditCost: 500 } };
  const denied = res();
  validateBody(schemas.learningResource)(request, denied, () => assert.fail('protected price accepted'));
  assert.equal(denied.statusCode, 400);
  const invalid = res();
  validateBody(schemas.assessmentCreate)({ body: { title: 'Quiz', topic: 'Python',
    passingScore: 70, questions: [{ prompt: 'Only one?', options: ['A', 'B'], correctIndex: 0 }] } },
  invalid, () => assert.fail('invalid question count accepted'));
  assert.equal(invalid.statusCode, 400);
});

test('Student cannot access new staff learning write routes', async (t) => {
  const originalFind = User.findById;
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'learning-staff-test-secret';
  User.findById = () => ({ select: () => ({ lean: async () => ({
    _id: actor.id, role: 'student', name: 'Student', email: 'student@example.test',
    credits: 100, emailVerified: true, suspendedAt: null,
  }) }) });
  const app = express();
  app.use(express.json());
  app.use('/api/moderator', require('../routes/moderatorRoutes'));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  t.after(async () => {
    User.findById = originalFind;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    await new Promise((resolve) => server.close(resolve));
  });
  const base = 'http://127.0.0.1:' + server.address().port + '/api/moderator';
  const token = jwt.sign({ id: actor.id, role: 'admin' }, process.env.JWT_SECRET);
  for (const [method, path] of [
    ['POST', '/learning/resources'],
    ['PATCH', '/learning/topics/' + topicId],
    ['PATCH', '/learning/resources/' + resourceId],
    ['PATCH', '/learning/modules/' + moduleId],
    ['PATCH', '/assessments/' + assessmentId],
  ]) {
    const response = await fetch(base + path, { method,
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: '{}' });
    assert.equal(response.status, 403);
  }
});
