import test from 'node:test';
import assert from 'node:assert/strict';
import { resourceSource, learningAccessLabel } from '../src/utils/learningPresentation.js';

test('external resources expose a readable HTTPS source without unsafe or missing links', () => {
  assert.equal(resourceSource('https://www.cloudflare.com/learning/?source=acadova'), 'cloudflare.com');
  for (const value of [undefined, '', '/internal', 'http://example.com', 'javascript:alert(1)', 'data:text/html,hello']) {
    assert.equal(resourceSource(value), '');
  }
});

test('access metadata reflects returned cost/entitlement and does not invent free content', () => {
  assert.equal(learningAccessLabel({ creditCost: 0, locked: false }), 'Free');
  assert.equal(learningAccessLabel({ creditCost: 25, locked: true }), '25 credits');
  assert.equal(learningAccessLabel({ unlocked: true, creditCost: 25 }), 'Unlocked');
  assert.equal(learningAccessLabel({ locked: true }), 'Locked');
  assert.equal(learningAccessLabel({}), '');
});
