const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const User = require('../models/User');
const Session = require('../models/Session');
const { searchTutors } = require('../controllers/userController');
const {
  validateBody, validateParams, validateQuery, validationErrorHandler,
  schemas, escapeRegExp,
} = require('../middleware/validation');

const validId = '507f1f77bcf86cd799439011';
const validSession = {
  tutorId: validId,
  subject: 'Java',
  scheduledAt: '2026-09-25T06:30:00.000Z',
  meetingMethod: 'online',
  requestMessage: 'Help with arrays',
  creditAmount: 1,
};
const validRegistration = {
  name: 'User A', email: 'user@example.test', password: 'Example1!',
};

const invalidPasswords = [
  ['short', 'Aa1!aaa'],
  ['missing uppercase', 'password1!'],
  ['missing lowercase', 'PASSWORD1!'],
  ['missing number', 'Password!'],
  ['missing special', 'Password1'],
  ['over 64 characters', `Password1!${'a'.repeat(56)}`],
  ['over 72 UTF-8 bytes', `Password1!${'é'.repeat(32)}`],
];

for (const [label, value] of invalidPasswords) {
  test(`registration rejects password ${label}`, () => {
    const { res, downstreamCalls } = inspect(validateBody(schemas.register), 'body', {
      ...validRegistration, password: value,
    });
    assert.equal(res.statusCode, 400);
    assert.equal(downstreamCalls, 0);
  });
}

test('registration accepts valid composition and login accepts legacy composition', () => {
  assert.equal(inspect(validateBody(schemas.register), 'body', validRegistration).downstreamCalls, 1);
  assert.equal(inspect(validateBody(schemas.login), 'body', {
    email: ' USER@EXAMPLE.TEST ', password: 'legacy-password',
  }).downstreamCalls, 1);
});

function inspect(middleware, source, value) {
  const req = { body: {}, params: {}, query: {} };
  req[source] = value;
  let downstreamCalls = 0;
  const res = {
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  middleware(req, res, (error) => {
    assert.equal(error, undefined);
    downstreamCalls += 1;
  });
  return { req, res, downstreamCalls };
}

const invalidCases = [
  ['invalid registration email', 'body', validateBody(schemas.register), { ...validRegistration, email: 'not-an-email' }],
  ['blank registration name', 'body', validateBody(schemas.register), { ...validRegistration, name: '   ' }],
  ['overlong registration name', 'body', validateBody(schemas.register), { ...validRegistration, name: 'x'.repeat(101) }],
  ['control character in registration name', 'body', validateBody(schemas.register), { ...validRegistration, name: 'User\nA' }],
  ['malformed registration name', 'body', validateBody(schemas.register), { ...validRegistration, name: '<script>' }],
  ['unexpected registration role', 'body', validateBody(schemas.register), { ...validRegistration, role: 'admin' }],
  ['unexpected registration skill field', 'body', validateBody(schemas.register), { ...validRegistration, skillsToTeach: ['Java'] }],
  ['blank skill', 'body', validateBody(schemas.profile, { requireOne: true }), { skillsToTeach: ['  '] }],
  ['overlong skill', 'body', validateBody(schemas.profile, { requireOne: true }), { skillsToTeach: ['x'.repeat(51)] }],
  ['empty profile patch', 'body', validateBody(schemas.profile, { requireOne: true }), {}],
  ['malformed login body', 'body', validateBody(schemas.login), ['user@example.test', 'password']],
  ['missing login password', 'body', validateBody(schemas.login), { email: 'user@example.test' }],
  ['unexpected login field type', 'body', validateBody(schemas.login), { email: { $ne: null }, password: 'example-password' }],
  ['unexpected login body field', 'body', validateBody(schemas.login), { email: 'user@example.test', password: 'Example1!', role: 'admin' }],
  ['invalid user ID', 'params', validateParams(schemas.userId), { id: 'not-an-id' }],
  ['invalid session ID', 'params', validateParams(schemas.sessionId), { id: { $ne: null } }],
  ['invalid review ID', 'params', validateParams(schemas.reviewId), { id: 'abc' }],
  ['invalid role', 'body', validateBody(schemas.role), { role: 'admin' }],
  ['invalid session status', 'body', validateBody(schemas.sessionStatus), { status: 'pending' }],
  ['invalid meeting method', 'body', validateBody(schemas.session), { ...validSession, meetingMethod: 'hybrid' }],
  ['date without timezone', 'body', validateBody(schemas.session), { ...validSession, scheduledAt: '2026-09-25T14:30' }],
  ['impossible date', 'body', validateBody(schemas.session), { ...validSession, scheduledAt: '2026-02-30T14:30:00Z' }],
  ['invalid credit value', 'body', validateBody(schemas.session), { ...validSession, creditAmount: 0 }],
  ['fractional credit value', 'body', validateBody(schemas.session), { ...validSession, creditAmount: 1.5 }],
  ['credit outside current UI range', 'body', validateBody(schemas.session), { ...validSession, creditAmount: 3 }],
  ['invalid rating', 'body', validateBody(schemas.rating), { sessionId: validId, rating: 6 }],
  ['rating with wrong type', 'body', validateBody(schemas.rating), { sessionId: validId, rating: '5' }],
  ['overlong review comment', 'body', validateBody(schemas.rating), { sessionId: validId, rating: 5, comment: 'x'.repeat(501) }],
  ['overlong message', 'body', validateBody(schemas.message), { body: 'x'.repeat(1001) }],
  ['blank message', 'body', validateBody(schemas.message), { body: '   ' }],
  ['invalid coordination link', 'body', validateBody(schemas.coordination, { exactlyOne: true }), { meetingLink: 'http://example.com' }],
  ['conflicting coordination fields', 'body', validateBody(schemas.coordination, { exactlyOne: true }), { meetingLink: 'https://example.com', location: 'Room 1' }],
  ['invalid moderation boolean', 'body', validateBody(schemas.visibility), { hidden: 'true' }],
  ['invalid confirmation payload', 'body', validateBody({}), { credits: 100 }],
  ['malformed query parameter', 'query', validateQuery(schemas.search), { subject: ['Java', 'React'] }],
  ['suspicious regex search input', 'query', validateQuery(schemas.search), { subject: '^(a+)+$' }],
  ['unexpected query parameter', 'query', validateQuery(schemas.search), { subject: 'Java', $where: 'true' }],
  ['unexpected query on fixed endpoint', 'query', validateQuery(), { limit: 100000 }],
];

for (const [label, source, middleware, value] of invalidCases) {
  test(`${label} returns safe 400 before downstream work`, () => {
    const { res, downstreamCalls } = inspect(middleware, source, value);
    assert.equal(res.statusCode, 400);
    assert.equal(downstreamCalls, 0);
    assert.equal(res.body.success, false);
    assert.equal(typeof res.body.message, 'string');
    assert.doesNotMatch(res.body.message, /stack|mongoose|mongodb|jwt|secret|node_modules|[A-Z]:\\/i);
  });
}

test('valid values are normalized and reach downstream work', () => {
  const registration = inspect(validateBody(schemas.register), 'body', {
    ...validRegistration, name: '  User   A  ', email: ' USER@EXAMPLE.TEST ',
  });
  assert.equal(registration.downstreamCalls, 1);
  assert.equal(registration.req.body.name, 'User A');
  assert.equal(registration.req.body.email, 'user@example.test');
  assert.equal(registration.req.body.password, validRegistration.password);
  const session = inspect(validateBody(schemas.session), 'body', validSession);
  assert.equal(session.downstreamCalls, 1);
  assert.equal(session.req.body.scheduledAt, validSession.scheduledAt);
  const subject = inspect(validateQuery(schemas.search), 'query', { subject: ' C++ ' });
  assert.equal(subject.downstreamCalls, 1);
  assert.equal(escapeRegExp(subject.req.validatedQuery.subject), 'C\\+\\+');
});

test('peer discovery treats allowed punctuation as literal text in the database filter', async () => {
  const originalFind = User.find;
  let filter;
  User.find = (value) => {
    filter = value;
    return { select: () => ({ sort: () => ({ limit: async () => [] }) }) };
  };
  try {
    const res = {
      statusCode: 200, body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await searchTutors({ user: { id: validId }, validatedQuery: { subject: 'C++' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(filter.skillsToTeach.$regex, 'C\\+\\+');
    assert.equal(res.body.success, true);
  } finally {
    User.find = originalFind;
  }
});

test('malformed JSON receives a safe 400 and never reaches the handler', async () => {
  const app = express();
  let downstreamCalls = 0;
  app.use(express.json());
  app.post('/test', validateBody(schemas.login), (_req, res) => {
    downstreamCalls += 1;
    res.json({ success: true });
  });
  app.use(validationErrorHandler);
  app.use((_err, _req, res, _next) => res.status(500).json({ message: 'Unexpected server error' }));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/test`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
    });
    assert.equal(response.status, 400);
    assert.equal(downstreamCalls, 0);
    const body = await response.json();
    assert.equal(body.message, 'Malformed JSON request body.');
    assert.doesNotMatch(JSON.stringify(body), /stack|mongoose|mongodb|node_modules/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('oversized JSON receives a safe 413 and never reaches the handler', async () => {
  const app = express();
  let downstreamCalls = 0;
  app.use(express.json({ limit: '100b' }));
  app.post('/test', (_req, res) => {
    downstreamCalls += 1;
    res.json({ success: true });
  });
  app.use(validationErrorHandler);
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/test`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: 'x'.repeat(200) }),
    });
    assert.equal(response.status, 413);
    assert.equal(downstreamCalls, 0);
    const body = await response.json();
    assert.equal(body.message, 'Request body is too large.');
    assert.doesNotMatch(JSON.stringify(body), /stack|mongoose|mongodb|node_modules/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('malformed URL encoding receives a safe 400 before the route handler', async () => {
  const app = express();
  let downstreamCalls = 0;
  app.get('/users/:id', validateParams(schemas.userId), (_req, res) => {
    downstreamCalls += 1;
    res.json({ success: true });
  });
  app.use(validationErrorHandler);
  app.use((_err, _req, res, _next) => res.status(500).json({ message: 'Unexpected server error' }));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/users/%E0%A4%A`);
    assert.equal(response.status, 400);
    assert.equal(downstreamCalls, 0);
    const body = await response.json();
    assert.equal(body.message, 'Malformed URL parameter.');
    assert.doesNotMatch(JSON.stringify(body), /stack|mongoose|mongodb|node_modules/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('actual auth routes reject malformed input before account lookup', async () => {
  const originalFindOne = User.findOne;
  let accountLookups = 0;
  User.findOne = () => { accountLookups += 1; throw new Error('Account lookup should not run'); };
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/authRoutes'));
  app.use(validationErrorHandler);
  app.use((_err, _req, res, _next) => res.status(500).json({ message: 'Unexpected server error' }));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/auth`;
    for (const [endpoint, body] of [
      ['/register', { ...validRegistration, name: '  ' }],
      ['/login', { email: { $ne: null }, password: 'example-password' }],
    ]) {
      const response = await fetch(`${base}${endpoint}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).success, false);
    }
    assert.equal(accountLookups, 0);
  } finally {
    User.findOne = originalFindOne;
    await new Promise((resolve) => server.close(resolve));
  }
});

test('protected routes reject invalid IDs, payloads, and searches before controller queries', async () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalFindById = User.findById;
  const originalFind = User.find;
  const originalFindOne = User.findOne;
  const originalSessionFind = Session.findById;
  const originalSessionCreate = Session.create;
  let businessQueries = 0;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  User.findById = () => ({ select: () => ({ lean: async () => ({
    _id: validId, name: 'Test student', role: 'student', credits: 2,
  }) }) });
  User.find = () => { businessQueries += 1; throw new Error('Discovery query should not run'); };
  User.findOne = () => { businessQueries += 1; throw new Error('User lookup should not run'); };
  Session.findById = () => { businessQueries += 1; throw new Error('Session lookup should not run'); };
  Session.create = () => { businessQueries += 1; throw new Error('Session creation should not run'); };
  const app = express();
  app.use(express.json());
  app.use('/api/users', require('../routes/userRoutes'));
  app.use('/api/sessions', require('../routes/sessionRoutes'));
  app.use('/api/ratings', require('../routes/ratingRoutes'));
  app.use(validationErrorHandler);
  app.use((_err, _req, res, _next) => res.status(500).json({ message: 'Unexpected server error' }));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const token = jwt.sign({ id: validId }, process.env.JWT_SECRET);
    const cases = [
      ['GET', '/users/not-an-id'],
      ['GET', '/users/tutors?subject=%5E(a%2B)%2B%24'],
      ['GET', '/sessions/not-an-id'],
      ['POST', '/sessions', { ...validSession, meetingMethod: 'hybrid' }],
      ['POST', '/ratings', { sessionId: validId, rating: 5, comment: 'x'.repeat(501) }],
    ];
    for (const [method, endpoint, body] of cases) {
      const response = await fetch(`${base}${endpoint}`, {
        method,
        headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      assert.equal(response.status, 400, `${method} ${endpoint}`);
      assert.equal((await response.json()).success, false);
    }
    assert.equal(businessQueries, 0);
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    User.findById = originalFindById;
    User.find = originalFind;
    User.findOne = originalFindOne;
    Session.findById = originalSessionFind;
    Session.create = originalSessionCreate;
    await new Promise((resolve) => server.close(resolve));
  }
});
