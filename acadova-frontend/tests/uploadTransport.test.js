import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadResponse } from '../src/services/uploadTransport.js';
class FakeUpload {
  constructor(){this.upload={};this.headers={};}
  open(method,url){this.method=method;this.url=url;}
  setRequestHeader(name,value){this.headers[name]=value;}
  send(body){this.body=body;}
  abort(){this.onabort();}
}
test('upload reports only native measurable bytes and preserves HTTP status/body for central auth handling', async()=>{
  const xhr=new FakeUpload(),events=[];const body=new FormData();body.append('document',new Blob(['synthetic']),'test.pdf');
  const promise=uploadResponse('/api/ai-study/generate',{method:'POST',headers:{Authorization:'Bearer synthetic'},body},event=>events.push(event),()=>xhr);
  assert.equal(xhr.headers.Authorization,'Bearer synthetic');assert.equal(xhr.headers['Content-Type'],undefined);assert.equal(xhr.body,body);
  xhr.upload.onprogress({loaded:10,total:20,lengthComputable:true});xhr.upload.onprogress({loaded:20,total:20,lengthComputable:true});
  xhr.status=401;xhr.responseText='{"message":"Sign in again"}';xhr.onload();
  const response=await promise;assert.equal(response.status,401);assert.equal(response.ok,false);assert.equal((await response.json()).message,'Sign in again');
  assert.deepEqual(events.map(event=>[event.loaded,event.total]),[[10,20],[20,20]]);
});
test('non-measurable upload events do not acquire a fabricated total',async()=>{
  const xhr=new FakeUpload(),events=[];const promise=uploadResponse('/local',{headers:{}},event=>events.push(event),()=>xhr);
  xhr.upload.onprogress({loaded:7,total:0,lengthComputable:false});xhr.status=200;xhr.responseText='{}';xhr.onload();await promise;
  assert.deepEqual(events,[{loaded:7,total:0,lengthComputable:false}]);
});
test('abort and network failure reject without a successful mutation response',async()=>{
  const xhr=new FakeUpload(),controller=new AbortController();const promise=uploadResponse('/local',{signal:controller.signal},()=>{},()=>xhr);controller.abort();await assert.rejects(promise,{name:'AbortError'});
  const second=new FakeUpload();const failed=uploadResponse('/local',{},()=>{},()=>second);second.onerror();await assert.rejects(failed,/could not reach/);
});
