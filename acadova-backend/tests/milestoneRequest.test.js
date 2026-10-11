const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Session = require('../models/Session');
const User = require('../models/User');
const CreditConfig = require('../models/CreditConfig');
const CreditTransaction = require('../models/CreditTransaction');
const notifications = require('../services/notificationService');
const { createSession } = require('../controllers/sessionController');
const { validateBody, schemas } = require('../middleware/validation');
const base = { tutorId: '507f1f77bcf86cd799439013', subject: 'Java', scheduledAt: '2099-10-15T06:00:00Z' };
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('new requests default online, normalize optional messages, reject unsafe payloads and never pay', async t => {
  const originals = [];
  const stub = (object, key, value) => { originals.push([object, key, object[key]]); object[key] = value; };
  t.after(() => originals.forEach(([object, key, value]) => { object[key] = value; }));
  let stored = []; let notified = 0;
  stub(mongoose, 'startSession', async () => ({ withTransaction: async fn => fn(), endSession: async () => {} }));
  stub(User, 'findOneAndUpdate', () => ({ select: async () => ({ _id: base.tutorId, skillsToTeach: ['Java'] }) }));
  stub(Session, 'find', () => ({ session() { return this; }, lean: async () => [] }));
  stub(Session, 'exists', () => ({ session: async () => null }));
  stub(Session, 'create', async ([data]) => { stored.push(data); return [{ ...data, populate: async () => {} }]; });
  stub(CreditConfig, 'findById', () => ({ lean: async () => null }));
  stub(CreditTransaction, 'create', async () => assert.fail('Requests must not pay'));
  stub(notifications, 'notifySession', async () => { notified++; });
  for (const fields of [{}, { requestMessage: '' }, { requestMessage: ' \n ' }, { requestMessage: '  Help with arrays  ', meetingMethod: 'online' }, { requestMessage: 'x'.repeat(500) }]) {
    const req = { body: { ...base, ...fields }, user: { id: '507f1f77bcf86cd799439012', credits: 100 } };
    const res = response(); let valid = false;
    validateBody(schemas.session)(req, res, () => { valid = true; });
    assert.equal(valid, true);
    await createSession(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(stored.at(-1).meetingMethod, 'online');
    assert.equal(stored.at(-1).requestMessage, fields.requestMessage?.trim() || '');
  }
  assert.equal(notified, 5);
  for (const fields of [{ meetingMethod: 'in-person' }, { meetingMethod: null }, { meetingMethod: 'remote' }, { requestMessage: null }, { requestMessage: {} }, { requestMessage: 12 }, { requestMessage: 'x'.repeat(501) }, { location: 'Library' }]) {
    const req = { body: { ...base, ...fields } }; const res = response();
    validateBody(schemas.session)(req, res, () => assert.fail('Invalid request reached controller'));
    assert.equal(res.statusCode, 400);
    if (!Object.hasOwn(fields, 'location')) { const direct = response(); await createSession(req, direct); assert.equal(direct.statusCode, 400); }
  }
  assert.equal(stored.length, 5);
  const historical = new Session({ learner: '507f1f77bcf86cd799439012', tutor: base.tutorId, subject: 'Java', meetingMethod: 'in-person', location: 'Library', creditAmount: 20 });
  assert.equal(historical.validateSync(), undefined, 'Historical in-person records remain model-compatible');
});
