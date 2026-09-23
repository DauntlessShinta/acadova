const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Session = require('../models/Session');
const Rating = require('../models/Rating');
const { securityHeaders, corsMiddleware } = require('../middleware/httpSecurity');
const { validationErrorHandler } = require('../middleware/validation');
const { apiNotFound, unexpectedError } = require('../middleware/apiErrors');

const learnerId = '507f1f77bcf86cd799439011';
const tutorId = '507f1f77bcf86cd799439012';
const moderatorId = '507f1f77bcf86cd799439013';
const adminId = '507f1f77bcf86cd799439014';
const unrelatedId = '507f1f77bcf86cd799439015';
const sessionId = '507f1f77bcf86cd799439016';

test('API protection and role boundaries work without a database connection', async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  const originalFindById = User.findById;
  const originalFindOne = User.findOne;
  const originalFind = User.find;
  const originalSessionFindById = Session.findById;
  const originalRatingFind = Rating.find;
  const originalRatingExists = Rating.exists;
  const originalConsoleInfo = console.info;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const password = 'do-not-log-this-password';
  const userRoles = new Map([
    [learnerId, 'student'], [tutorId, 'student'], [moderatorId, 'moderator'],
    [adminId, 'admin'], [unrelatedId, 'student'],
  ]);
  let accountLookups = 0;
  let roomReads = 0;
  let reviewReads = 0;
  const logs = [];
  console.info = (line) => logs.push(line);
  User.findById = (id) => ({
    select: () => ({ lean: async () => {
      accountLookups += 1;
      return userRoles.has(String(id)) ? {
        _id: String(id), name: 'Test account', email: 'account@example.test',
        role: userRoles.get(String(id)), credits: 2,
      } : null;
    } }),
  });
  User.findOne = async ({ email }) => email === 'learner@example.test' ? {
    _id: learnerId, name: 'Learner', email, role: 'student', credits: 2,
    password: bcrypt.hashSync(password, 4),
  } : null;
  User.find = (filter) => filter
    ? { select: () => ({ sort: () => ({ limit: async () => [] }) }) }
    : { select: () => ({ sort: async () => [] }) };
  Session.findById = async () => {
    roomReads += 1;
    return {
      _id: sessionId, learner: learnerId, tutor: tutorId, status: 'accepted',
      async populate() {}, toObject() { return { _id: sessionId, status: 'accepted' }; },
    };
  };
  Rating.exists = async () => { reviewReads += 1; return null; };
  Rating.find = () => {
    const query = {
      sort() { return this; }, limit() { return this; }, populate() { return this; },
      then(resolve) { resolve([]); },
    };
    return query;
  };

  const app = express();
  app.use(securityHeaders);
  app.use(corsMiddleware);
  app.use(express.json({ limit: '100kb' }));
  const authRoutePath = require.resolve('../routes/authRoutes');
  const previousAuthRoute = require.cache[authRoutePath];
  delete require.cache[authRoutePath];
  app.use('/api/auth', require('../routes/authRoutes'));
  app.use('/api/users', require('../routes/userRoutes'));
  app.use('/api/sessions', require('../routes/sessionRoutes'));
  app.use('/api/ratings', require('../routes/ratingRoutes'));
  app.use('/api/credits', require('../routes/creditRoutes'));
  app.use('/api/moderator', require('../routes/moderatorRoutes'));
  app.use('/api/admin', require('../routes/adminRoutes'));
  app.use('/api/analytics', require('../routes/analyticsRoutes'));
  app.get('/api/test-error', () => { throw new Error('mongodb://private-host/secret'); });
  app.use('/api', apiNotFound);
  app.use(validationErrorHandler);
  app.use(unexpectedError);
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const tokenFor = (id, options) => jwt.sign({ id, role: 'admin' }, process.env.JWT_SECRET, options);
  const call = async (path, { token, method = 'GET', body, headers = {} } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      ...(body ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
    });
    return { response, data: await response.json() };
  };

  try {
    await t.test('Helmet headers are present and Express signature is absent', async () => {
      const { response } = await call('/missing');
      assert.ok(response.headers.get('content-security-policy'));
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.ok(response.headers.get('strict-transport-security'));
      assert.equal(response.headers.get('x-powered-by'), null);
    });
    await t.test('missing JWT returns 401 before account lookup', async () => {
      const before = accountLookups;
      const { response } = await call('/sessions');
      assert.equal(response.status, 401);
      assert.equal(accountLookups, before);
    });
    await t.test('invalid JWT returns 401 before account lookup', async () => {
      const before = accountLookups;
      const { response } = await call('/sessions', { token: 'invalid.jwt.value' });
      assert.equal(response.status, 401);
      assert.equal(accountLookups, before);
    });
    await t.test('expired JWT returns 401 before account lookup', async () => {
      const before = accountLookups;
      const { response } = await call('/sessions', { token: tokenFor(learnerId, { expiresIn: -1 }) });
      assert.equal(response.status, 401);
      assert.equal(accountLookups, before);
    });
    await t.test('student is denied admin and moderator endpoints despite forged JWT role', async () => {
      const token = tokenFor(learnerId);
      assert.equal((await call('/admin/users', { token })).response.status, 403, JSON.stringify(logs));
      assert.equal((await call('/moderator/ratings', { token })).response.status, 403);
    });
    await t.test('moderator may moderate but cannot manage users or analytics', async () => {
      const token = tokenFor(moderatorId);
      const allowed = await call('/moderator/ratings', { token });
      assert.equal(allowed.response.status, 200);
      assert.deepEqual(allowed.data.data, []);
      assert.equal((await call('/admin/users', { token })).response.status, 403);
      assert.equal((await call(`/admin/users/${learnerId}/role`, {
        token, method: 'PATCH', body: { role: 'moderator' },
      })).response.status, 403);
      assert.equal((await call('/analytics/subjects', { token })).response.status, 403);
    });
    await t.test('admin can read the protected user directory', async () => {
      const result = await call('/admin/users', { token: tokenFor(adminId) });
      assert.equal(result.response.status, 200);
      assert.deepEqual(result.data.data, []);
    });
    await t.test('staff cannot enter student credit, rating, or peer discovery workflows', async () => {
      const token = tokenFor(adminId);
      assert.equal((await call('/credits/mine', { token })).response.status, 403);
      assert.equal((await call('/ratings', { token, method: 'POST', body: { sessionId, rating: 5 } })).response.status, 403);
      assert.equal((await call('/users/tutors', { token })).response.status, 403);
    });
    await t.test('unrelated student cannot open another session or read its review state', async () => {
      const before = reviewReads;
      const denied = await call(`/sessions/${sessionId}`, { token: tokenFor(unrelatedId) });
      assert.equal(denied.response.status, 403);
      assert.equal(reviewReads, before);
    });
    await t.test('participant opens room with a valid token', async () => {
      const opened = await call(`/sessions/${sessionId}`, { token: tokenFor(learnerId) });
      assert.equal(opened.response.status, 200);
      assert.equal(opened.data.data.myReview, false);
      assert.equal(reviewReads, 1);
      assert.ok(roomReads >= 2);
    });
    await t.test('student may use peer discovery with valid authentication', async () => {
      const found = await call('/users/tutors', { token: tokenFor(learnerId) });
      assert.equal(found.response.status, 200);
      assert.deepEqual(found.data.data, []);
    });
    await t.test('login response excludes password and JWT has only minimal claims', async () => {
      const result = await call('/auth/login', {
        method: 'POST', body: { email: 'learner@example.test', password },
      });
      assert.equal(result.response.status, 200);
      assert.equal(result.data.data.user.password, undefined);
      assert.doesNotMatch(JSON.stringify(result.data.data.user), /do-not-log-this-password/);
      assert.deepEqual(Object.keys(jwt.decode(result.data.data.token)).sort(), ['exp', 'iat', 'id', 'role']);
    });
    await t.test('unknown API route returns a safe 404', async () => {
      const { response, data } = await call('/no-such-route');
      assert.equal(response.status, 404);
      assert.deepEqual(data, { success: false, message: 'API route not found' });
    });
    await t.test('internal errors return safe 500 without raw details', async () => {
      const { response, data } = await call('/test-error');
      assert.equal(response.status, 500);
      assert.deepEqual(data, { success: false, message: 'Unexpected server error' });
      assert.doesNotMatch(logs.join('\n'), /mongodb:\/\/private-host/);
    });
    await t.test('oversized JSON returns safe 413', async () => {
      const { response, data } = await call('/auth/login', {
        method: 'POST', body: { email: 'learner@example.test', password: 'x'.repeat(110000) },
      });
      assert.equal(response.status, 413);
      assert.equal(data.message, 'Request body is too large.');
    });
    await t.test('CORS permits the local frontend and rejects other origins', async () => {
      const allowed = await call('/no-such-route', { headers: { origin: 'http://localhost:5173' } });
      assert.equal(allowed.response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
      const denied = await call('/no-such-route', { headers: { origin: 'https://not-acadova.example' } });
      assert.equal(denied.response.status, 403);
      assert.equal(denied.response.headers.get('access-control-allow-origin'), null);
      assert.equal(denied.data.message, 'Origin not allowed');
    });
    await t.test('message writes are limited per account without blocking room reads', async () => {
      const token = tokenFor(learnerId);
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const { response } = await call(`/sessions/${sessionId}/messages`, {
          token, method: 'POST', body: { body: '' },
        });
        assert.equal(response.status, 400);
      }
      const limited = await call(`/sessions/${sessionId}/messages`, {
        token, method: 'POST', body: { body: '' },
      });
      assert.equal(limited.response.status, 429);
      assert.equal((await call(`/sessions/${sessionId}`, { token })).response.status, 200);
    });
    await t.test('excessive login attempts reach 429 without logging credentials', async () => {
      let limited = false;
      for (let attempt = 0; attempt < 22; attempt += 1) {
        const { response } = await call('/auth/login', {
          method: 'POST', body: { email: 'absent@example.test', password },
        });
        if (response.status === 429) { limited = true; break; }
        assert.equal(response.status, 401);
      }
      assert.equal(limited, true);
      assert.ok(logs.some((line) => line.includes('rate_limit.exceeded')));
      assert.ok(logs.some((line) => line.includes('access.role_denied')));
      assert.ok(logs.some((line) => line.includes('auth.login_failed')));
      assert.doesNotMatch(logs.join('\n'), /do-not-log-this-password|Bearer |mongodb:\/\/private-host/);
    });
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    User.findById = originalFindById;
    User.findOne = originalFindOne;
    User.find = originalFind;
    Session.findById = originalSessionFindById;
    Rating.find = originalRatingFind;
    Rating.exists = originalRatingExists;
    console.info = originalConsoleInfo;
    delete require.cache[authRoutePath];
    if (previousAuthRoute) require.cache[authRoutePath] = previousAuthRoute;
    await new Promise((resolve) => server.close(resolve));
  }
});
