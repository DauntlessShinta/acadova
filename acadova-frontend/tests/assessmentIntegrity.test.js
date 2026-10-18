import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateAssessmentTopic, verifiedAssessmentReview, assessmentBelongsToTopic } from '../src/utils/assessmentLearning.js';

test('governed assessment identity takes precedence over a stale matching Topic name', () => {
  const correct = { id: 'governed', name: 'Renamed Mathematics' };
  const other = { id: 'unrelated', name: 'Previous Mathematics' };
  assert.equal(candidateAssessmentTopic({ id: 'a', learningTopic: 'governed', topic: 'Previous Mathematics' }, [correct, other]), correct);
  assert.equal(candidateAssessmentTopic({ id: 'a', learningTopic: 'missing', topic: other.name }, [correct, other]), null);
});

test('stale module attachment cannot prove a cross-Topic assessment return context', () => {
  const topic = { id: 't', name: 'Databases', assessments: [] };
  const module = { id: 'm', topic: 't', assessment: 'foreign', resources: [{ id: 'r' }] };
  const assessment = { id: 'foreign', learningTopic: 'other', topic: 'Databases' };
  assert.equal(verifiedAssessmentReview('foreign', topic, module, 0, assessment), null);
});


test('legacy and shared assessment relationships remain explicit and current', () => {
  const topic = { id: 't', name: 'Databases', assessments: [] };
  const quiz = { id: 'a', learningTopic: 't', topic: 'Previous topic title' };
  for (const id of ['first-module', 'second-module']) assert.equal(verifiedAssessmentReview('a', topic,
    { id, topic: 't', assessment: 'a', resources: [] }, 0, quiz).moduleId, id);
  assert.equal(assessmentBelongsToTopic({ topic: 'Databases' }, topic), true);
  assert.equal(assessmentBelongsToTopic({ learningTopic: null, topic: 'Databases' }, topic), false);
  assert.equal(verifiedAssessmentReview('a', topic, { id: 'stale', topic: 't', assessment: 'a' }), null);
  assert.equal(verifiedAssessmentReview('forged-id', topic, null, 0, quiz), null);
});
