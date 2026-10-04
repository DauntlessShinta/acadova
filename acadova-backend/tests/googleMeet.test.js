const test = require('node:test');
const assert = require('node:assert/strict');
const Session = require('../models/Session');
const User = require('../models/User');
const googleMeet = require('../services/googleMeetService');
const sessionController = require('../controllers/sessionController');

const learner = '507f1f77bcf86cd799439011';
const tutor = '507f1f77bcf86cd799439012';
const stranger = '507f1f77bcf86cd799439013';
const sessionId = '507f1f77bcf86cd799439014';
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; } });

test('Google Calendar service uses a transient bearer token and accepts only a Meet URL', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('userinfo')) return { ok: true, json: async () =>
      ({ sub: 'google-sub', email: 'tutor@example.test', email_verified: true }) };
    return { ok: true, json: async () => ({ id: 'calendar-event',
      hangoutLink: 'https://meet.google.com/abc-defg-hij' }) };
  };
  assert.equal(await googleMeet.verifyCalendarIdentity('temporary-provider-token',
    { googleSub: 'google-sub', email: 'tutor@example.test' }), true);
  assert.equal(await googleMeet.verifyCalendarIdentity('temporary-provider-token',
    { googleSub: 'different-sub', email: 'tutor@example.test' }), false);
  const link = await googleMeet.createGoogleMeet({ accessToken: 'temporary-provider-token',
    subject: 'Python', scheduledAt: '2026-10-10T06:00:00.000Z' });
  assert.equal(link, 'https://meet.google.com/abc-defg-hij');
  assert.ok(calls.every((call) => call.options.headers.Authorization === 'Bearer temporary-provider-token'));
  assert.ok(calls.every((call) => !call.url.includes('temporary-provider-token')
    && !JSON.stringify(call.options.body || '').includes('temporary-provider-token')));
  const event = JSON.parse(calls.at(-1).options.body);
  assert.equal(event.conferenceData.createRequest.conferenceSolutionKey.type, 'hangoutsMeet');
  assert.equal(event.end.dateTime, '2026-10-10T07:00:00.000Z');
  assert.equal(googleMeet.validMeetUrl('https://evil.example/abc-defg-hij'), false);
  assert.equal(googleMeet.validMeetUrl('https://meet.google.com.evil.example/abc-defg-hij'), false);
});

test('only the scheduled Tutor can save a generated Meet; failures leave Session unchanged', async (t) => {
  const original = { find: Session.findById, update: Session.findOneAndUpdate,
    user: User.findById, verify: googleMeet.verifyCalendarIdentity,
    create: googleMeet.createGoogleMeet };
  t.after(() => {
    Session.findById = original.find; Session.findOneAndUpdate = original.update;
    User.findById = original.user; googleMeet.verifyCalendarIdentity = original.verify;
    googleMeet.createGoogleMeet = original.create;
  });
  const session = { _id: sessionId, learner, tutor, subject: 'Python', status: 'scheduled',
    meetingMethod: 'online', scheduledAt: new Date('2026-10-10T06:00:00.000Z'),
    async populate() {} };
  Session.findById = async () => session;
  User.findById = () => ({ select: () => ({ lean: async () =>
    ({ email: 'tutor@example.test', googleSub: 'google-sub' }) }) });
  googleMeet.verifyCalendarIdentity = async () => true;
  let providerCalls = 0;
  let saves = 0;
  googleMeet.createGoogleMeet = async () => {
    providerCalls += 1; return 'https://meet.google.com/abc-defg-hij';
  };
  Session.findOneAndUpdate = async (filter, update) => {
    saves += 1;
    assert.equal(filter.meetingLink.$exists, false);
    Object.assign(session, update.$set);
    return session;
  };
  const call = async (actor) => {
    const res = response();
    await sessionController.generateGoogleMeet({ params: { id: sessionId },
      user: { id: actor }, body: { accessToken: 'temporary-provider-token' } }, res);
    return res;
  };
  assert.equal((await call(stranger)).statusCode, 403);
  assert.equal((await call(learner)).statusCode, 403);
  assert.equal(providerCalls, 0);
  googleMeet.verifyCalendarIdentity = async () => false;
  assert.equal((await call(tutor)).statusCode, 403);
  googleMeet.verifyCalendarIdentity = async () => true;
  googleMeet.createGoogleMeet = async () => { throw new Error('provider secret'); };
  const failed = await call(tutor);
  assert.equal(failed.statusCode, 502);
  assert.equal(session.meetingLink, undefined);
  assert.equal(saves, 0);
  googleMeet.createGoogleMeet = async () => {
    providerCalls += 1; return 'https://meet.google.com/abc-defg-hij';
  };
  assert.equal((await call(tutor)).statusCode, 200);
  assert.equal(session.meetingLink, 'https://meet.google.com/abc-defg-hij');
  assert.equal(saves, 1);
  assert.equal((await call(tutor)).statusCode, 409);
  assert.equal(providerCalls, 1);
});
