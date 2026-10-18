import test from 'node:test';
import assert from 'node:assert/strict';
import { academicSummary, moduleProgress, subjectProgressState, visibleSubjects } from '../src/utils/academicPresentation.js';

const rows = [
  { id:'a', name:'Databases', courseCode:'ITE 314', instructor:'Maria', section:'Section A', order:2, moduleCount:4, completedCount:2 },
  { id:'b', name:'Algorithms', order:1, moduleCount:0, completedCount:0 },
  { id:'c', name:'Networks', order:3, moduleCount:3, completedCount:3 },
  { id:'d', name:'Old subject', order:0, moduleCount:20, completedCount:20, archived:true },
];
test('academic metrics exclude archives and never claim empty subjects are completed', () => {
  assert.deepEqual(academicSummary(rows), { active:3, total:7, complete:5, completedSubjects:1 });
  assert.equal(subjectProgressState(rows[1]), 'no_completions');
  assert.deepEqual(moduleProgress({moduleCount:4,completedCount:99}), {total:4,complete:4,percent:100});
  assert.deepEqual(moduleProgress({moduleCount:-1,completedCount:2}), {total:0,complete:0,percent:0});
});
test('subject filtering searches real fields and keeps archived records separately discoverable', () => {
  for (const query of ['ite 314',' MARIA ','section a']) assert.deepEqual(visibleSubjects(rows,{query}).map(r=>r.id),['a']);
  assert.deepEqual(visibleSubjects(rows,{filter:'completed'}).map(r=>r.id),['c']);
  assert.deepEqual(visibleSubjects(rows,{filter:'with_progress'}).map(r=>r.id),['a']);
  assert.deepEqual(visibleSubjects(rows,{filter:'no_completions'}).map(r=>r.id),['b']);
  assert.deepEqual(visibleSubjects(rows,{filter:'archived'}).map(r=>r.id),['d']);
  assert.deepEqual(visibleSubjects(rows,{query:'does not exist'}),[]);
});
test('subject ordering is deterministic without mutating API records', () => {
  assert.deepEqual(visibleSubjects(rows).map(r=>r.id),['b','a','c']);
  assert.deepEqual(visibleSubjects(rows,{sort:'name'}).map(r=>r.id),['b','a','c']);
  assert.deepEqual(visibleSubjects(rows,{sort:'progress'}).map(r=>r.id),['c','a','b']);
  assert.deepEqual(rows.map(r=>r.id),['a','b','c','d']);
});
