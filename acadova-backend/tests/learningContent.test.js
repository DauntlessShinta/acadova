const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const LearningTopic = require('../models/LearningTopic');
const LearningResource = require('../models/LearningResource');
const LearningModule = require('../models/LearningModule');
const Assessment = require('../models/Assessment');
const CreditTransaction = require('../models/CreditTransaction');

const student = '507f1f77bcf86cd799439011';
const moderator = '507f1f77bcf86cd799439012';
const admin = '507f1f77bcf86cd799439013';
const topicId = '507f1f77bcf86cd799439014';
const otherTopicId = '507f1f77bcf86cd799439015';
const resourceId = '507f1f77bcf86cd799439016';
const moduleId = '507f1f77bcf86cd799439017';
const clone = (value) => value && JSON.parse(JSON.stringify(value));

test('learning schemas constrain price, URLs, ordering, and unique topic slug', async () => {
  const topic = new LearningTopic({ name: 'JavaScript', slug: 'javascript', description: 'Learn JS', createdBy: moderator });
  await topic.validate();
  assert.equal(LearningTopic.schema.indexes().some(([, options]) => options.name === 'uniq_learning_topic_slug'
    && options.unique), true);
  const text = { topic: topicId, title: 'Intro', description: 'Read this first', resourceType: 'text',
    textContent: 'A lesson', submittedBy: student };
  await new LearningResource(text).validate();
  await new LearningResource({ ...text, resourceType: 'url', textContent: undefined,
    externalUrl: 'https://example.org/lesson' }).validate();
  await assert.rejects(new LearningResource({ ...text, resourceType: 'url', textContent: undefined,
    externalUrl: 'javascript:alert(1)' }).validate());
  await assert.rejects(new LearningResource({ ...text, creditCost: -1 }).validate());
  await assert.rejects(new LearningResource({ ...text, creditCost: 1.5 }).validate());
  await new LearningModule({ topic: topicId, title: 'Basics', description: 'Start here',
    resources: [resourceId], createdBy: moderator }).validate();
  await assert.rejects(new LearningModule({ topic: topicId, title: 'Basics', description: 'Start here',
    resources: [], createdBy: moderator }).validate());
  await new Assessment({ title: 'Legacy assessment', topic: 'JavaScript', passingScore: 60,
    questions: [0, 1, 2].map((i) => ({ prompt: `Question ${i}`, options: ['A', 'B'], correctIndex: 0 })),
    createdBy: moderator }).validate();
});

test('learning routes enforce governance, safe previews, and no spending', async () => {
  const originals = {
    user: User.findById, topicFind: LearningTopic.find, topicOne: LearningTopic.findOne,
    topicExists: LearningTopic.exists, topicCreate: LearningTopic.create, topicUpdate: LearningTopic.findOneAndUpdate,
    resourceFind: LearningResource.find, resourceOne: LearningResource.findOne,
    resourceById: LearningResource.findById, resourceCreate: LearningResource.create,
    resourceUpdate: LearningResource.findOneAndUpdate,
    moduleFind: LearningModule.find, moduleOne: LearningModule.findOne,
    moduleCreate: LearningModule.create, moduleUpdate: LearningModule.findOneAndUpdate,
    assessmentFind: Assessment.find, assessmentExists: Assessment.exists,
    transactionCreate: CreditTransaction.create, secret: process.env.JWT_SECRET, env: process.env.NODE_ENV,
  };
  process.env.JWT_SECRET = 'learning-test-secret';
  process.env.NODE_ENV = 'test';
  const topics = [{ _id: topicId, name: 'JavaScript', slug: 'javascript', description: 'Learn JS', status: 'draft', createdBy: moderator },
    { _id: otherTopicId, name: 'Python', slug: 'python', description: 'Learn Python', status: 'published', createdBy: moderator }];
  const resources = [];
  const modules = [];
  let ledgerWrites = 0;
  const match = (row, filter = {}) => Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some((part) => match(row, part));
    if (expected && typeof expected === 'object' && '$in' in expected) return expected.$in.some((value) => String(row[key]) === String(value));
    if (expected && typeof expected === 'object' && '$exists' in expected) return (row[key] !== undefined) === expected.$exists;
    return String(row[key]) === String(expected);
  });
  const query = (rows) => ({ sort() { return this; }, limit() { return this; }, select() { return this; },
    lean: async () => clone(rows) });
  const find = (rows) => (filter) => query(rows.filter((row) => match(row, filter)));
  const one = (rows) => (filter) => ({ lean: async () => clone(rows.find((row) => match(row, filter)) || null) });
  const update = (rows) => async (filter, change) => {
    const row = rows.find((item) => match(item, filter));
    if (!row) return null;
    Object.assign(row, change.$set);
    return clone(row);
  };
  User.findById = (id) => ({ select: () => ({ lean: async () => ({ _id: id,
    role: id === moderator ? 'moderator' : id === admin ? 'admin' : 'student',
    emailVerified: true, credits: 100, name: 'Test', email: 'test@example.test' }) }) });
  LearningTopic.find = find(topics); LearningTopic.findOne = one(topics);
  LearningTopic.exists = async (filter) => topics.some((row) => match(row, filter));
  LearningTopic.create = async (body) => { const row = { _id: new mongoose.Types.ObjectId().toString(), ...body };
    topics.push(row); return clone(row); };
  LearningTopic.findOneAndUpdate = update(topics);
  LearningResource.find = find(resources); LearningResource.findOne = one(resources);
  LearningResource.findById = (id) => ({ lean: async () => clone(resources.find((row) => row._id === id) || null) });
  LearningResource.create = async (body) => { const row = { _id: resources.length ? new mongoose.Types.ObjectId().toString() : resourceId,
    ...body }; resources.push(row); return clone(row); };
  LearningResource.findOneAndUpdate = update(resources);
  LearningModule.find = find(modules); LearningModule.findOne = one(modules);
  LearningModule.create = async (body) => { const row = { _id: moduleId, ...body }; modules.push(row); return clone(row); };
  LearningModule.findOneAndUpdate = update(modules);
  Assessment.find = () => query([]); Assessment.exists = async () => true;
  CreditTransaction.create = async () => { ledgerWrites += 1; throw new Error('Unexpected ledger write'); };

  const app = express(); app.use(express.json());
  app.use('/api/learning', require('../routes/learningRoutes'));
  app.use('/api/moderator', require('../routes/moderatorRoutes'));
  const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (path, actor, method = 'GET', body) => {
    const response = await fetch(base + path, { method,
      headers: { authorization: `Bearer ${jwt.sign({ id: actor }, process.env.JWT_SECRET)}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  try {
    const topicBody = { name: 'JavaScript', description: 'Learn JS' };
    assert.equal((await call('/moderator/learning/topics', student, 'POST', topicBody)).status, 403);
    assert.equal((await call('/learning/topics', student)).body.data.length, 1);
    assert.equal((await call(`/learning/topics/${topicId}`, student)).status, 404);
    assert.equal((await call('/moderator/learning/topics', admin, 'POST', topicBody)).status, 409);
    assert.equal((await call('/moderator/learning/topics', moderator, 'POST',
      { name: 'New Topic', description: 'A useful subject' })).status, 201);
    assert.equal((await call(`/moderator/learning/topics/${topicId}/publish`, student, 'POST', {})).status, 403);
    assert.equal((await call(`/moderator/learning/topics/${topicId}/publish`, moderator, 'POST', {})).status, 200);
    assert.equal((await call('/learning/topics', student)).body.data.length, 2);

    const textBody = { topic: topicId, title: 'Intro text', description: 'A free introduction',
      resourceType: 'text', textContent: 'Protected lesson text' };
    assert.equal((await call('/learning/resources/submit', student, 'POST',
      { ...textBody, creditCost: 0 })).status, 400);
    assert.equal((await call('/learning/resources/submit', student, 'POST',
      { ...textBody, reviewStatus: 'published' })).status, 400);
    assert.equal((await call('/learning/resources/submit', student, 'POST',
      { ...textBody, reviewedBy: student })).status, 400);
    assert.equal((await call('/learning/resources/submit', student, 'POST',
      { ...textBody, title: '' })).status, 400);
    assert.equal((await call('/learning/resources/submit', student, 'POST',
      { ...textBody, resourceType: 'url', textContent: undefined, externalUrl: 'javascript:alert(1)' })).status, 400);
    assert.equal((await call('/learning/resources/submit', student, 'POST', textBody)).status, 201);
    assert.equal(resources[0].reviewStatus, 'submitted');
    assert.equal(resources[0].creditCost, 0);
    assert.equal((await call(`/learning/resources/${resourceId}`, student)).status, 404);
    assert.equal((await call(`/moderator/learning/resources/${resourceId}/publish`, student, 'POST',
      { creditCost: 0 })).status, 403);
    assert.equal((await call(`/moderator/learning/resources/${resourceId}/publish`, moderator, 'POST',
      { creditCost: -1 })).status, 400);
    assert.equal((await call(`/moderator/learning/resources/${resourceId}/publish`, moderator, 'POST',
      { creditCost: 1.5 })).status, 400);
    assert.equal((await call(`/moderator/learning/resources/${resourceId}/publish`, moderator, 'POST',
      { creditCost: 0 })).status, 200);
    assert.equal((await call(`/learning/resources/${resourceId}`, student)).body.data.textContent, 'Protected lesson text');
    resources[0].reviewStatus = 'submitted';
    assert.equal((await call(`/moderator/learning/resources/${resourceId}/publish`, admin, 'POST',
      { creditCost: 25 })).status, 200);
    const paid = await call(`/learning/resources/${resourceId}`, student);
    assert.equal(paid.body.data.locked, true);
    assert.equal(Object.hasOwn(paid.body.data, 'textContent'), false);
    assert.equal(JSON.stringify((await call(`/learning/topics/${topicId}`, student)).body).includes('Protected lesson text'), false);
    assert.equal((await call(`/moderator/learning/resources/${resourceId}/reject`, moderator, 'POST',
      { reason: 'Not suitable' })).status, 404);
    const urlSubmit = await call('/learning/resources/submit', student, 'POST', {
      topic: topicId, title: 'External guide', description: 'An HTTPS guide', resourceType: 'url',
      externalUrl: 'https://example.org/guide',
    });
    assert.equal(urlSubmit.status, 201);
    const secondId = urlSubmit.body.data.id;
    assert.equal((await call(`/moderator/learning/resources/${secondId}/reject`, moderator, 'POST',
      { reason: 'Out of date' })).status, 200);
    assert.equal((await call(`/learning/resources/${secondId}`, student)).status, 404);

    const moduleBody = { topic: topicId, title: 'Basics module', description: 'Start with this', resources: [resourceId] };
    assert.equal((await call('/moderator/learning/modules', student, 'POST', moduleBody)).status, 403);
    assert.equal((await call('/moderator/learning/modules', moderator, 'POST',
      { ...moduleBody, topic: otherTopicId })).status, 400);
    assert.equal((await call('/moderator/learning/modules', admin, 'POST', moduleBody)).status, 201);
    assert.deepEqual(modules[0].resources, [resourceId]);
    assert.equal((await call(`/learning/modules/${moduleId}`, student)).status, 404);
    assert.equal((await call(`/moderator/learning/modules/${moduleId}/publish`, student, 'POST', { creditCost: 0 })).status, 403);
    assert.equal((await call(`/moderator/learning/modules/${moduleId}/publish`, moderator, 'POST', { creditCost: 0 })).status, 200);
    const freeModule = await call(`/learning/modules/${moduleId}`, student);
    assert.deepEqual(freeModule.body.data.resources.map((item) => item.id), [resourceId]);
    assert.equal(Object.hasOwn(freeModule.body.data.resources[0], 'textContent'), false);
    modules[0].creditCost = 30;
    const lockedModule = await call(`/learning/modules/${moduleId}`, student);
    assert.equal(lockedModule.body.data.locked, true);
    assert.equal(Object.hasOwn(lockedModule.body.data, 'resources'), false);
    assert.equal((await call(`/moderator/learning/modules/${moduleId}/archive`, moderator, 'POST', {})).status, 200);
    assert.equal((await call(`/learning/modules/${moduleId}`, student)).status, 404);
    assert.equal((await call(`/moderator/learning/topics/${topicId}/archive`, moderator, 'POST', {})).status, 200);
    assert.equal((await call(`/learning/topics/${topicId}`, student)).status, 404);
    assert.equal((await call(`/learning/resources/${resourceId}`, student)).status, 404);
    assert.equal(ledgerWrites, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    User.findById = originals.user; LearningTopic.find = originals.topicFind;
    LearningTopic.findOne = originals.topicOne; LearningTopic.exists = originals.topicExists;
    LearningTopic.create = originals.topicCreate; LearningTopic.findOneAndUpdate = originals.topicUpdate;
    LearningResource.find = originals.resourceFind; LearningResource.findOne = originals.resourceOne;
    LearningResource.findById = originals.resourceById; LearningResource.create = originals.resourceCreate;
    LearningResource.findOneAndUpdate = originals.resourceUpdate; LearningModule.find = originals.moduleFind;
    LearningModule.findOne = originals.moduleOne; LearningModule.create = originals.moduleCreate;
    LearningModule.findOneAndUpdate = originals.moduleUpdate; Assessment.find = originals.assessmentFind;
    Assessment.exists = originals.assessmentExists; CreditTransaction.create = originals.transactionCreate;
    process.env.JWT_SECRET = originals.secret; process.env.NODE_ENV = originals.env;
  }
});
