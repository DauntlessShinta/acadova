const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const CreditTransaction = require('../models/CreditTransaction');
const User = require('../models/User');
const Session = require('../models/Session');
const Assessment = require('../models/Assessment');
const LearningResource = require('../models/LearningResource');
const LearningModule = require('../models/LearningModule');

const learner = '507f1f77bcf86cd799439011';
const tutor = '507f1f77bcf86cd799439012';
const outsider = '507f1f77bcf86cd799439013';
const sessionId = '507f1f77bcf86cd799439014';
const date = (day) => new Date(`2026-09-${day}T12:00:00Z`);
const payment = (id, amount, day, overrides = {}) => ({
  _id: id, type: 'session_payment', amount, fromUser: learner, toUser: tutor,
  session: sessionId, createdAt: date(day), ...overrides,
});

test('Student wallet history is private, event-aware, bounded, and read-only', async () => {
  const previousSecret = process.env.JWT_SECRET;
  const original = {
    transactionFind: CreditTransaction.find, transactionAggregate: CreditTransaction.aggregate,
    userFind: User.find,
    userFindById: User.findById, sessionFind: Session.find,
    assessmentFind: Assessment.find,
    resourceFind: LearningResource.find, moduleFind: LearningModule.find,
  };
  process.env.JWT_SECRET = 'credit-wallet-test-secret';
  let rows = [];
  let peers = [{ _id: learner, name: 'Alex Learner' }, { _id: tutor, name: 'Taylor Tutor' }];
  let sessions = [{ _id: sessionId, subject: 'JavaScript', scheduledAt: date('27'),
    learner, tutor }];
  const filters = [];
  const aggregationFilters = [];

  CreditTransaction.aggregate = async (pipeline) => {
    aggregationFilters.push(pipeline);
    const viewerId = String(pipeline[0].$match.$or[0].fromUser);
    let recordedEarned = 0;
    let recordedSpent = 0;
    for (const row of rows) {
      if (!Number.isSafeInteger(row.amount) || row.amount <= 0) continue;
      const fromViewer = String(row.fromUser) === viewerId;
      const toViewer = String(row.toUser) === viewerId;
      if (toViewer && !fromViewer) recordedEarned += row.amount;
      if (fromViewer && !toViewer) recordedSpent += row.amount;
    }
    return recordedEarned || recordedSpent ? [{ recordedEarned, recordedSpent }] : [];
  };

  CreditTransaction.find = (filter) => {
    filters.push(filter);
    const query = {
      select() { return this; }, sort() { return this; },
      skip(value) { this.offset = value; return this; },
      limit(value) { this.max = value; return this; },
      async lean() {
        const own = rows.filter((row) => row.fromUser === filter.$or[0].fromUser
          || row.toUser === filter.$or[1].toUser);
        own.sort((a, b) => b.createdAt - a.createdAt || String(b._id).localeCompare(String(a._id)));
        return own.slice(this.offset, this.offset + this.max);
      },
    };
    return query;
  };
  User.find = () => ({ select: () => ({ lean: async () => peers }) });
  Session.find = () => ({ select: () => ({ lean: async () => sessions }) });
  Assessment.find = () => ({ select: () => ({ lean: async () => [{
    _id: sessionId, title: 'JavaScript basics',
  }] }) });
  LearningResource.find = () => ({ select: () => ({ lean: async () => [{
    _id: sessionId, title: 'JavaScript guide',
  }] }) });
  LearningModule.find = () => ({ select: () => ({ lean: async () => [{
    _id: outsider, title: 'JavaScript module',
  }] }) });
  User.findById = (id) => ({ select: () => ({ lean: async () => ({
    _id: id, name: 'Wallet owner', email: 'safe@example.test', role: 'student',
    credits: id === learner ? 80 : 120, emailVerified: true,
  }) }) });

  const app = express();
  app.use(express.json());
  app.use('/api/credits', require('../routes/creditRoutes'));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const url = `http://127.0.0.1:${server.address().port}/api/credits`;
  const call = async (path, id, method = 'GET') => {
    const response = await fetch(`${url}${path}`, { method,
      headers: id ? { authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}` } : {} });
    const raw = await response.text();
    return { status: response.status, body: raw.startsWith('{') ? JSON.parse(raw) : raw };
  };

  try {
    assert.equal((await call('/mine')).status, 401);
    assert.equal((await call('/mine?userId=' + tutor, learner)).status, 400);
    assert.equal((await call('/mine?limit=51', learner)).status, 400);
    assert.equal((await call('/mine?page=0', learner)).status, 400);
    assert.equal((await call('/mine', learner, 'POST')).status, 404);
    assert.equal((await call('/mine', learner, 'PATCH')).status, 404);

    rows = [
      payment('payment-1', 1, '21'), payment('payment-2', 2, '22'),
      payment('payment-20', 20, '23'),
      { _id: 'grant', type: 'initial_grant', amount: 100, toUser: learner, createdAt: date('24') },
      payment('outsider', 50, '25', { fromUser: outsider, toUser: tutor }),
      payment('missing-user', 2, '26'),
      payment('missing-session', 1, '27', { session: '507f1f77bcf86cd799439099' }),
      { _id: 'unknown', type: 'new_future_event', amount: 3, toUser: learner,
        createdAt: date('28') },
    ];
    peers = [{ _id: learner, name: 'Alex Learner' }];
    let result = await call('/mine', learner);
    assert.equal(result.status, 200);
    assert.equal(result.body.balance, 80); // Not reconstructed from history.
    assert.deepEqual(result.body.summary, { recordedEarned: 103, recordedSpent: 26 });
    assert.equal(String(aggregationFilters.at(-1)[0].$match.$or[0].fromUser), learner);
    assert.deepEqual(aggregationFilters.at(-1)[1], { $match: { $expr: { $isNumber: '$amount' } } });
    assert.deepEqual(aggregationFilters.at(-1)[2].$match.$expr,
      { $eq: ['$amount', { $trunc: ['$amount', 0] }] });
    assert.equal(result.body.data.length, 7);
    assert.equal(result.body.data.some((item) => item.id === 'outsider'), false);
    assert.deepEqual(filters.at(-1), { $or: [{ fromUser: learner }, { toUser: learner }] });
    assert.equal(result.body.data[0].id, 'unknown');
    assert.equal(result.body.data[0].label, 'Credit activity');
    assert.equal(result.body.data[0].signedAmount, 3);
    assert.deepEqual(result.body.data.filter((item) => item.type === 'session_payment')
      .map((item) => item.signedAmount), [-1, -2, -20, -2, -1]);
    assert.equal(result.body.data.find((item) => item.id === 'grant').counterparty, null);
    assert.equal(result.body.data.find((item) => item.id === 'grant').description,
      'Acadova welcome credit grant');
    assert.equal(result.body.data.find((item) => item.id === 'missing-user').counterparty, null);
    assert.equal(result.body.data.find((item) => item.id === 'missing-session').relatedSession, null);
    assert.equal(result.body.data.find((item) => item.id === 'payment-20').label, 'Tutoring session');

    result = await call('/mine', tutor);
    assert.equal(result.status, 200);
    assert.equal(result.body.balance, 120);
    assert.deepEqual(result.body.summary, { recordedEarned: 76, recordedSpent: 0 });
    assert.equal(result.body.data.find((item) => item.id === 'payment-20').signedAmount, 20);
    assert.equal(result.body.data.find((item) => item.id === 'payment-2').signedAmount, 2);
    assert.equal(result.body.data.find((item) => item.id === 'payment-1').signedAmount, 1);
    assert.match(result.body.data.find((item) => item.id === 'payment-20').description, /Taught Alex Learner/);

    result = await call('/mine?limit=2&page=1', learner);
    assert.equal(result.body.data.length, 2);
    assert.equal(result.body.pagination.hasMore, true);
    result = await call('/mine?limit=2&page=2', learner);
    assert.equal(result.body.data.length, 2);
    assert.equal(result.body.pagination.page, 2);
    assert.deepEqual(result.body.summary, { recordedEarned: 103, recordedSpent: 26 });

    rows = [payment('malformed', null, '29', { session: 'invalid-reference' })];
    result = await call('/mine', learner);
    assert.equal(result.status, 200);
    assert.equal(result.body.data[0].amount, null);
    assert.equal(result.body.data[0].signedAmount, null);
    assert.equal(result.body.data[0].relatedSession, null);
    assert.deepEqual(result.body.summary, { recordedEarned: 0, recordedSpent: 0 });

    rows = [{ _id: 'assessment-reward', type: 'assessment_reward', toUser: learner,
      assessment: sessionId, amount: 20, createdAt: date('29') }];
    result = await call('/mine', learner);
    assert.equal(result.status, 200);
    assert.equal(result.body.data[0].direction, 'earned');
    assert.equal(result.body.data[0].signedAmount, 20);
    assert.equal(result.body.data[0].label, 'Assessment reward');
    assert.equal(result.body.data[0].description, 'JavaScript basics');
    assert.equal(result.body.data[0].counterparty, null);
    assert.deepEqual(result.body.summary, { recordedEarned: 20, recordedSpent: 0 });

    rows = [
      { _id: 'resource-unlock', type: 'learning_unlock', fromUser: learner,
        resource: sessionId, amount: 10, createdAt: date('27') },
      { _id: 'module-unlock', type: 'learning_unlock', fromUser: learner,
        module: outsider, amount: 30, createdAt: date('28') },
      { _id: 'reward-with-spending', type: 'assessment_reward', toUser: learner,
        assessment: sessionId, amount: 20, createdAt: date('29') },
    ];
    result = await call('/mine', learner);
    assert.equal(result.status, 200);
    assert.equal(result.body.balance, 80);
    assert.deepEqual(result.body.summary, { recordedEarned: 20, recordedSpent: 40 });
    assert.equal(result.body.data.find((item) => item.id === 'resource-unlock').signedAmount, -10);
    assert.equal(result.body.data.find((item) => item.id === 'resource-unlock').description, 'JavaScript guide');
    assert.equal(result.body.data.find((item) => item.id === 'resource-unlock').label, 'Learning resource');
    assert.equal(result.body.data.find((item) => item.id === 'module-unlock').signedAmount, -30);
    assert.equal(result.body.data.find((item) => item.id === 'module-unlock').description, 'JavaScript module');
    assert.equal(result.body.data.find((item) => item.id === 'module-unlock').label, 'Learning module');

    rows = [
      { _id: 'admin-credit', type: 'admin_adjustment', toUser: learner,
        adjustmentReason: 'Verified missed reward', amount: 15, createdAt: date('27') },
      { _id: 'admin-debit', type: 'admin_adjustment', fromUser: learner,
        adjustmentReason: 'Reversed wrong grant', amount: 5, createdAt: date('28') },
    ];
    result = await call('/mine', learner);
    assert.equal(result.body.balance, 80);
    assert.deepEqual(result.body.summary, { recordedEarned: 15, recordedSpent: 5 });
    assert.equal(result.body.data.find((item) => item.id === 'admin-credit').signedAmount, 15);
    assert.equal(result.body.data.find((item) => item.id === 'admin-debit').signedAmount, -5);
    assert.equal(result.body.data[0].label, 'Admin credit adjustment');
    assert.equal(result.body.data.find((item) => item.id === 'admin-credit').description, 'Verified missed reward');
    assert.equal((await call('/mine', outsider)).body.data.length, 0);

    rows = [
      { _id: 'mixed-grant', type: 'initial_grant', toUser: learner,
        amount: 100, createdAt: date('21') },
      payment('mixed-old', 2, '22'),
      payment('mixed-new', 20, '23'),
      { _id: 'mixed-assessment', type: 'assessment_reward', toUser: learner,
        assessment: sessionId, amount: 20, createdAt: date('24') },
    ];
    result = await call('/mine', learner);
    assert.deepEqual(result.body.summary, { recordedEarned: 120, recordedSpent: 22 });
    assert.equal(result.body.balance, 80);

    rows = [];
    result = await call('/mine', learner);
    assert.equal(result.body.balance, 80);
    assert.deepEqual(result.body.summary, { recordedEarned: 0, recordedSpent: 0 });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    CreditTransaction.find = original.transactionFind;
    CreditTransaction.aggregate = original.transactionAggregate;
    User.find = original.userFind;
    User.findById = original.userFindById;
    Session.find = original.sessionFind;
    Assessment.find = original.assessmentFind;
    LearningResource.find = original.resourceFind;
    LearningModule.find = original.moduleFind;
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});
