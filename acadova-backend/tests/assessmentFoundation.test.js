const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const Assessment = require('../models/Assessment');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const CreditTransaction = require('../models/CreditTransaction');
const CreditConfig = require('../models/CreditConfig');
const User = require('../models/User');

const student = '507f1f77bcf86cd799439011';
const other = '507f1f77bcf86cd799439012';
const moderator = '507f1f77bcf86cd799439013';
const assessmentId = '507f1f77bcf86cd799439014';
const question = (correctIndex = 0) => ({ prompt: 'Choose the correct answer',
  options: ['Correct', 'Incorrect', 'Also incorrect'], correctIndex });
const draft = () => ({ _id: assessmentId, title: 'JavaScript basics', topic: 'JavaScript',
  passingScore: 60, status: 'draft', questions: [question(), question(1), question(2)],
  createdBy: moderator });

test('assessment and reward schemas require durable evidence and unique reward key', async () => {
  const valid = new Assessment(draft());
  await valid.validate();
  await assert.rejects(new Assessment({ ...draft(), questions: [question()] }).validate());
  await assert.rejects(new Assessment({ ...draft(), questions: [question(9), question(), question()] }).validate());
  const reward = new CreditTransaction({ type: 'assessment_reward', toUser: student,
    assessment: assessmentId, result: new mongoose.Types.ObjectId(), amount: 20 });
  await reward.validate();
  await assert.rejects(new CreditTransaction({ type: 'assessment_reward', toUser: student,
    assessment: assessmentId, amount: 20 }).validate());
  await assert.rejects(new CreditTransaction({ type: 'assessment_reward', toUser: student,
    assessment: assessmentId, result: new mongoose.Types.ObjectId(), amount: 20,
    fromUser: other }).validate());
  const index = CreditTransaction.schema.indexes()
    .find(([, options]) => options.name === 'uniq_assessment_reward_recipient_assessment');
  assert.deepEqual(index[0], { toUser: 1, assessment: 1, type: 1 });
  assert.equal(index[1].unique, true);
  assert.deepEqual(index[1].partialFilterExpression,
    { type: 'assessment_reward', toUser: { $exists: true }, assessment: { $exists: true } });
});

test('approved assessment grading, access, one-time reward, and rollback', async () => {
  const oldSecret = process.env.JWT_SECRET;
  const oldEnv = process.env.NODE_ENV;
  const original = {
    assessmentFind: Assessment.find, assessmentFindOne: Assessment.findOne,
    assessmentCreate: Assessment.create, assessmentUpdate: Assessment.findOneAndUpdate,
    assessmentFindById: Assessment.findById,
    attemptCreate: AssessmentAttempt.create, attemptFindOne: AssessmentAttempt.findOne,
    userFindById: User.findById, userUpdate: User.findOneAndUpdate,
    transactionCreate: CreditTransaction.create, startSession: mongoose.startSession,
    configFindById: CreditConfig.findById,
  };
  process.env.JWT_SECRET = 'assessment-test-secret';
  process.env.NODE_ENV = 'test';
  let configuredReward = 20;
  CreditConfig.findById = () => ({ session() { return this; }, lean: async () => ({
    startingCreditGrant: 100, tutoringSessionCost: 20, assessmentReward: configuredReward, version: 1,
  }) });
  let assessment = draft();
  let accounts = new Map([[student, { credits: 100, claims: [] }], [other, { credits: 100, claims: [] }]]);
  let attempts = [];
  let transactions = [];
  let failLedger = false;
  let awardedAmount = null;

  Assessment.find = () => ({ select() { return this; }, sort() { return this; }, limit() { return this; },
    lean: async () => assessment.status === 'published' ? [assessment] : [] });
  Assessment.findOne = (filter) => ({ lean: async () => assessment.status === filter.status
    && String(assessment._id) === String(filter._id) ? assessment : null });
  Assessment.findById = (id) => ({ lean: async () => String(assessment._id) === String(id) ? assessment : null });
  Assessment.create = async (body) => { assessment = { _id: assessmentId, ...body }; return assessment; };
  Assessment.findOneAndUpdate = async (filter, update) => {
    if (assessment.status !== filter.status || String(assessment._id) !== String(filter._id)) return null;
    assessment = { ...assessment, ...update.$set };
    return assessment;
  };
  AssessmentAttempt.create = async (input) => {
    const row = Array.isArray(input) ? input[0] : input;
    const saved = { ...row, _id: new mongoose.Types.ObjectId() };
    attempts.push(saved);
    return Array.isArray(input) ? [saved] : saved;
  };
  AssessmentAttempt.findOne = (filter) => ({ lean: async () => attempts.find((row) =>
    String(row._id) === filter._id && String(row.student) === filter.student) || null });
  User.findById = (id) => ({ select: () => ({ lean: async () => ({
    _id: id, role: id === moderator ? 'moderator' : 'student', credits: accounts.get(id)?.credits || 0,
    emailVerified: true, name: 'Test user', email: 'test@example.test',
  }) }) });
  User.findOneAndUpdate = async (filter, update) => {
    const account = accounts.get(filter._id);
    if (!account || account.claims.includes(String(filter.rewardedAssessments.$ne))) return null;
    account.claims.push(String(update.$addToSet.rewardedAssessments));
    account.credits += update.$inc.credits;
    awardedAmount = update.$inc.credits;
    return { _id: filter._id, credits: account.credits };
  };
  CreditTransaction.create = async ([row]) => {
    if (failLedger) throw new Error('simulated ledger failure');
    transactions.push(row);
    return [row];
  };
  mongoose.startSession = async () => ({
    async withTransaction(callback) {
      const oldAccounts = new Map([...accounts].map(([id, value]) => [id,
        { credits: value.credits, claims: [...value.claims] }]));
      const oldAttempts = attempts.length;
      const oldTransactions = transactions.length;
      try { await callback(); }
      catch (error) { accounts = oldAccounts; attempts.length = oldAttempts;
        transactions.length = oldTransactions; throw error; }
    },
    async endSession() {},
  });

  const app = express();
  app.use(express.json());
  app.use('/api/assessments', require('../routes/assessmentRoutes'));
  app.use('/api/moderator', require('../routes/moderatorRoutes'));
  app.use('/api/credits', require('../routes/creditRoutes'));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (path, id, method = 'GET', body) => {
    const response = await fetch(base + path, { method,
      headers: { authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`,
        ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    const raw = await response.text();
    return { status: response.status, body: raw.startsWith('{') ? JSON.parse(raw) : raw };
  };
  const creation = { title: 'JavaScript basics', topic: 'JavaScript', passingScore: 60,
    questions: [question(), question(1), question(2)] };

  try {
    assert.equal((await call('/assessments', student)).body.data.length, 0);
    assert.equal((await call(`/assessments/${assessmentId}`, student)).status, 404);
    assert.equal((await call(`/assessments/${assessmentId}/submit`, student, 'POST', { answers: [0, 1, 2] })).status, 404);
    assert.equal((await call('/moderator/assessments', student, 'POST', creation)).status, 403);
    assert.equal((await call('/credits/assessment_reward', student, 'POST',
      { assessment: assessmentId, amount: 999 })).status, 404);
    assert.equal((await call('/moderator/assessments', moderator, 'POST',
      { ...creation, rewardCredits: 999 })).status, 400);
    assert.equal((await call('/moderator/assessments', moderator, 'POST', creation)).status, 201);
    assert.equal(assessment.status, 'draft');
    assert.equal((await call(`/moderator/assessments/${assessmentId}`, student)).status, 403);
    const staffDetail = await call(`/moderator/assessments/${assessmentId}`, moderator);
    assert.equal(staffDetail.body.data.questions[0].correctIndex, 0);
    assert.equal((await call(`/moderator/assessments/${assessmentId}/publish`, student, 'POST', {})).status, 403);
    assert.equal((await call(`/moderator/assessments/${assessmentId}/publish`, moderator, 'POST', {})).status, 200);
    assert.equal(assessment.status, 'published');
    assert.equal(String(assessment.approvedBy), moderator);
    assert.equal((await call(`/moderator/assessments/${assessmentId}/publish`, moderator, 'POST', {})).status, 409);

    const listed = await call('/assessments', student);
    assert.equal(listed.body.data.length, 1);
    const visible = await call(`/assessments/${assessmentId}`, student);
    assert.equal(visible.status, 200);
    assert.equal(JSON.stringify(visible.body).includes('correctIndex'), false);
    assert.equal(JSON.stringify(listed.body).includes('correctIndex'), false);
    for (const extra of [{ passed: true }, { score: 100 }, { rewardCredits: 999 },
      { student: other }, { credits: 999 }, { transactionType: 'assessment_reward' }]) {
      assert.equal((await call(`/assessments/${assessmentId}/submit`, student, 'POST',
        { answers: [0, 1, 2], ...extra })).status, 400);
    }
    assert.equal((await call(`/assessments/${assessmentId}/submit`, student, 'POST',
      { answers: [0, 1] })).status, 400);

    assessment.passingScore = 67;
    const boundary = await call(`/assessments/${assessmentId}/submit`, student, 'POST', { answers: [0, 1, 0] });
    assert.equal(boundary.body.data.score, 67);
    assert.equal(boundary.body.data.passed, false); // 2/3 is below the exact 67% threshold.
    assessment.passingScore = 60;

    let result = await call(`/assessments/${assessmentId}/submit`, student, 'POST', { answers: [2, 2, 2] });
    assert.equal(result.status, 200);
    assert.equal(result.body.data.score, 33);
    assert.equal(result.body.data.passed, false);
    assert.equal(result.body.data.creditsAwarded, 0);
    assert.equal(attempts.length, 2);
    assert.equal(transactions.length, 0);
    assert.equal(accounts.get(student).credits, 100);

    result = await call(`/assessments/${assessmentId}/submit`, student, 'POST', { answers: [0, 1, 2] });
    assert.equal(result.status, 200);
    assert.equal(result.body.data.passed, true);
    assert.equal(result.body.data.score, 100);
    assert.equal(result.body.data.creditsAwarded, 20);
    assert.equal(awardedAmount, 20);
    assert.equal(accounts.get(student).credits, 120);
    assert.equal(transactions.length, 1);
    assert.deepEqual({ type: transactions[0].type, amount: transactions[0].amount,
      toUser: transactions[0].toUser, fromUser: transactions[0].fromUser,
      assessment: String(transactions[0].assessment) },
    { type: 'assessment_reward', amount: 20, toUser: student, fromUser: undefined,
      assessment: assessmentId });
    configuredReward = 30;
    assert.equal((await call(`/assessments/attempts/${result.body.data.id}`, student)).body.data.creditsAwarded, 20);
    assert.equal((await call(`/assessments/attempts/${result.body.data.id}`, other)).status, 404);
    assert.equal((await call(`/assessments/attempts/${result.body.data.id}`, student)).body.data.passed, true);

    const repeats = await Promise.all([call(`/assessments/${assessmentId}/submit`, student, 'POST',
      { answers: [0, 1, 2] }), call(`/assessments/${assessmentId}/submit`, student, 'POST',
      { answers: [0, 1, 2] })]);
    assert.deepEqual(repeats.map((item) => item.body.data.creditsAwarded), [0, 0]);
    assert.equal(accounts.get(student).credits, 120);
    assert.equal(transactions.length, 1);

    failLedger = true;
    const attemptsBeforeFailure = attempts.length;
    result = await call(`/assessments/${assessmentId}/submit`, other, 'POST', { answers: [0, 1, 2] });
    assert.equal(result.status, 500);
    assert.equal(accounts.get(other).credits, 100);
    assert.equal(accounts.get(other).claims.length, 0);
    assert.equal(attempts.length, attemptsBeforeFailure);
    assert.equal(transactions.length, 1);
    failLedger = false;
    const firstPassRace = await Promise.all([
      call(`/assessments/${assessmentId}/submit`, other, 'POST', { answers: [0, 1, 2] }),
      call(`/assessments/${assessmentId}/submit`, other, 'POST', { answers: [0, 1, 2] }),
    ]);
    assert.deepEqual(firstPassRace.map((item) => item.body.data.creditsAwarded).sort((a, b) => a - b), [0, 30]);
    assert.equal(accounts.get(other).credits, 130);
    assert.equal(transactions.length, 2);
    assert.equal(transactions[0].amount, 20);
    assert.equal(transactions[1].amount, 30);

    const originalIndexes = CreditTransaction.collection.indexes;
    process.env.NODE_ENV = 'production';
    CreditTransaction.collection.indexes = async () => [];
    try {
      result = await call(`/assessments/${assessmentId}/submit`, student, 'POST', { answers: [0, 1, 2] });
      assert.equal(result.status, 503);
      assert.equal(transactions.length, 2);
    } finally { CreditTransaction.collection.indexes = originalIndexes; process.env.NODE_ENV = 'test'; }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    Assessment.find = original.assessmentFind;
    Assessment.findOne = original.assessmentFindOne;
    Assessment.create = original.assessmentCreate;
    Assessment.findOneAndUpdate = original.assessmentUpdate;
    Assessment.findById = original.assessmentFindById;
    AssessmentAttempt.create = original.attemptCreate;
    AssessmentAttempt.findOne = original.attemptFindOne;
    User.findById = original.userFindById;
    User.findOneAndUpdate = original.userUpdate;
    CreditTransaction.create = original.transactionCreate;
    mongoose.startSession = original.startSession;
    CreditConfig.findById = original.configFindById;
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
    if (oldEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldEnv;
  }
});
