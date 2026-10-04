import test from 'node:test';
import assert from 'node:assert/strict';
import { canCompletePolicyReview, hasReachedPolicyEnd } from '../src/utils/policyReview.js';

test('policy review unlocks only when the modal scroll region reaches its end', () => {
  assert.equal(hasReachedPolicyEnd({ scrollTop: 0, clientHeight: 300, scrollHeight: 900 }), false);
  assert.equal(hasReachedPolicyEnd({ scrollTop: 591, clientHeight: 300, scrollHeight: 900 }), false);
  assert.equal(hasReachedPolicyEnd({ scrollTop: 592, clientHeight: 300, scrollHeight: 900 }), true);
  assert.equal(hasReachedPolicyEnd({ scrollTop: 600, clientHeight: 300, scrollHeight: 900 }), true);
  assert.equal(hasReachedPolicyEnd({ scrollTop: 0, clientHeight: 900, scrollHeight: 900 }), true);
});

test('scrolling or checking alone cannot complete policy review', () => {
  assert.equal(canCompletePolicyReview(false, false), false);
  assert.equal(canCompletePolicyReview(false, true), false);
  assert.equal(canCompletePolicyReview(true, false), false);
  assert.equal(canCompletePolicyReview(true, true), true);
});
