const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const LearningTopic = require('../models/LearningTopic');
const LearningResource = require('../models/LearningResource');
const LearningModule = require('../models/LearningModule');
const LearningUnlock = require('../models/LearningUnlock');
const CreditTransaction = require('../models/CreditTransaction');
const Assessment = require('../models/Assessment');

const student = '507f1f77bcf86cd799439011';
const other = '507f1f77bcf86cd799439012';
const third = '507f1f77bcf86cd799439018';
const topicId = '507f1f77bcf86cd799439013';
const resourceId = '507f1f77bcf86cd799439014';
const moduleId = '507f1f77bcf86cd799439015';
const freeId = '507f1f77bcf86cd799439016';
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

test('unlock evidence requires one positive-priced target and declares four unique keys', async () => {
  await new LearningUnlock({ student, resource: resourceId, pricePaid: 10 }).validate();
  await new LearningUnlock({ student, module: moduleId, pricePaid: 30 }).validate();
  await assert.rejects(new LearningUnlock({ student, resource: resourceId, module: moduleId, pricePaid: 10 }).validate());
  await assert.rejects(new LearningUnlock({ student, pricePaid: 10 }).validate());
  await assert.rejects(new LearningUnlock({ student, resource: resourceId, pricePaid: 0 }).validate());
  await assert.rejects(new LearningUnlock({ student, resource: resourceId, pricePaid: 1.5 }).validate());
  const unlockId = new mongoose.Types.ObjectId();
  await new CreditTransaction({ type: 'learning_unlock', fromUser: student, amount: 10,
    resource: resourceId, unlock: unlockId }).validate();
  await assert.rejects(new CreditTransaction({ type: 'learning_unlock', fromUser: student, amount: 10,
    resource: resourceId }).validate());
  await assert.rejects(new CreditTransaction({ type: 'learning_unlock', fromUser: student, toUser: other,
    amount: 10, resource: resourceId, unlock: unlockId }).validate());
  await assert.rejects(new CreditTransaction({ type: 'learning_unlock', fromUser: student,
    amount: 10, resource: resourceId, module: moduleId, unlock: unlockId }).validate());
  for (const [model, names] of [
    [LearningUnlock, ['uniq_learning_unlock_student_resource', 'uniq_learning_unlock_student_module']],
    [CreditTransaction, ['uniq_learning_unlock_ledger_resource', 'uniq_learning_unlock_ledger_module']],
  ]) {
    for (const name of names) assert.equal(model.schema.indexes().some(([, options]) =>
      options.name === name && options.unique === true), true);
  }
});

test('paid learning unlocks are authoritative, private, atomic, and idempotent', async () => {
  const originals = {
    userById: User.findById, userUpdate: User.findOneAndUpdate,
    topicExists: LearningTopic.exists, topicOne: LearningTopic.findOne,
    resourceOne: LearningResource.findOne, resourceFind: LearningResource.find,
    moduleOne: LearningModule.findOne, moduleFind: LearningModule.find,
    unlockExists: LearningUnlock.exists, unlockOne: LearningUnlock.findOne,
    unlockFind: LearningUnlock.find, unlockCreate: LearningUnlock.create,
    ledgerCreate: CreditTransaction.create, assessmentFind: Assessment.find,
    unlockIndexes: LearningUnlock.collection.indexes, ledgerIndexes: CreditTransaction.collection.indexes,
    startSession: mongoose.startSession, secret: process.env.JWT_SECRET, env: process.env.NODE_ENV,
  };
  process.env.JWT_SECRET = 'learning-unlock-test-secret';
  process.env.NODE_ENV = 'test';
  const topic = { _id: topicId, name: 'JavaScript', status: 'published' };
  const resources = [
    { _id: resourceId, topic: topicId, title: 'Paid guide', description: 'A guide',
      resourceType: 'text', textContent: 'Secret learning text', reviewStatus: 'published', creditCost: 10 },
    { _id: freeId, topic: topicId, title: 'Free guide', description: 'Free guide',
      resourceType: 'url', externalUrl: 'https://example.org/free', reviewStatus: 'published', creditCost: 0 },
  ];
  const modules = [{ _id: moduleId, topic: topicId, title: 'Paid module', description: 'A module',
    resources: [resourceId, freeId], assessment: null, status: 'published', creditCost: 30 }];
  const accounts = new Map([[student, 100], [other, 100], [third, 100]]);
  const unlocks = [];
  const ledger = [];
  let failLedger = false;
  let failUnlock = false;
  let transactionQueue = Promise.resolve();
  const match = (row, filter = {}) => Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some((part) => match(row, part));
    if (expected && typeof expected === 'object' && '$in' in expected) return expected.$in.some((value) => String(row[key]) === String(value));
    if (expected && typeof expected === 'object' && '$gte' in expected) return row[key] >= expected.$gte;
    return String(row[key]) === String(expected);
  });
  const one = (rows) => (filter) => ({ session() { return this; }, lean: async () => clone(rows.find((row) => match(row, filter)) || null) });
  const find = (rows) => (filter) => ({ sort() { return this; }, limit() { return this; }, select() { return this; },
    lean: async () => clone(rows.filter((row) => match(row, filter))) });
  User.findById = (id) => ({ select: () => ({ lean: async () => ({ _id: id,
    role: 'student', emailVerified: true, credits: accounts.get(String(id)) ?? 0,
    name: 'Test', email: 'test@example.test' }) }) });
  User.findOneAndUpdate = async (filter, update) => {
    const old = accounts.get(filter._id);
    if (old === undefined || old < filter.credits.$gte) return null;
    const credits = old + update.$inc.credits;
    accounts.set(filter._id, credits);
    return { _id: filter._id, credits };
  };
  LearningTopic.exists = async (filter) => topic.status === filter.status && topic._id === String(filter._id);
  LearningTopic.findOne = () => ({ lean: async () => clone(topic) });
  LearningResource.findOne = one(resources); LearningResource.find = find(resources);
  LearningModule.findOne = one(modules); LearningModule.find = find(modules);
  LearningUnlock.exists = async (filter) => unlocks.some((row) => match(row, filter));
  LearningUnlock.findOne = one(unlocks); LearningUnlock.find = find(unlocks);
  LearningUnlock.create = async ([body]) => {
    if (failUnlock) throw new Error('Entitlement write failed');
    if (unlocks.some((row) => match(row, { student: body.student,
      ...(body.resource ? { resource: body.resource } : { module: body.module }) }))) {
      const error = new Error('Duplicate entitlement'); error.code = 11000; throw error;
    }
    const row = { _id: new mongoose.Types.ObjectId().toString(), ...body };
    unlocks.push(row); return [clone(row)];
  };
  CreditTransaction.create = async ([body]) => {
    if (failLedger) throw new Error('Ledger write failed');
    ledger.push(clone(body)); return [body];
  };
  Assessment.find = () => ({ select() { return this; }, limit() { return this; }, lean: async () => [] });
  mongoose.startSession = async () => ({
    async withTransaction(callback) {
      const prior = transactionQueue;
      let release;
      transactionQueue = new Promise((resolve) => { release = resolve; });
      await prior;
      const oldBalances = new Map(accounts);
      const oldUnlocks = unlocks.length;
      const oldLedger = ledger.length;
      try { await callback(); }
      catch (error) { accounts.clear(); for (const [key, value] of oldBalances) accounts.set(key, value);
        unlocks.length = oldUnlocks; ledger.length = oldLedger; throw error; }
      finally { release(); }
    },
    async endSession() {},
  });

  const app = express(); app.use(express.json());
  app.use('/api/learning', require('../routes/learningRoutes'));
  const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const base = `http://127.0.0.1:${server.address().port}/api/learning`;
  const call = async (path, actor = student, method = 'GET', body) => {
    const response = await fetch(base + path, { method,
      headers: { authorization: `Bearer ${jwt.sign({ id: actor }, process.env.JWT_SECRET)}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  try {
    assert.equal((await call(`/resources/${freeId}`)).body.data.externalUrl, 'https://example.org/free');
    assert.equal((await call(`/resources/${freeId}/unlock`, student, 'POST', {})).body.data.alreadyAccessible, true);
    assert.equal(unlocks.length, 0); assert.equal(ledger.length, 0);
    const locked = await call(`/resources/${resourceId}`);
    assert.equal(locked.body.data.locked, true);
    assert.equal(Object.hasOwn(locked.body.data, 'textContent'), false);
    assert.equal((await call(`/resources/${resourceId}`, other)).body.data.locked, true);
    const paidUrlId = new mongoose.Types.ObjectId().toString();
    resources.push({ ...resources[1], _id: paidUrlId, title: 'Paid link',
      externalUrl: 'https://example.org/paid', creditCost: 8 });
    const paidUrl = await call(`/resources/${paidUrlId}`, other);
    assert.equal(paidUrl.body.data.locked, true);
    assert.equal(Object.hasOwn(paidUrl.body.data, 'externalUrl'), false);
    assert.equal((await call(`/resources/${resourceId}/unlock`, student, 'POST', { amount: 1 })).status, 400);
    assert.equal((await call(`/resources/${resourceId}/unlock`, student, 'POST', { type: 'learning_unlock' })).status, 400);
    assert.equal((await call(`/resources/${resourceId}/unlock`, student, 'POST', {})).body.data.amountSpent, 10);
    assert.equal(accounts.get(student), 90); assert.equal(unlocks.length, 1); assert.equal(ledger.length, 1);
    assert.equal(ledger[0].amount, 10); assert.equal(ledger[0].fromUser, student);
    assert.equal(ledger[0].toUser, undefined); assert.equal(ledger[0].resource, resourceId);
    assert.equal((await call(`/resources/${resourceId}`)).body.data.textContent, 'Secret learning text');
    resources[0].creditCost = 25;
    assert.equal((await call(`/resources/${resourceId}/unlock`, student, 'POST', {})).body.data.alreadyUnlocked, true);
    assert.equal(accounts.get(student), 90); assert.equal(unlocks[0].pricePaid, 10);
    assert.equal((await call(`/resources/${resourceId}`, other)).body.data.locked, true);
    accounts.set(other, 5);
    assert.equal((await call(`/resources/${resourceId}/unlock`, other, 'POST', {})).status, 409);
    assert.equal(unlocks.length, 1); assert.equal(ledger.length, 1); assert.equal(accounts.get(other), 5);

    const lockedModule = await call(`/modules/${moduleId}`);
    assert.equal(lockedModule.body.data.locked, true);
    assert.equal(Object.hasOwn(lockedModule.body.data, 'resources'), false);
    assert.equal((await call(`/modules/${moduleId}/unlock`, student, 'POST', {})).body.data.amountSpent, 30);
    assert.equal(accounts.get(student), 60); assert.equal(unlocks.length, 2); assert.equal(ledger.length, 2);
    assert.equal(ledger[1].module, moduleId); assert.equal(ledger[1].amount, 30);
    const openedModule = await call(`/modules/${moduleId}`);
    assert.deepEqual(openedModule.body.data.resources.map((item) => item.id), [resourceId, freeId]);
    assert.equal(openedModule.body.data.resources[0].textContent, 'Secret learning text');
    assert.equal((await call(`/modules/${moduleId}`)).status, 200);
    assert.equal(accounts.get(student), 60); assert.equal(ledger.length, 2);
    assert.equal((await call(`/modules/${moduleId}`, other)).body.data.locked, true);
    accounts.set(other, 100);
    assert.equal((await call(`/modules/${moduleId}/unlock`, other, 'POST', {})).status, 200);
    assert.equal((await call(`/resources/${resourceId}`, other)).body.data.locked, true);
    assert.equal((await call(`/modules/${moduleId}/unlock`, student, 'POST', {})).body.data.alreadyUnlocked, true);
    modules[0].creditCost = 0;
    assert.equal((await call(`/modules/${moduleId}`, student)).body.data.resources[0].textContent,
      'Secret learning text');
    assert.equal((await call(`/modules/${moduleId}`, third)).body.data.resources[0].locked, true);
    modules[0].creditCost = 30;

    const freeModule = { _id: new mongoose.Types.ObjectId().toString(), topic: topicId, title: 'Free module',
      description: 'Free', resources: [freeId], status: 'published', creditCost: 0 };
    modules.push(freeModule);
    assert.equal((await call(`/modules/${freeModule._id}`)).body.data.resources[0].externalUrl, 'https://example.org/free');
    assert.equal((await call(`/modules/${freeModule._id}/unlock`, student, 'POST', {})).body.data.alreadyAccessible, true);
    const previousWrites = ledger.length;
    resources[0].reviewStatus = 'archived';
    assert.equal((await call(`/resources/${resourceId}`)).status, 404);
    assert.equal((await call(`/resources/${resourceId}/unlock`, student, 'POST', {})).status, 404);
    resources[0].reviewStatus = 'rejected';
    assert.equal((await call(`/resources/${resourceId}/unlock`, student, 'POST', {})).status, 404);
    resources[0].reviewStatus = 'submitted';
    assert.equal((await call(`/resources/${resourceId}/unlock`, student, 'POST', {})).status, 404);
    resources[0].reviewStatus = 'published';
    modules[0].status = 'archived';
    assert.equal((await call(`/modules/${moduleId}`)).status, 404);
    assert.equal((await call(`/modules/${moduleId}/unlock`, student, 'POST', {})).status, 404);
    modules[0].status = 'draft';
    assert.equal((await call(`/modules/${moduleId}/unlock`, student, 'POST', {})).status, 404);
    modules[0].status = 'published';
    assert.equal(ledger.length, previousWrites);

    const freshId = new mongoose.Types.ObjectId().toString();
    resources.push({ ...resources[0], _id: freshId, creditCost: 15 });
    process.env.NODE_ENV = 'production';
    LearningUnlock.collection.indexes = async () => [];
    CreditTransaction.collection.indexes = async () => [];
    assert.equal((await call(`/resources/${freshId}/unlock`, student, 'POST', {})).status, 503);
    assert.equal(accounts.get(student), 60);
    LearningUnlock.collection.indexes = async () => [
      { name: 'uniq_learning_unlock_student_resource', unique: true,
        key: { student: 1, resource: 1 }, partialFilterExpression: { resource: { $exists: true } } },
      { name: 'uniq_learning_unlock_student_module', unique: true,
        key: { student: 1, module: 1 }, partialFilterExpression: { module: { $exists: true } } },
    ];
    CreditTransaction.collection.indexes = async () => [
      { name: 'uniq_learning_unlock_ledger_resource', unique: true,
        key: { fromUser: 1, resource: 1, type: 1 },
        partialFilterExpression: { type: 'learning_unlock', resource: { $exists: true }, amount: { $gt: 20 } } },
      { name: 'uniq_learning_unlock_ledger_module', unique: true,
        key: { fromUser: 1, module: 1, type: 1 },
        partialFilterExpression: { type: 'learning_unlock', module: { $exists: true } } },
    ];
    assert.equal((await call(`/resources/${freshId}/unlock`, student, 'POST', {})).status, 503);
    CreditTransaction.collection.indexes = async () => [
      { name: 'uniq_learning_unlock_ledger_resource', unique: true,
        key: { fromUser: 1, resource: 1, type: 1 },
        partialFilterExpression: { type: 'learning_unlock', resource: { $exists: true } } },
      { name: 'uniq_learning_unlock_ledger_module', unique: true,
        key: { fromUser: 1, module: 1, type: 1 },
        partialFilterExpression: { type: 'learning_unlock', module: { $exists: true } } },
    ];
    accounts.set(third, 0);
    assert.equal((await call(`/resources/${freshId}/unlock`, third, 'POST', {})).status, 409);
    process.env.NODE_ENV = 'test';
    failLedger = true;
    assert.equal((await call(`/resources/${freshId}/unlock`, student, 'POST', {})).status, 500);
    assert.equal(accounts.get(student), 60); assert.equal(unlocks.length, 3); assert.equal(ledger.length, 3);
    failLedger = false; failUnlock = true;
    assert.equal((await call(`/resources/${freshId}/unlock`, student, 'POST', {})).status, 500);
    assert.equal(accounts.get(student), 60); assert.equal(unlocks.length, 3); assert.equal(ledger.length, 3);
    failUnlock = false;
    const raceId = new mongoose.Types.ObjectId().toString();
    resources.push({ ...resources[0], _id: raceId, creditCost: 12 });
    const race = await Promise.all([call(`/resources/${raceId}/unlock`, student, 'POST', {}),
      call(`/resources/${raceId}/unlock`, student, 'POST', {})]);
    assert.equal(race.every((item) => item.status === 200), true);
    assert.equal(unlocks.filter((item) => item.resource === raceId).length, 1);
    assert.equal(ledger.filter((item) => item.resource === raceId).length, 1);
    assert.equal(accounts.get(student), 48);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    User.findById = originals.userById; User.findOneAndUpdate = originals.userUpdate;
    LearningTopic.exists = originals.topicExists; LearningTopic.findOne = originals.topicOne;
    LearningResource.findOne = originals.resourceOne; LearningResource.find = originals.resourceFind;
    LearningModule.findOne = originals.moduleOne; LearningModule.find = originals.moduleFind;
    LearningUnlock.exists = originals.unlockExists; LearningUnlock.findOne = originals.unlockOne;
    LearningUnlock.find = originals.unlockFind; LearningUnlock.create = originals.unlockCreate;
    CreditTransaction.create = originals.ledgerCreate; Assessment.find = originals.assessmentFind;
    LearningUnlock.collection.indexes = originals.unlockIndexes;
    CreditTransaction.collection.indexes = originals.ledgerIndexes;
    mongoose.startSession = originals.startSession;
    process.env.JWT_SECRET = originals.secret; process.env.NODE_ENV = originals.env;
  }
});
