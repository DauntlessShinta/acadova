import test from 'node:test';
import assert from 'node:assert/strict';
import { safeEvidenceLink, evidenceErrors, completionCopy } from '../src/utils/completionPresentation.js';
import { safeSessionReturnPath } from '../src/utils/sessionNavigation.js';
test('evidence accepts bounded HTTPS links, rejecting credentials/schemes/invalid text without fetching', () => {
  for (const value of ['https://example.test/work', 'https://example.test/work?q=1']) assert.equal(safeEvidenceLink(value), true);
  for (const value of ['http://example.test', 'javascript:alert(1)', 'https://user:pass@example.test', 'data:text/plain,test', 'https://example.test/' + 'a'.repeat(500)]) assert.equal(safeEvidenceLink(value), false);
  const valid = { summary: 'Session summary here.', completedWork: 'Completed several learning exercises.', links: [] };
  assert.deepEqual(evidenceErrors(valid), {});
  assert.ok(evidenceErrors({ ...valid, links: Array(6).fill('https://example.test') }).links);
  assert.ok(evidenceErrors({ ...valid, summary: 'short' }).summary);
});
test('completion states never imply silence, finish or referral approves payment', () => {
  assert.match(completionCopy({ status: 'awaiting_validation', completionReview: { state: 'overdue' } }), /Silence does not approve/);
  assert.match(completionCopy({ status: 'awaiting_validation', reviewReferral: { source: 'system_overdue' } }), /does not guarantee payment/);
  assert.match(completionCopy({ status: 'awaiting_validation' }), /Historical session/);
  assert.match(completionCopy({ status: 'resolved', resolution: 'cancel_session' }), /No credits transferred/);
  assert.match(completionCopy({ status: 'in_progress' }), /separately confirm/);
  assert.match(completionCopy({ status: 'completed' }), /awaits Learner confirmation/);
  assert.match(completionCopy({ status: 'no_show' }), /No credits transferred/);
  const path = '/sessions/507f1f77bcf86cd799439011#session-completion';
  assert.equal(safeSessionReturnPath(path), path);
  assert.equal(safeSessionReturnPath('https://evil.test' + path), null);
});
