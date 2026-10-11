import test from 'node:test';import assert from 'node:assert/strict';
import { studyErrors, emptyStudySet, emptyStudyQuestion } from '../src/utils/studyQuiz.js';
test('study editor distinguishes saveable unfinished drafts from quiz/publication eligibility',()=>{
 assert.deepEqual(studyErrors(emptyStudySet()),{});assert.ok(studyErrors(emptyStudySet(),true).questions);
 const draft={title:'Arrays',subject:'Java',description:'',questions:[{...emptyStudyQuestion(),prompt:'First index?',options:['0','1'],correctIndex:0}]};
 assert.deepEqual(studyErrors(draft,true),{});draft.questions[0].correctIndex=null;assert.ok(studyErrors(draft,true)['questions.0.prompt']);
});
