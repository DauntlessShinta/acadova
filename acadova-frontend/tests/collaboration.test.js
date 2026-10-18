import test from 'node:test'; import assert from 'node:assert/strict';
import { safeStudentReturnPath } from '../src/utils/studyNavigation.js';
import { studyErrors } from '../src/utils/studyQuiz.js';
import { getRoleNavigation, getPageContext } from '../src/config/roleNavigation.js';
test('free study circles use student navigation and do not accept share tokens in login return queries', () => {
  assert.equal(safeStudentReturnPath('/study-together'), '/study-together');
  for (const path of ['/study-together?host=someone', '//evil.test/study-together', '/study-share/' + 'a'.repeat(24) + '#' + 'b'.repeat(64), '/study-together#bad']) assert.equal(safeStudentReturnPath(path), null);
  assert.ok(getRoleNavigation('student').some(row => row.to === '/study-together'));
  assert.equal(getPageContext('/study-together').title, 'Study Together'); assert.equal(getPageContext('/moderator/study-circles').title, 'Circle reports');
});
test('authored flashcard-only sets can be reviewed while incomplete cards remain private drafts', () => {
  const set = { title: 'My authored cards', subject: 'Math', questions: [], flashcards: [{ front: 'Sum', back: 'Result of addition' }] };
  assert.deepEqual(studyErrors(set, true), {}); assert.ok(studyErrors({ ...set, flashcards: [{ front: '', back: '' }] }, true).flashcards);
  assert.deepEqual(studyErrors({ ...set, flashcards: [{ front: '', back: '' }] }), {});
});
