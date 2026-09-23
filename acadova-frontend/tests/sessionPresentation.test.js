import test from 'node:test';
import assert from 'node:assert/strict';
import { toSessionInstant, formatSessionDateTime } from '../src/utils/sessionPresentation.js';

test('local scheduling preserves the selected instant in Asia/Manila', () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'Asia/Manila';
    assert.equal(toSessionInstant('2026-09-25T14:30'), '2026-09-25T06:30:00.000Z');
    assert.equal(new Date(toSessionInstant('2026-09-25T14:30')).getHours(), 14);
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test('explicit offsets and UTC values preserve the same instant', () => {
  assert.equal(toSessionInstant('2026-09-25T14:30:00+08:00'), '2026-09-25T06:30:00.000Z');
  assert.equal(toSessionInstant('2026-09-25T06:30:00.000Z'), '2026-09-25T06:30:00.000Z');
});

test('missing and invalid dates do not become API requests', () => {
  for (const value of ['', undefined, 'not-a-date']) assert.throws(() => toSessionInstant(value));
  assert.equal(formatSessionDateTime(undefined), null);
});

test('session display includes the viewer timezone', () => {
  const instant = '2026-09-25T06:30:00.000Z';
  const zone = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
    .formatToParts(new Date(instant)).find((part) => part.type === 'timeZoneName').value;
  assert.ok(formatSessionDateTime(instant).includes(zone));
});
