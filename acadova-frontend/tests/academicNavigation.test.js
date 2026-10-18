import test from 'node:test';
import assert from 'node:assert/strict';
import { safeStudentReturnPath } from '../src/utils/studyNavigation.js';
import { getPageContext } from '../src/config/roleNavigation.js';
test('academic workspace login returns preserve exact internal subject and module destinations', () => {
  const id = '507f1f77bcf86cd799439011';
  for (const path of ['/subjects', `/subjects/${id}`, `/subjects/${id}#module-${id}`, '/dashboard/peer', `/learning/ai-study?subjectId=${id}`, `/learning/ai-study?subjectId=${id}&moduleId=${id}`]) assert.equal(safeStudentReturnPath(path), path);
  for (const path of ['//evil.test/subjects', '/subjects?owner=other', `/subjects/${id}#unexpected`, '/subjects/bad', `/learning/ai-study?moduleId=${id}`, `/learning/ai-study?subjectId=${id}&subjectId=${id}`, `/learning/ai-study?subjectId=${id}&view=mine`, '/learning/ai-study?subjectId=bad']) assert.equal(safeStudentReturnPath(path), null);
  assert.equal(getPageContext('/subjects').title, 'My Subjects'); assert.equal(getPageContext(`/subjects/${id}`).learning, true); assert.equal(getPageContext('/dashboard/peer').title, 'Study Together');
});
