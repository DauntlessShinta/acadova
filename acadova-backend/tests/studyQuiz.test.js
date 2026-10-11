const test = require('node:test');
const assert = require('node:assert/strict');
const { studyContent, gradeStudy } = require('../utils/studyQuiz');
const valid = { title: 'Arrays', subject: 'Java', description: '', questions: [{ prompt: 'First index?', options: ['0', '1'], correctIndex: 0, explanation: 'Starts at zero.' }] };
test('private study drafts may be unfinished but valid start/publication requires complete bounded MCQs', () => {
  assert.equal(studyContent({title:'',subject:'',questions:[]}).questions.length,0);
  assert.throws(()=>studyContent({title:'',subject:'',questions:[]},true));
  for (const question of [{...valid.questions[0],correctIndex:null},{...valid.questions[0],options:['a',' A ']},{...valid.questions[0],options:['','a']},{...valid.questions[0],correctIndex:2}]) assert.throws(()=>studyContent({...valid,questions:[question]},true));
  assert.throws(()=>studyContent({...valid,state:'published'}));assert.throws(()=>studyContent({...valid,questions:Array(51).fill(valid.questions[0])}));
  assert.deepEqual(gradeStudy(studyContent(valid,true),[0]),{score:100,correct:1,total:1});
  assert.deepEqual(gradeStudy(valid,[1]),{score:0,correct:0,total:1});assert.throws(()=>gradeStudy(valid,[-1]));
});
