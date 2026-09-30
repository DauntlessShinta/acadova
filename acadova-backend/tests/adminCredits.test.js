const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const CreditConfig = require('../models/CreditConfig');
const CreditRuleChange = require('../models/CreditRuleChange');
const CreditTransaction = require('../models/CreditTransaction');
const User = require('../models/User');
const { getEffectiveCreditRules } = require('../services/creditRuleService');
const controller = require('../controllers/adminCreditController');
const analytics = require('../controllers/analyticsController');

const admin = '507f1f77bcf86cd799439011';
const student = '507f1f77bcf86cd799439012';
const moderator = '507f1f77bcf86cd799439013';
const ref = '9e434bfa-4160-4c2a-817a-302a46b7067e';
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; } });
const req = (body) => ({ body, user: { id: admin, role: 'admin' }, originalUrl: '/api/admin/credits' });

test('P3.6 rule defaults, prospective snapshots, validation, and audited Admin adjustments', async () => {
  const old = {
    configFind: CreditConfig.findById, configCreate: CreditConfig.create,
    configUpdate: CreditConfig.findOneAndUpdate, changeCreate: CreditRuleChange.create,
    userFind: User.findOne, userUpdate: User.findOneAndUpdate,
    ledgerFind: CreditTransaction.findOne, ledgerCreate: CreditTransaction.create,
    startSession: mongoose.startSession, secret: process.env.JWT_SECRET,
    environment: process.env.NODE_ENV, indexes: CreditTransaction.collection.indexes,
  };
  let config = null;
  let balance = 100;
  const changes = [];
  const ledger = [];
  let failLedger = false;
  let transactionQueue = Promise.resolve();
  CreditConfig.findById = () => ({ session() { return this; }, lean: async () => config });
  CreditConfig.create = async ([value]) => { config = { ...value }; return [config]; };
  CreditConfig.findOneAndUpdate = async (filter, update) => {
    if (!config || config.version !== filter.version) return null;
    config = { ...config, ...update.$set, version: config.version + 1 }; return config;
  };
  CreditRuleChange.create = async ([value]) => { changes.push(value); return [value]; };
  User.findOne = (filter) => ({ select() { return this; }, session() { return this; },
    lean: async () => filter._id === student && filter.role === 'student' ? { credits: balance } : null });
  User.findOneAndUpdate = async (filter, update) => {
    if (filter._id !== student || filter.role !== 'student'
      || (filter.credits?.$gte !== undefined && balance < filter.credits.$gte)
      || (filter.credits?.$lte !== undefined && balance > filter.credits.$lte)) return null;
    balance += update.$inc.credits; return { credits: balance };
  };
  CreditTransaction.findOne = (filter) => ({ lean: async () => ledger.find((row) =>
    row.adjustmentReference === filter.adjustmentReference) || null });
  CreditTransaction.create = async ([value]) => {
    if (failLedger) throw new Error('ledger failure');
    if (ledger.some((row) => row.adjustmentReference === value.adjustmentReference)) {
      throw Object.assign(new Error('duplicate reference'), { code: 11000 });
    }
    const row = { ...value, _id: new mongoose.Types.ObjectId(), createdAt: new Date() };
    ledger.push(row); return [row];
  };
  mongoose.startSession = async () => ({ async withTransaction(callback) {
    const prior = transactionQueue;
    let release;
    transactionQueue = new Promise((resolve) => { release = resolve; });
    await prior;
    const oldBalance = balance; const oldLedger = ledger.length; const oldChanges = changes.length;
    const oldConfig = config && { ...config };
    try { await callback(); } catch (error) {
      balance = oldBalance; ledger.length = oldLedger; changes.length = oldChanges; config = oldConfig; throw error;
    } finally { release(); }
  }, async endSession() {} });
  try {
    assert.deepEqual(await getEffectiveCreditRules(), {
      startingCreditGrant: 100, tutoringSessionCost: 20, assessmentReward: 20, version: 0,
    });
    const read = response();
    await controller.getCreditRules(req(), read);
    assert.equal(read.statusCode, 200);
    assert.equal(read.body.data.startingCreditGrant, 100);
    const update = response();
    await controller.updateCreditRules(req({ startingCreditGrant: 120, tutoringSessionCost: 25,
      assessmentReward: 30, expectedVersion: 0 }), update);
    assert.equal(update.statusCode, 200);
    assert.deepEqual(await getEffectiveCreditRules(), { startingCreditGrant: 120,
      tutoringSessionCost: 25, assessmentReward: 30, version: 1 });
    assert.equal(changes.length, 1);
    assert.equal(changes[0].actor, admin);
    assert.equal(changes[0].before.startingCreditGrant, 100);
    const stale = response();
    await controller.updateCreditRules(req({ startingCreditGrant: 140, tutoringSessionCost: 30,
      assessmentReward: 35, expectedVersion: 0 }), stale);
    assert.equal(stale.statusCode, 409);
    assert.equal(config.startingCreditGrant, 120);
    const concurrent = [response(), response()];
    await Promise.all(concurrent.map((res, index) => controller.updateCreditRules(req({
      startingCreditGrant: index === 0 ? 125 : 130, tutoringSessionCost: 25,
      assessmentReward: 30, expectedVersion: 1,
    }), res)));
    assert.deepEqual(concurrent.map((res) => res.statusCode).sort(), [200, 409]);
    assert.equal(config.version, 2);
    assert.equal(changes.length, 2);

    const credit = response();
    await controller.adjustCredits(req({ targetStudentId: student, direction: 'credit', amount: 15,
      reason: 'Correct verified reward', reference: ref }), credit);
    assert.equal(credit.statusCode, 201);
    assert.equal(balance, 115);
    assert.equal(ledger[0].toUser, student);
    assert.equal(ledger[0].fromUser, undefined);
    assert.equal(ledger[0].adjustmentActor, admin);
    assert.equal(ledger[0].adjustmentReason, 'Correct verified reward');
    const repeated = response();
    await controller.adjustCredits(req({ targetStudentId: student, direction: 'credit', amount: 15,
      reason: 'Correct verified reward', reference: ref }), repeated);
    assert.equal(repeated.body.repeated, true);
    assert.equal(balance, 115);
    assert.equal(ledger.length, 1);
    const conflicting = response();
    await controller.adjustCredits(req({ targetStudentId: student, direction: 'credit', amount: 14,
      reason: 'Correct verified reward', reference: ref }), conflicting);
    assert.equal(conflicting.statusCode, 409);
    const tooMuch = response();
    await controller.adjustCredits(req({ targetStudentId: student, direction: 'debit', amount: 116,
      reason: 'Incorrect grant reversal', reference: randomUUID() }), tooMuch);
    assert.equal(tooMuch.statusCode, 409);
    const debit = response();
    await controller.adjustCredits(req({ targetStudentId: student, direction: 'debit', amount: 20,
      reason: 'Incorrect grant reversal', reference: randomUUID() }), debit);
    assert.equal(debit.statusCode, 201);
    assert.equal(balance, 95);
    assert.equal(ledger[1].fromUser, student);
    assert.equal(ledger[1].toUser, undefined);
    const raceRef = randomUUID();
    const raceRequests = [response(), response()];
    await Promise.all(raceRequests.map((res) => controller.adjustCredits(req({
      targetStudentId: student, direction: 'credit', amount: 7,
      reason: 'Verified race correction', reference: raceRef,
    }), res)));
    assert.deepEqual(raceRequests.map((res) => res.statusCode).sort(), [200, 201]);
    assert.equal(balance, 102);
    assert.equal(ledger.filter((row) => row.adjustmentReference === raceRef).length, 1);
    failLedger = true;
    const failure = response();
    await controller.adjustCredits(req({ targetStudentId: student, direction: 'credit', amount: 5,
      reason: 'Verified balance correction', reference: randomUUID() }), failure);
    assert.equal(failure.statusCode, 503);
    assert.equal(balance, 102);
    assert.equal(ledger.length, 3);
    const nonStudent = response();
    await controller.adjustCredits(req({ targetStudentId: moderator, direction: 'credit', amount: 5,
      reason: 'Verified balance correction', reference: randomUUID() }), nonStudent);
    assert.equal(nonStudent.statusCode, 404);
    process.env.NODE_ENV = 'production';
    CreditTransaction.collection.indexes = async () => [];
    const noIndex = response();
    await controller.adjustCredits(req({ targetStudentId: student, direction: 'credit', amount: 5,
      reason: 'Verified balance correction', reference: randomUUID() }), noIndex);
    assert.equal(noIndex.statusCode, 503);
    assert.equal(balance, 102);
  } finally {
    CreditConfig.findById = old.configFind; CreditConfig.create = old.configCreate;
    CreditConfig.findOneAndUpdate = old.configUpdate; CreditRuleChange.create = old.changeCreate;
    User.findOne = old.userFind; User.findOneAndUpdate = old.userUpdate;
    CreditTransaction.findOne = old.ledgerFind; CreditTransaction.create = old.ledgerCreate;
    mongoose.startSession = old.startSession;
    CreditTransaction.collection.indexes = old.indexes;
    if (old.environment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = old.environment;
    if (old.secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = old.secret;
  }
});

test('adjustment ledger shape and partial uniqueness are explicit', async () => {
  await assert.rejects(new CreditConfig({ _id: 'another_rules_document',
    startingCreditGrant: 100, tutoringSessionCost: 20, assessmentReward: 20,
    version: 1, updatedBy: admin }).validate());
  await new CreditTransaction({ type: 'admin_adjustment', amount: 10, toUser: student,
    adjustmentTarget: student, adjustmentActor: admin, adjustmentDirection: 'credit',
    adjustmentReason: 'Verified correction', adjustmentReference: ref }).validate();
  await assert.rejects(new CreditTransaction({ type: 'admin_adjustment', amount: 10,
    adjustmentTarget: student, adjustmentActor: admin, adjustmentDirection: 'credit',
    adjustmentReason: 'Verified correction', adjustmentReference: ref }).validate());
  const index = CreditTransaction.schema.indexes().find(([, options]) =>
    options.name === 'uniq_admin_adjustment_reference');
  assert.deepEqual(index[0], { adjustmentReference: 1 });
  assert.equal(index[1].unique, true);
});

test('Admin credit analytics separates tutoring transfers from issuance and adjustments', async () => {
  const original = CreditTransaction.aggregate;
  CreditTransaction.aggregate = async () => [
    { _id: { type: 'session_payment' }, count: 2, amount: 40 },
    { _id: { type: 'initial_grant' }, count: 1, amount: 100 },
    { _id: { type: 'assessment_reward' }, count: 1, amount: 30 },
    { _id: { type: 'learning_unlock' }, count: 1, amount: 15 },
    { _id: { type: 'admin_adjustment', direction: 'credit' }, count: 1, amount: 5 },
    { _id: { type: 'admin_adjustment', direction: 'debit' }, count: 1, amount: 3 },
  ];
  try {
    const res = response();
    await analytics.getCreditAnalytics({}, res);
    assert.equal(res.body.data.totalTransactions, 7);
    assert.deepEqual(res.body.data.breakdown, {
      sessionTransferred: 40, initialGranted: 100, assessmentAwarded: 30,
      learningSpent: 15, adminAdded: 5, adminRemoved: 3,
    });
  } finally { CreditTransaction.aggregate = original; }
});

test('Admin routes reject Student and Moderator rule/adjustment writes and invalid bodies', async () => {
  const original = User.findById;
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'admin-credit-test-secret';
  User.findById = (id) => ({ select: () => ({ lean: async () => ({ _id: id,
    role: id === admin ? 'admin' : id === moderator ? 'moderator' : 'student',
    credits: 100, emailVerified: true }) }) });
  const app = express(); app.use(express.json()); app.use('/api/admin', require('../routes/adminRoutes'));
  const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  try {
    const call = async (id, path, method, body) => {
      const result = await fetch(`http://127.0.0.1:${server.address().port}/api/admin${path}`, {
        method, headers: { authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
          'content-type': 'application/json' }, body: body && JSON.stringify(body),
      });
      return result.status;
    };
    for (const id of [student, moderator]) {
      assert.equal(await call(id, '/credits/rules', 'PATCH', {}), 403);
      assert.equal(await call(id, '/credits/adjustments', 'POST', {}), 403);
      assert.equal(await call(id, '/credits/activity', 'GET'), 403);
    }
    for (const value of [0, -1, 1.5, 1001]) {
      assert.equal(await call(admin, '/credits/rules', 'PATCH', { startingCreditGrant: value,
        tutoringSessionCost: 20, assessmentReward: 20, expectedVersion: 0 }), 400);
      assert.equal(await call(admin, '/credits/adjustments', 'POST', { targetStudentId: student,
        direction: 'credit', amount: value, reason: 'Verified correction', reference: ref }), 400);
    }
    assert.equal(await call(admin, '/credits/adjustments', 'POST', { targetStudentId: student,
      direction: 'credit', amount: 10, reason: '', reference: ref }), 400);
    assert.equal(await call(admin, '/credits/adjustments', 'POST', { targetStudentId: student,
      direction: 'credit', amount: 10, reason: 'Verified correction', reference: ref,
      adjustmentActor: admin }), 400);
  } finally { await new Promise((resolve) => server.close(resolve)); User.findById = original;
    if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret; }
});
