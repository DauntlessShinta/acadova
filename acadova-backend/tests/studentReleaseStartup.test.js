const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
// Exercise the actual server module with in-memory connection/listen/provider
// boundaries. No dotenv file, network connection, timer or port is opened.
function boot(){
  const uses=[],gets=[],timers=[],errors=[];let resolve,connectOptions,replayed=0,indexChecks=0,rejectIndexes=false;
  const app={use:(...v)=>uses.push(v),get:(...v)=>gets.push(v),listen:()=>{}};
  const express=()=>app;express.json=express.static=()=>()=>{};
  const ignored=new Proxy({},{get:()=>()=>{}});
  const moduleFor=name=>{
    if(name==='express')return express;if(name==='mongoose')return {connection:{db:{}},connect:(_uri,opts)=>{connectOptions=opts;return new Promise(r=>{resolve=r;});}};
    if(name==='dotenv')return {config:()=>{}};if(name==='dns')return {setServers:()=>{},setDefaultResultOrder:()=>{}};
    if(name==='path')return require('node:path');if(name==='express-mongo-sanitize')return {sanitize:v=>v};
    if(name==='./config/studentExperience')return require('../config/studentExperience');
    if(name==='./config/studentReleaseSafety')return require('../config/studentReleaseSafety');
    if(name==='./services/studentReleaseReadiness')return {verifyStudentIndexes:async()=>{indexChecks++;if(rejectIndexes)throw Error('Synthetic metadata mismatch');}};
    if(name==='./services/growthReplay')return {replayBatch:async()=>{replayed++;}};
    if(name==='./config/apiIdentity')return {apiIdentity:()=>({revision:'synthetic'})};
    return ignored;
  };
  const context={require:moduleFor,__dirname:'synthetic-source',process:{env:{}},console:{log:()=>{},error:value=>errors.push(value)},setInterval:fn=>{timers.push(fn);return {unref(){}};}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../server'),'utf8'),context);
  return {uses,gets,timers,errors,options:()=>connectOptions,replayed:()=>replayed,indexChecks:()=>indexChecks,ready:async fail=>{rejectIndexes=fail;resolve();await new Promise(r=>setImmediate(r));}};
}
const response=()=>({code:200,status(n){this.code=n;return this;},json(body){this.body=body;return this;}});
test('actual startup never admits API/EXP replay before required metadata, and disables automatic DDL',async()=>{
  const b=boot();assert.equal(b.options().autoCreate,false);assert.equal(b.options().autoIndex,false);assert.equal(b.options().dbName,'acadova');
  const guard=b.uses.find(v=>v[0]==='/api'&&typeof v[1]==='function')[1];const health=b.gets.find(v=>v[0]==='/api/health').at(-1);
  let admitted=false;const res=response();guard({path:'/sessions'},res,()=>{admitted=true;});assert.equal(res.code,503);assert.equal(admitted,false);
  const early=response();health({},early);assert.equal(early.code,503);b.timers[0]();assert.equal(b.replayed(),0);
  await b.ready(false);assert.equal(b.indexChecks(),1);guard({path:'/sessions'},response(),()=>{admitted=true;});assert.equal(admitted,true);
  const ready=response();health({},ready);assert.equal(ready.code,200);assert.equal(ready.body.databaseReady,true);assert.equal(ready.body.studentExperience.freeLearning,true);
  b.timers[0]();assert.equal(b.replayed(),1);
});
test('actual index-readiness rejection leaves admission/health fail-closed and background replay stopped',async()=>{
  const b=boot();await b.ready(true);const guard=b.uses.find(v=>v[0]==='/api'&&typeof v[1]==='function')[1];
  const res=response();guard({path:'/auth/login'},res,()=>assert.fail('Unexpected admission'));assert.equal(res.code,503);
  const health=response();b.gets.find(v=>v[0]==='/api/health').at(-1)({},health);assert.equal(health.code,503);b.timers[0]();assert.equal(b.replayed(),0);assert.deepEqual(b.errors,['DB Connection Error']);
});
