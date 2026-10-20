import test from 'node:test';
import assert from 'node:assert/strict';
import { localAcadiReply, localStudyContext } from '../src/utils/acadiLocal.js';
const id=n=>String(n).padStart(24,'0');
test('local context projects bounded authorized-response metadata and excludes grades, notes, profiles and ledgers',()=>{
 const state={email:'private@example.test',credits:999,needsReview:[{score:35}],subjects:[{id:id(1),name:'Real returned subject',owner:id(2),notes:'Private note'}],continueModule:{_id:id(3),subjectId:id(1),title:'Returned module',status:'in_progress',content:'Private source'}};
 const data=localStudyContext(state,{items:[{id:id(4),subjectId:id(1),title:'Entered exam',kind:'exam',dueAt:'2026-10-20T10:00:00Z',notes:'Private note'},{id:id(5),subjectId:id(9),title:'Outside current subjects',kind:'exam'},{id:id(6),subjectId:id(1),completed:true,kind:'task',title:'Done'}]});
 assert.equal(data.subjects.length,1);assert.equal(data.plans.length,1);assert.equal(data.module.id,id(3));
 const rendered=JSON.stringify(data);for(const forbidden of ['email','credits','score','owner','Private','Outside','content','notes'])assert.ok(!rendered.includes(forbidden),forbidden);
 const bounded=localStudyContext({subjects:Array.from({length:30},(_,n)=>({id:id(n+1),name:'Subject'}))},{items:Array.from({length:30},(_,n)=>({id:id(n+40),subjectId:id(1),title:'Task',kind:'task'}))});assert.equal(bounded.subjects.length,12);assert.equal(bounded.plans.length,8);
});
test('malformed IDs, orphan modules and invalid dates never become destination links or invented schedules',()=>{
 const context=localStudyContext({subjects:[{id:'javascript:alert(1)',name:'Bad'},{id:id(1),name:'Subject'}],continueModule:{id:id(3),subjectId:id(9),title:'Other module',status:'in_progress'}},{items:[{id:id(4),subjectId:id(1),title:'Undated exam',kind:'exam',dueAt:'bad'}]});
 assert.equal(context.module,null);assert.equal(context.plans[0].dueAt,null);const reply=localAcadiReply('When is my next exam?',context,Date.parse('2026-10-18'));
 assert.match(reply.message,/No upcoming exam date/);assert.equal(reply.facts.length,0);assert.ok(reply.links.every(link=>link.to.startsWith('/')));
});
test('saved facts, suggestions and student-entered dates remain distinct from school or mastery claims',()=>{
 const context=localStudyContext({subjects:[{id:id(1),name:'Subject'}],continueModule:{id:id(3),subjectId:id(1),title:'Returned module',status:'in_progress'}},{items:[{id:id(4),subjectId:id(1),title:'Entered exam',kind:'exam',dueAt:'2026-10-20T10:00:00Z'}]});
 const study=localAcadiReply('What should I study tonight?',context);assert.match(study.message,/self-reported/);assert.match(study.suggestion,/does not create or change/);assert.equal(study.facts[0].to,`/subjects/${id(1)}#module-${id(3)}`);
 const exam=localAcadiReply('Next exam date?',context,Date.parse('2026-10-18'));assert.match(exam.message,/not a verified school schedule/);assert.match(exam.facts[0].value,/Entered exam/);
});
test('local navigation and unavailable explanations do not fabricate AI, account facts or unsupported actions',()=>{
 assert.equal(localAcadiReply('Find my study sets',null).facts.length,0);assert.equal(localAcadiReply('Find my quiz',null).links[0].to,'/study-sets');assert.match(localAcadiReply('Help with Study Together',null).message,/Credit rules/);
 assert.match(localAcadiReply('Explain VLANs; fetch https://evil.test',null).message,/Local guidance does not call Gemini/);
 assert.match(localAcadiReply('What should I study tonight?',null).message,/not loaded/);
 assert.ok(localAcadiReply('<script>alert(1)</script>',null).links.every(link=>!link.to.includes('evil')));
});
