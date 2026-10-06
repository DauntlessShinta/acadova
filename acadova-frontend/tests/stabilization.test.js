import test from 'node:test';
import assert from 'node:assert/strict';
import { canCancelSession, getSessionTimeline } from '../src/utils/sessionPresentation.js';

test('canonical scheduled cancellation ends at first attendance or settlement evidence', () => {
  assert.equal(canCancelSession({ status: 'scheduled' }), true);
  assert.equal(canCancelSession({ status: 'pending' }), true);
  assert.equal(canCancelSession({ status: 'accepted' }), true);
  for (const field of ['startedAt', 'learnerCheckedInAt', 'tutorCheckedInAt', 'creditsSettledAt', 'confirmedAt']) {
    assert.equal(canCancelSession({ status: 'scheduled', [field]: 'recorded' }), false);
  }
  for (const status of ['in_progress', 'awaiting_validation', 'completed', 'declined', 'cancelled', 'resolved', 'no_show']) {
    assert.equal(canCancelSession({ status }), false);
  }
});

test('stopped terminal outcomes preserve recorded evidence and mark remaining progress not applicable', () => {
  for (const status of ['declined', 'rejected', 'cancelled', 'resolved']) {
    const steps = getSessionTimeline({ status, resolution: 'cancel_session' });
    assert.equal(steps[0].state, 'done');
    assert.ok(steps.slice(1).every((step) => ['done', 'stopped'].includes(step.state)), status);
    assert.equal(steps.at(-1).state, 'stopped');
  }
  const recorded = getSessionTimeline({ status: 'resolved', resolution: 'cancel_session', startedAt: 'recorded',
    learnerCheckedInAt: 'recorded', tutorCheckedInAt: 'recorded' });
  assert.equal(recorded[3].state, 'done'); assert.equal(recorded[4].state, 'done');
  assert.equal(recorded[5].state, 'stopped');
  assert.equal(getSessionTimeline({ status: 'pending' })[1].state, 'current');
});
