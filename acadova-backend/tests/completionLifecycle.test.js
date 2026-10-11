const test = require('node:test');
const assert = require('node:assert/strict');
const { completionSettings } = require('../config/completionSettings');
const { completionView } = require('../utils/completionPresentation');
const { schemas, validateBody } = require('../middleware/validation');
test('deadline and staff target configuration are bounded and default to 72/48 hours', () => {
  const names = ['SESSION_VALIDATION_DEADLINE_HOURS', 'SESSION_REVIEW_TARGET_HOURS'];
  const old = names.map((name) => process.env[name]);
  try {
    names.forEach((name) => delete process.env[name]); assert.deepEqual(completionSettings(), { deadlineHours: 72, staffTargetHours: 48 });
    process.env.SESSION_VALIDATION_DEADLINE_HOURS = '96'; assert.equal(completionSettings().deadlineHours, 96);
    for (const value of ['0', '-1', '169', 'bad']) { process.env.SESSION_VALIDATION_DEADLINE_HOURS = value; assert.equal(completionSettings().deadlineHours, 72); }
  } finally { names.forEach((name, index) => { if (old[index] === undefined) delete process.env[name]; else process.env[name] = old[index]; }); }
});
test('completion presentation uses an inclusive deadline but never backfills historical records or disputes', () => {
  const now = new Date('2026-10-10T00:00:00Z');
  const row = { status: 'awaiting_validation', awaitingValidationAt: new Date(now.getTime() - 72 * 3600000),
    startedAt: now, learnerCheckedInAt: now, tutorCheckedInAt: now, validationDeadlineAt: now };
  assert.equal(completionView(row, new Date(now.getTime() - 1)).state, 'pending');
  assert.equal(completionView(row, now).state, 'overdue'); assert.equal(completionView(row, now).canTutorRequestReview, true);
  const legacy = { ...row, validationDeadlineAt: undefined }; assert.equal(completionView(legacy, now).state, 'legacy_pending');
  assert.equal(legacy.validationDeadlineAt, undefined);
  assert.equal(completionView({ ...row, reviewReferral: { id: 'case', targetAt: now } }, now).state, 'referred');
  assert.equal(completionView({ ...row, status: 'disputed' }, now).state, 'disputed');
});
test('API evidence validator rejects server-owned stamps and unsafe/oversized links', () => {
  const body = { summary: 'A useful session summary.', completedWork: 'Completed useful practice exercises.', links: ['https://example.test/work'] };
  for (const links of [['http://example.test'], ['https://a:b@example.test'], Array(6).fill('https://example.test')]) assert.throws(() => schemas.completionEvidence.links(links));
  let reached = false; let status;
  const res = { status(code) { status = code; return this; }, json() {} };
  validateBody(schemas.completionEvidence)({ body: { ...body, submittedBy: 'forged' } }, res, () => { reached = true; });
  assert.equal(reached, false); assert.equal(status, 400);
});
