import test from 'node:test';
import assert from 'node:assert/strict';
import { safeSessionReturnPath, proposalTarget, proposalTargetMessage } from '../src/utils/sessionNavigation.js';
const sessionId = '507f1f77bcf86cd799439011';
const id = '11111111-2222-4333-8444-555555555555';
const path = `/sessions/${sessionId}?target=proposal&proposalId=${id}#session-proposal`;
test('Session return destinations allow exact internal actions and reject redirect tricks', () => {
  assert.equal(safeSessionReturnPath(path), path);
  assert.equal(safeSessionReturnPath(`/sessions/${sessionId}#session-messages`), `/sessions/${sessionId}#session-messages`);
  for (const value of ['https://evil.test' + path, '//evil.test' + path, '/admin', '/sessions/../admin',
    '/sessions/\\evil.test', `/sessions/${sessionId}?returnTo=https://evil.test`, path + '&x=1',
    `/sessions/${sessionId}?target=proposal&proposalId=${id}&proposalId=${id}#session-proposal`,
    `/sessions/${sessionId}%0a`, `/sessions/${sessionId}?target=proposal&proposalId=invalid#session-proposal`]) {
    assert.equal(safeSessionReturnPath(value), null, value);
  }
});
test('proposal targets distinguish latest, expired, replaced, withdrawn and missing links', () => {
  assert.equal(proposalTarget(`?target=proposal&proposalId=${id}`, '#session-proposal'), id);
  assert.equal(proposalTarget('?target=proposal', ''), 'missing');
  assert.equal(proposalTarget('', ''), null);
  const row = { rescheduleProposalId: id, proposalStatus: 'active' };
  assert.equal(proposalTargetMessage(row, id), '');
  assert.match(proposalTargetMessage({ ...row, proposalStatus: 'expired' }, id), /expired/);
  for (const outcome of ['withdrawn', 'replaced', 'expired', 'accepted', 'declined', 'check_in_locked']) {
    assert.ok(proposalTargetMessage({ rescheduleHistory: [{ proposalId: id, outcome }] }, id));
  }
  assert.match(proposalTargetMessage(row, 'missing'), /no longer available/);
});
