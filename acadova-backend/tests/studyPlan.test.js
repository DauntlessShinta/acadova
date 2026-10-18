const test = require('node:test'); const assert = require('node:assert/strict');
const { ruleNudges } = require('../services/studyPlanService');
const { validators } = require('../controllers/studyPlanController');
const { parse } = require('../utils/academicValidation');
const id = 'a'.repeat(24); const now = Date.UTC(2026, 9, 16, 8);
test('Acadi uses only entered dates, actual status and recent scores; is bounded and dismissible', () => {
  const input = { now, items: [{ _id: id, subjectId: id, title: 'Entered exam', dueAt: new Date(now + 86400000), version: 1, completed: false }, { _id: 'b'.repeat(24), subjectId: id, title: 'Undated task', dueAt: null, version: 1 }],
    modules: [{ _id: 'c'.repeat(24), subjectId: id, title: 'Unreviewed', status: 'not_started' }, { _id: 'd'.repeat(24), subjectId: id, title: 'Completed', status: 'completed' }],
    sets: [{ _id: 'e'.repeat(24), subjectId: id, title: 'Actual practice', origin: 'ai', practiceHistory: [{ at: new Date(now - 1000), score: 40 }] }], attempts: [] };
  const result = ruleNudges(input); assert.equal(result.length, 3); assert.match(result[0].title, /Upcoming/); assert.ok(!JSON.stringify(result).includes('Undated task')); assert.ok(!JSON.stringify(result).includes('Completed'));
  assert.equal(ruleNudges({ ...input, dismissed: result.map(row => row.key) }).length, 0);
  assert.ok(ruleNudges({ ...input, modules: Array.from({ length: 10 }, (_, index) => ({ _id: String(index).padStart(24, '0'), subjectId: id, title: 'No review', status: 'not_started' })) }).length <= 5);
  input.sets[0].practiceHistory[0].at = new Date(now - 31 * 86400000); assert.equal(ruleNudges(input).length, 2);
});
test('study-plan input requires explicit timezone/offset and bounded fields without inferred dates', () => {
  const body = { subjectId: id, kind: 'goal', title: 'Read a chapter', timezone: 'Asia/Manila' };
  const result = parse(body, validators.fields); assert.equal(result.dueAt, undefined);
  assert.equal(parse({ ...body, dueAt: '2026-10-20T09:00:00+08:00' }, validators.fields).dueAt, '2026-10-20T01:00:00.000Z');
  for (const extra of [{ dueAt: '2026-10-20T09:00' }, { dueAt: '2026-02-30T09:00:00Z' }, { timezone: 'Invalid/Zone' }, { owner: id }, { completed: 'true' }]) assert.throws(() => parse({ ...body, ...extra }, validators.fields));
});
