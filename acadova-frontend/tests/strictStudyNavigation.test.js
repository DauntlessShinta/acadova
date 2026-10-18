import test from 'node:test'; import assert from 'node:assert/strict';
import { safeStudentReturnPath } from '../src/utils/studyNavigation.js';
test('stored-source quiz/flashcard destinations survive login without permitting foreign redirects', () => {
  const id = '507f1f77bcf86cd799439011';
  const route = `/learning/ai-study?subjectId=${id}&moduleId=${id}&resourceId=${id}&format=quiz`;
  assert.equal(safeStudentReturnPath(route), route);
  assert.equal(safeStudentReturnPath(route.replace('format=quiz', 'format=flashcards')), route.replace('format=quiz', 'format=flashcards'));
  for (const value of [route + '&resourceId=' + id, route.replace('format=quiz', 'format=unknown'), route.replace('resourceId=' + id, 'resourceId=https://evil.test'), route.replace('/learning', '//evil.test/learning')]) assert.equal(safeStudentReturnPath(value), null);
});
