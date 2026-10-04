import test from 'node:test';
import assert from 'node:assert/strict';
import { getSessionTimeline } from '../src/utils/sessionPresentation.js';
import { readLearningResume, saveLearningResume } from '../src/utils/learningResume.js';

test('Session timeline marks only evidence-backed steps complete', () => {
  const pending = getSessionTimeline({ status: 'pending', scheduledAt: '2026-10-10T06:00:00Z' });
  assert.equal(pending[0].state, 'done');
  assert.equal(pending[1].state, 'current');
  assert.equal(pending[2].state, 'waiting');
  const scheduled = getSessionTimeline({ status: 'scheduled', scheduledAt: '2026-10-10T06:00:00Z' });
  assert.equal(scheduled[1].state, 'done');
  assert.equal(scheduled[2].state, 'done');
  assert.equal(scheduled[3].state, 'waiting');
  const inProgress = getSessionTimeline({ status: 'in_progress',
    learnerCheckedInAt: '2026-10-10T06:00:00Z', tutorCheckedInAt: '2026-10-10T06:01:00Z',
    startedAt: '2026-10-10T06:01:00Z' });
  assert.equal(inProgress[3].state, 'done');
  assert.equal(inProgress[4].state, 'done');
  assert.equal(inProgress[5].state, 'waiting');
  const awaiting = getSessionTimeline({ status: 'awaiting_validation',
    learnerConfirmedAt: '2026-10-10T07:00:00Z' });
  assert.equal(awaiting[5].state, 'current');
  assert.equal(awaiting[6].state, 'waiting');
  const completed = getSessionTimeline({ status: 'completed',
    learnerConfirmedAt: '2026-10-10T07:00:00Z', tutorConfirmedAt: '2026-10-10T07:01:00Z',
    creditsSettledAt: '2026-10-10T07:01:00Z' });
  assert.equal(completed[5].state, 'done');
  assert.equal(completed[6].state, 'done');
});

test('learning resume is per Student and does not claim lesson completion', () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  saveLearningResume('student-a', { topicId: 'topic', moduleId: 'module',
    moduleTitle: 'JavaScript Basics', lessonIndex: 2 });
  assert.deepEqual(readLearningResume('student-a'), { topicId: 'topic', moduleId: 'module',
    moduleTitle: 'JavaScript Basics', lessonIndex: 2 });
  assert.equal(readLearningResume('student-b'), null);
  assert.equal(Object.keys(readLearningResume('student-a')).includes('completed'), false);
  delete globalThis.localStorage;
});
