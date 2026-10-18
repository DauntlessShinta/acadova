import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleAssessments, moveLesson } from '../src/utils/learningCurriculum.js';

test('module picker uses governed topic IDs and supports only ungoverned legacy name matches', () => {
  const topic = { id: 'python', name: 'Python Foundations' };
  const assessments = [
    { id: 'governed', learningTopic: 'python', topic: 'Old Python Name', status: 'published' },
    { id: 'legacy', topic: 'Python Foundations', status: 'published' },
    { id: 'null-legacy', learningTopic: null, topic: 'Python Foundations', status: 'published' },
    { id: 'wrong-governed', learningTopic: 'other', topic: 'Python Foundations', status: 'published' },
    { id: 'draft', learningTopic: 'python', topic: 'Python Foundations', status: 'draft' },
    { id: 'unrelated', topic: 'Java', status: 'published' },
  ];
  assert.deepEqual(moduleAssessments(assessments, topic).map((item) => item.id), ['governed', 'legacy']);
  assert.deepEqual(moduleAssessments(assessments, null), []);
});

test('lesson moves preserve IDs, assessment-independent ordering, and the original draft', () => {
  const original = Object.freeze(['first', 'second', 'third']);
  const moved = moveLesson(original, 2, -1);
  assert.deepEqual(moved, ['first', 'third', 'second']);
  assert.deepEqual(moveLesson(moved, 1, -1), ['third', 'first', 'second']);
  assert.deepEqual(moveLesson(moved, 1, 1), original);
  assert.equal(moveLesson(original, 0, -1), original);
  assert.equal(moveLesson(original, 2, 1), original);
  assert.equal(moveLesson(original, -1, 1), original);
  assert.equal(moveLesson(original, 3, -1), original);
  assert.equal(moveLesson(original, 1, 2), original);
});


test('Topic workspace hashes preserve four sections and legacy global links', async () => {
  const { staffLearningSection, staffTopicSection } = await import('../src/utils/staffLearningNavigation.js');
  assert.equal(staffTopicSection(''), 'modules');
  assert.equal(staffTopicSection('#manage-panel-assessments'), 'assessments');
  assert.equal(staffTopicSection('#manage-panel-settings'), 'settings');
  assert.equal(staffTopicSection('#manage-resources'), 'resources');
  assert.equal(staffLearningSection('#manage-panel-resources'), 'resources');
  assert.equal(staffLearningSection('#manage-panel-settings'), 'topics');
});
