import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreAiPractice, cardPosition } from '../src/utils/aiStudyPractice.js';
import { safeStudentReturnPath } from '../src/utils/studyNavigation.js';
import { getPageContext } from '../src/config/roleNavigation.js';
test('AI practice scoring has no reward and requires valid answers', () => {
  const questions = [{ options: ['A', 'B', 'C', 'D'], correctIndex: 0 }, { options: ['A', 'B', 'C', 'D'], correctIndex: 2 }];
  assert.deepEqual(scoreAiPractice(questions, [0, 2]), { correct: 2, total: 2, score: 100, creditsAwarded: 0 });
  assert.equal(scoreAiPractice(questions, [0, 1]).score, 50); assert.equal(scoreAiPractice(questions, [0, null]), null); assert.equal(scoreAiPractice([], []), null);
});
test('Flashcard navigation stays within the set', () => { assert.equal(cardPosition(0, -1, 3), 0); assert.equal(cardPosition(0, 1, 3), 1); assert.equal(cardPosition(2, 1, 3), 2); });
test('AI study links have Learning context and safe login return destinations', () => {
  const id = '507f1f77bcf86cd799439011';
  for (const value of ['/learning/ai-study', '/learning/ai-study?view=mine', '/learning/ai-study/' + id, '/learning/ai-study/' + id + '?rename=1']) assert.equal(safeStudentReturnPath(value), value);
  for (const value of ['//evil.test/learning/ai-study', '/learning/ai-study?view=mine&view=mine', '/learning/ai-study?returnTo=https://evil.test', '/learning/ai-study/bad', '/learning/ai-study/' + id + '#private']) assert.equal(safeStudentReturnPath(value), null);
  assert.equal(getPageContext('/learning/ai-study').title, 'AI Study Tools'); assert.equal(getPageContext('/learning/ai-study', '?view=mine').learning, true);
});
