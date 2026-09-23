import test from 'node:test';
import assert from 'node:assert/strict';
import { createRefreshGate } from '../src/utils/refreshGate.js';

test('only one background refresh runs at a time', () => {
  const gate = createRefreshGate();
  const first = gate.start();
  assert.equal(gate.start(), null);
  gate.finish(first);
  assert.notEqual(gate.start(), null);
});

test('mutation/unmount invalidates slow responses without unlocking a newer refresh', () => {
  const gate = createRefreshGate();
  const old = gate.start();
  gate.invalidate();
  const current = gate.start();
  assert.equal(gate.isCurrent(old), false);
  assert.equal(gate.isCurrent(current), true);
  gate.finish(old);
  assert.equal(gate.start(), null);
  gate.finish(current);
  assert.notEqual(gate.start(), null);
});
