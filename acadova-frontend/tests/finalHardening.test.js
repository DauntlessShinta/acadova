import test from 'node:test';
import assert from 'node:assert/strict';
import { authRecoveryReason } from '../src/utils/authRecovery.js';
import { staffLearningHash, staffLearningSection } from '../src/utils/staffLearningNavigation.js';
import { sessionRequestTimeError } from '../src/utils/sessionRequestTime.js';
import { peerReputation } from '../src/utils/peerReputation.js';

test('only authoritative protected suspension and expiry recover auth; ordinary forbidden and public failures retain it', () => {
  assert.equal(authRecoveryReason('/api/users/me', 403, { code: 'ACCOUNT_SUSPENDED' }), 'suspended');
  assert.equal(authRecoveryReason('/api/sessions/s', 403, { message: 'Forbidden' }), null);
  assert.equal(authRecoveryReason('/api/users/me', 403, { code: 'EMAIL_NOT_VERIFIED' }), null);
  assert.equal(authRecoveryReason('/api/users/me', 401, {}), 'unauthorized');
  assert.equal(authRecoveryReason('/api/auth/login', 403, { code: 'ACCOUNT_SUSPENDED' }), null);
  assert.equal(authRecoveryReason('/api/auth/login', 401, {}), null);
});
test('staff learning has a canonical shareable URL per tab with historical link compatibility', () => {
  for (const section of ['topics', 'resources', 'modules']) {
    assert.equal(staffLearningSection(staffLearningHash(section)), section);
    assert.equal(staffLearningSection(`#manage-${section}`), section);
  }
  assert.equal(staffLearningSection('#unrecognized'), 'topics');
  assert.equal(staffLearningHash('unrecognized'), '#manage-panel-topics');
});
test('request dates use the existing UTC conversion and strict future boundary', () => {
  const now = Date.parse('2030-01-01T00:00:00Z');
  for (const value of ['invalid', '2029-12-31T23:59:59.999Z', '2030-01-01T08:00:00+08:00']) assert.match(sessionRequestTimeError(value, now), /future/);
  assert.match(sessionRequestTimeError('', now), /Enter/);
  assert.equal(sessionRequestTimeError('2030-01-01T08:00:00.001+08:00', now), '');
});
test('unrated/hidden-last/recovered reviews never borrow legacy default stars', () => {
  assert.deepEqual(peerReputation({ rating: 5, ratingCount: 0 }), { label: 'No ratings yet', rated: false });
  assert.equal(peerReputation({ rating: 5 }).label, 'Ratings unavailable');
  assert.equal(peerReputation({ rating: 4, ratingCount: 1 }).label, '4.0 out of 5 · 1 review');
  assert.equal(peerReputation({ rating: 3, ratingCount: 2 }).label, '3.0 out of 5 · 2 reviews');
  assert.equal(peerReputation({ rating: null, ratingCount: 0 }).rated, false);
  assert.equal(peerReputation({ rating: 4, ratingCount: 1 }).rated, true);
});
