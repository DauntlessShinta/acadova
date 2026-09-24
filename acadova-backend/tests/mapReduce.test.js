const test = require('node:test');
const assert = require('node:assert/strict');
const Session = require('../models/Session');
const { getSubjectAnalytics } = require('../controllers/analyticsController');
const { runSubjectDemandMapReduce } = require('../utils/mapReduce');

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('subject demand handles ordinary and prototype-named subjects with repeated records', async () => {
  const subjects = ['Java', 'constructor', '__proto__', 'toString', '__proto__', 'Java'];
  const expected = [
    { subject: 'Java', requestCount: 2 },
    { subject: '__proto__', requestCount: 2 },
    { subject: 'constructor', requestCount: 1 },
    { subject: 'toString', requestCount: 1 },
  ];
  const rows = subjects.map((subject) => ({ subject }));
  assert.deepEqual(runSubjectDemandMapReduce(rows), expected);

  const originalFind = Session.find;
  Session.find = async () => rows;
  try {
    const res = response();
    await getSubjectAnalytics({}, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data, expected);
  } finally {
    Session.find = originalFind;
  }
});
