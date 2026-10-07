import test from 'node:test';
import assert from 'node:assert/strict';
import { assessmentHref, candidateAssessmentTopic, learningReviewHref, verifiedAssessmentReview } from '../src/utils/assessmentLearning.js';

test('assessment entrances preserve an encoded, optional learning return context', () => {
  const url = new URL(assessmentHref('assessment&other=1', { topicId: 'topic', moduleId: 'module', lessonIndex: 2 }), 'https://fixture.test');
  assert.equal(url.pathname, '/assessments');
  assert.equal(url.searchParams.get('open'), 'assessment&other=1');
  assert.equal(url.searchParams.get('other'), null);
  assert.equal(url.searchParams.get('lesson'), '2');
  assert.equal(assessmentHref('a'), '/assessments?open=a');
  assert.equal(learningReviewHref({ topicId: 't', moduleId: 'm', lessonIndex: 1 }), '/learning?topic=t&module=m&lesson=1');
  assert.equal(learningReviewHref(null), '/learning');
});

test('topic text is only an unambiguous candidate, never proof of an assessment relationship', () => {
  const topic = { id: 't', name: 'Databases', assessments: [] };
  assert.equal(candidateAssessmentTopic({ topic: 'Databases' }, [topic]), topic);
  assert.equal(candidateAssessmentTopic({ topic: 'Databases' }, [topic, { ...topic, id: 'other' }]), null);
  assert.equal(candidateAssessmentTopic({ topic: 'Archived topic' }, [topic]), null);
  assert.equal(verifiedAssessmentReview('a', topic), null);
  assert.deepEqual(verifiedAssessmentReview('a', { ...topic, assessments: [{ id: 'a' }] }), { topicId: 't' });
});

test('a verified module pointer can restore its resource position without treating views as completion', () => {
  const topic = { id: 't', assessments: [] };
  const module = { id: 'm', topic: 't', assessment: 'a', resources: [{ id: 'r1' }, { id: 'r2' }] };
  assert.deepEqual(verifiedAssessmentReview('a', topic, module, 1), { topicId: 't', moduleId: 'm', lessonIndex: 1 });
  assert.equal(verifiedAssessmentReview('wrong', topic, module), null);
  assert.equal(verifiedAssessmentReview('a', topic, { ...module, topic: 'other' }), null);
  assert.equal(verifiedAssessmentReview('a', topic, { id: 'm', topic: 't', locked: true }), null);
  assert.equal(verifiedAssessmentReview('a', topic, module, 999).lessonIndex, 1);
  assert.equal(verifiedAssessmentReview('a', topic, module, -4).lessonIndex, 0);
  assert.equal('completed' in verifiedAssessmentReview('a', topic, module), false);
});
