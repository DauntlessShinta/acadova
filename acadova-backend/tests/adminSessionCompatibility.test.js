const test = require('node:test');
const assert = require('node:assert/strict');
const Session = require('../models/Session');
const CreditTransaction = require('../models/CreditTransaction');
const { listSessions } = require('../controllers/adminController');
const { getSessionAnalytics } = require('../controllers/analyticsController');

const originals = { find: Session.find, aggregate: Session.aggregate, paymentFind: CreditTransaction.find };
test.afterEach(() => {
  Session.find = originals.find;
  Session.aggregate = originals.aggregate;
  CreditTransaction.find = originals.paymentFind;
});
const response = () => ({
  statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});
const learner = '507f1f77bcf86cd799439012';
const tutor = '507f1f77bcf86cd799439013';
const row = (id, status, extra = {}) => ({
  _id: id, learner, tutor, status, creditAmount: 2, subject: 'Python', ...extra,
});

test('Admin Session directory interprets historical settlement by ledger, not missing timestamps', async () => {
  const paidId = '507f1f77bcf86cd799439011';
  const unpaidId = '507f1f77bcf86cd799439014';
  const rows = [
    row(paidId, 'completed'), row(unpaidId, 'completed'),
    row('507f1f77bcf86cd799439015', 'accepted'),
    row('507f1f77bcf86cd799439016', 'scheduled'),
    row('507f1f77bcf86cd799439017', 'rejected'),
    row('507f1f77bcf86cd799439018', 'declined'),
    row('507f1f77bcf86cd799439019', 'no_show'),
    row('507f1f77bcf86cd79943901a', 'disputed'),
    row('507f1f77bcf86cd79943901b', 'resolved', {
      resolution: 'cancel_session', disputedAt: new Date(), disputeReason: 'Lesson did not happen.',
      resolvedAt: new Date(), resolvedBy: '507f1f77bcf86cd79943901c',
      resolutionNote: 'No tutoring evidence was found.',
    }),
  ];
  Session.find = () => ({
    select() { return this; }, populate() { return this; }, sort() { return this; },
    lean: async () => rows,
  });
  let paymentQuery;
  CreditTransaction.find = (query) => {
    paymentQuery = query;
    return { select() { return this; }, lean: async () => [{
      session: paidId, fromUser: learner, toUser: tutor, amount: 2, type: 'session_payment',
    }] };
  };
  const res = response();
  await listSessions({}, res);
  assert.equal(res.statusCode, 200);
  assert.equal(paymentQuery.session.$in.length, 3);
  const byId = new Map(res.body.data.map((item) => [item._id, item]));
  assert.equal(byId.get(paidId).canonicalStatus, 'completed');
  assert.equal(byId.get(paidId).ratingEligible, true);
  assert.equal(byId.get(unpaidId).canonicalStatus, 'awaiting_validation');
  assert.equal(byId.get(unpaidId).ratingEligible, false);
  assert.equal(byId.get('507f1f77bcf86cd799439015').canonicalStatus, 'scheduled');
  assert.equal(byId.get('507f1f77bcf86cd799439017').canonicalStatus, 'declined');
  assert.equal(byId.get('507f1f77bcf86cd799439019').canonicalStatus, 'no_show');
  assert.equal(byId.get('507f1f77bcf86cd79943901a').canonicalStatus, 'disputed');
  assert.equal(byId.get('507f1f77bcf86cd79943901b').canonicalStatus, 'resolved');
});

test('Admin analytics retains separate stored counts without alias double-counting', async () => {
  const storedCounts = [
    { _id: 'accepted', count: 2 }, { _id: 'scheduled', count: 3 },
    { _id: 'rejected', count: 1 }, { _id: 'declined', count: 4 },
    { _id: 'in_progress', count: 1 }, { _id: 'awaiting_validation', count: 1 },
    { _id: 'completed', count: 2 }, { _id: 'no_show', count: 1 },
    { _id: 'disputed', count: 1 }, { _id: 'resolved', count: 1 },
  ];
  Session.aggregate = async () => storedCounts;
  const res = response();
  await getSessionAnalytics({}, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.total, 17);
  assert.equal(res.body.data.byStatus.accepted, 2);
  assert.equal(res.body.data.byStatus.scheduled, 3);
  assert.equal(res.body.data.byStatus.rejected, 1);
  assert.equal(res.body.data.byStatus.declined, 4);
  assert.equal(res.body.data.byStatus.resolved, 1);
});
