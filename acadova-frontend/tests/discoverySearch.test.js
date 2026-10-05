import test from 'node:test';
import assert from 'node:assert/strict';
import { discoveryDestination, discoveryQueryError, filterLearningTopics, learningTopicTitle } from '../src/utils/discoverySearch.js';

test('scoped discovery uses existing routes and safely encodes teaching subjects', () => {
  assert.equal(discoveryDestination('tutors', '  C++ & Java  '), '/tutors?subject=C%2B%2B%20%26%20Java');
  assert.equal(discoveryDestination('learning', '数学'), '/learning?q=%E6%95%B0%E5%AD%A6');
  assert.equal(discoveryDestination('tutors', ' '), '/tutors');
  assert.equal(discoveryDestination('learning', ''), '/learning');
  assert.ok(discoveryQueryError('tutors', 'a'.repeat(81)));
  assert.ok(discoveryQueryError('tutors', 'Java.*'));
  assert.equal(discoveryQueryError('tutors', 'C++'), '');
});

test('published titles and legacy names share presentation and search without changing records', () => {
  const topics = [{ title: 'Programming Fundamentals', description: 'Learn the basics' }, { name: 'Mathematics' }];
  const original = structuredClone(topics);
  assert.equal(learningTopicTitle(topics[0]), 'Programming Fundamentals');
  assert.equal(learningTopicTitle(topics[1]), 'Mathematics');
  assert.equal(learningTopicTitle({ title: ' ', name: ' Legacy title ' }), 'Legacy title');
  assert.equal(learningTopicTitle({ title: 'Current', name: 'Legacy' }), 'Current');
  assert.equal(learningTopicTitle({}), 'Untitled topic');
  assert.deepEqual(filterLearningTopics(topics, 'programming'), [topics[0]]);
  assert.deepEqual(filterLearningTopics(topics, 'mathematics'), [topics[1]]);
  assert.deepEqual(filterLearningTopics(topics, 'undefined'), []);
  assert.deepEqual(topics, original);
});

test('topic filtering searches returned names/descriptions without inventing results', () => {
  const topics = [{ id: 'one', name: 'Python', description: 'Functions and loops' }, { id: 'two', name: '数学' }];
  assert.deepEqual(filterLearningTopics(topics, ' LOOPs '), [topics[0]]);
  assert.deepEqual(filterLearningTopics(topics, '数学'), [topics[1]]);
  assert.deepEqual(filterLearningTopics(topics, 'Java'), []);
  assert.equal(filterLearningTopics(topics, ''), topics);
});
