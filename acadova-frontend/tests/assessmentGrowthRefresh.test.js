import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function service(post) {
  const events=[];
  const source=fs.readFileSync(new URL('../src/services/assessmentService.js',import.meta.url),'utf8')
    .replace("import api from './api';",'const api = boundary;')
    .replace('export const assessmentService','const assessmentService')
    .replace('export default assessmentService;','globalThis.subject=assessmentService;');
  const context=vm.createContext({boundary:{post},Event,window:{dispatchEvent:event=>events.push(event.type)}});
  vm.runInContext(source,context);
  return {subject:context.subject,events};
}

test('official assessment refresh is emitted only after a persisted response, without changing returned award evidence',async()=>{
  let finish,request;
  const {subject,events}=service((url,body)=>{request={url,body};return new Promise(resolve=>{finish=resolve;});});
  const result=subject.submit('synthetic-assessment',[0,1]);
  assert.equal(events.length,0);
  assert.equal(request.url,'/api/assessments/synthetic-assessment/submit');
  assert.deepEqual(request.body.answers,[0,1]);
  const saved={success:true,data:{score:100,exp:{status:'processing'}}};
  finish(saved);assert.equal(await result,saved);
  assert.deepEqual(events,['acadova:growth-refresh']);
});

test('failed official submissions and private practice never announce an EXP refresh or synthesize an award',async()=>{
  const failed=service(async()=>{throw new Error('Synthetic persistence failure');});
  await assert.rejects(failed.subject.submit('synthetic',[0]),/persistence failure/);
  assert.deepEqual(failed.events,[]);
  const response={data:{mode:'practice',rewardIssued:false}};
  const practice=service(async()=>response);
  assert.equal(await practice.subject.practice('synthetic',[0]),response);
  assert.deepEqual(practice.events,[]);
});
