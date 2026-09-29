const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const CreditTransaction = require('../models/CreditTransaction');
const User = require('../models/User');
const Session = require('../models/Session');
const Assessment = require('../models/Assessment');

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
    transactionFind: CreditTransaction.find, userFind: User.find,
    userFindById: User.findById, sessionFind: Session.find,
    assessmentFind: Assessment.find,
  };
  process.env.JWT_SECRET = 'credit-wallet-test-secret';
  let rows = [];
  let peers = [{ _id: learner, name: 'Alex Learner' }, { _id: tutor, name: 'Taylor Tutor' }];
  let sessions = [{ _id: sessionId, subject: 'JavaScript', scheduledAt: date('27'),
    learner, tutor }];
  const filters = [];

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

    rows = [payment('malformed', null, '29', { session: 'invalid-reference' })];
    result = await call('/mine', learner);
    assert.equal(result.status, 200);
    assert.equal(result.body.data[0].amount, null);
    assert.equal(result.body.data[0].signedAmount, null);
    assert.equal(result.body.data[0].relatedSession, null);

    rows = [{ _id: 'assessment-reward', type: 'assessment_reward', toUser: learner,
      assessment: sessionId, amount: 20, createdAt: date('29') }];
    result = await call('/mine', learner);
    assert.equal(result.status, 200);
    assert.equal(result.body.data[0].direction, 'earned');
    assert.equal(result.body.data[0].signedAmount, 20);
    assert.equal(result.body.data[0].label, 'Assessment reward');
    assert.equal(result.body.data[0].description, 'JavaScript basics');
    assert.equal(result.body.data[0].counterparty, null);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    CreditTransaction.find = original.transactionFind;
    User.find = original.userFind;
    User.findById = original.userFindById;
    Session.find = original.sessionFind;
    Assessment.find = original.assessmentFind;
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});
