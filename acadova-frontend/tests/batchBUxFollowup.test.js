import test from 'node:test';
import assert from 'node:assert/strict';
import { addToast, dismissToast, makeToast } from '../src/utils/toastState.js';
import { mergeSessionMessages } from '../src/utils/sessionMessages.js';
import { googleMeetHome, isGoogleClientConfigured } from '../src/utils/googleConfig.js';

test('toast state accepts success/error, sanitizes non-text feedback, and dismisses by id', () => {
  let toasts = addToast([], makeToast('success', 'Saved', 1));
  toasts = addToast(toasts, makeToast('error', 'Could not save', 2));
  assert.deepEqual(toasts.map(({ type, message }) => [type, message]), [
    ['success', 'Saved'], ['error', 'Could not save'],
  ]);
  assert.equal(makeToast('error', { raw: 'backend object' }, 3).message, 'Please try again.');
  assert.equal(makeToast('warning', 'Take care', 4).type, 'warning');
  assert.equal(makeToast('info', 'Checking', 5).type, 'info');
  assert.deepEqual(dismissToast(toasts, 1).map(({ id }) => id), [2]);
});

test('message refresh merges duplicates and retains a just-sent message missing from a stale poll', () => {
  const first = { _id: '1', body: 'first', createdAt: '2026-10-01T00:00:00Z' };
  const sent = { _id: '2', body: 'draft sent', createdAt: '2026-10-01T00:01:00Z' };
  const stale = mergeSessionMessages([first, sent], [{ ...first, sender: { name: 'Peer' } }]);
  assert.deepEqual(stale.map((message) => message._id), ['1', '2']);
  assert.equal(stale[0].sender.name, 'Peer');
  assert.deepEqual(mergeSessionMessages(stale, [first, sent]).map((message) => message._id), ['1', '2']);
});

test('unconfigured Google controls stay hidden while manual Meet fallback remains safe', () => {
  assert.equal(isGoogleClientConfigured(undefined), false);
  assert.equal(isGoogleClientConfigured('  '), false);
  assert.equal(isGoogleClientConfigured('replace-me'), false);
  assert.equal(isGoogleClientConfigured('1234-example.apps.googleusercontent.com'), true);
  const url = new URL(googleMeetHome);
  assert.equal(url.origin, 'https://meet.google.com');
});
