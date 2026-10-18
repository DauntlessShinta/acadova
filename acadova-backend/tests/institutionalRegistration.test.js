const test = require('node:test');
const assert = require('node:assert/strict');
const { registrationDomains, normalizeInstitutionalEmail } = require('../config/institutionalRegistration');
const auth = require('../controllers/authController');
const User = require('../models/User');
const mongoose = require('mongoose');
const googleIdentity = require('../services/googleIdentityService');
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('registration has one approved exact domain and safe, explicit normalization', () => {
  assert.deepEqual(registrationDomains({}), ['phinmaed.com']);
  assert.equal(normalizeInstitutionalEmail('  First.Last_1@PHINMAED.COM  ', {}), 'first.last_1@phinmaed.com');
  for (const address of ['a@gmail.com', 'a@yahoo.com', 'a@outlook.com', 'a@sub.phinmaed.com',
    'a@phinmaed.com.evil.test', 'a@evilphinmaed.com', 'a@phinmaed.com.', 'a@phinmaed.com@evil.test',
    'a+alias@phinmaed.com', 'a..b@phinmaed.com', 'a\u200b@phinmaed.com', 'a@phіnmaed.com']) {
    assert.equal(normalizeInstitutionalEmail(address, {}), null, address);
  }
  assert.throws(() => registrationDomains({ STUDENT_EMAIL_DOMAINS: '' }));
  assert.throws(() => registrationDomains({ STUDENT_EMAIL_DOMAINS: '*.phinmaed.com' }));
  assert.deepEqual(registrationDomains({ STUDENT_EMAIL_DOMAINS: 'PHINMAED.COM,phinmaed.com' }), ['phinmaed.com']);
});

test('backend refuses personal, suffix and alias registrations before any database write', async t => {
  const original = User.findOne;
  User.findOne = () => { throw new Error('Rejected registration must not query an account'); };
  t.after(() => { User.findOne = original; });
  for (const email of ['a@gmail.com', 'a@sub.phinmaed.com', 'a@phinmaed.com.evil.test', 'a+alias@phinmaed.com']) {
    const res = response();
    await auth.register({ body: { email, name: 'Student One', password: 'Password1!' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, 'INSTITUTIONAL_EMAIL_REQUIRED');
    assert.equal(res.body.data, undefined);
  }
});

test('case-normalized duplicate registration never replaces credentials or exposes account state', async t => {
  const original = User.findOne;
  let queried;
  User.findOne = query => { queried = query.email; return { lean: async () => ({ emailVerified: false, role: 'student' }) }; };
  t.after(() => { User.findOne = original; });
  const first = response();
  await auth.register({ body: { email: '  USER@PHINMAED.COM ', password: 'Different1!' } }, first);
  assert.equal(queried, 'user@phinmaed.com');
  User.findOne = () => ({ lean: async () => ({ emailVerified: true, role: 'admin' }) });
  const second = response();
  await auth.register({ body: { email: 'user@phinmaed.com' } }, second);
  assert.equal(first.statusCode, 201);
  assert.deepEqual(first.body, second.body);
  assert.equal(first.body.data, undefined);
});

test('new Google identities cannot bypass institutional registration', async t => {
  const originals = { findOne: User.findOne, startSession: mongoose.startSession, verify: googleIdentity.verifyGoogleCredential };
  t.after(() => { User.findOne = originals.findOne; mongoose.startSession = originals.startSession; googleIdentity.verifyGoogleCredential = originals.verify; });
  googleIdentity.verifyGoogleCredential = async () => ({ email: 'student@gmail.com', sub: 'verified-google-sub' });
  User.findOne = () => ({ select() { return this; }, lean() { return this; }, session: async () => null });
  mongoose.startSession = async () => ({ withTransaction: async fn => fn(), endSession: async () => {} });
  const res = response();
  await auth.googleLogin({ body: { credential: 'synthetic', policyAccepted: true } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'INSTITUTIONAL_EMAIL_REQUIRED');
  assert.equal(res.body.data, undefined);
});
