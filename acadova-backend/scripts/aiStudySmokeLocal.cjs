// OPTIONAL real-provider smoke. Never invoked by npm test or the application.
// Reuses .env.ai-qa privately and the existing disposable QA database; no new DB.
const path=require('node:path');const fs=require('node:fs');const {randomBytes}=require('node:crypto');
const required=['--confirm-synthetic-gemini','--owner-approved-provider-charges','--confirm-rotated-credentials'];
if(required.some(flag=>!process.argv.includes(flag))||process.env.NODE_ENV==='production'){
  console.error('Not run: requires explicit owner approval of provider access/charges and completed credential rotation. See the Gemini/Render readiness report.');process.exit(1);
}
const mongoose=require('mongoose');const express=require('express');const jwt=require('jsonwebtoken');const assert=require('node:assert/strict');
const {aiStudyConfig,requireConfigured}=require('../config/aiStudy');
const User=require('../models/User');const Set=require('../models/StudySet');const Quota=require('../models/AiStudyQuota');const Preview=require('../models/AiStudyPreview');
const {pdf}=require('../tests/fixtures/aiStudyDocuments.cjs');
let server;let owner;let database;const oldSecret=process.env.JWT_SECRET;
(async()=>{
  // Parse only this explicit file; never fall through to main .env or copy secrets.
  const env=require('dotenv').parse(fs.readFileSync(path.resolve(__dirname,'../.env.ai-qa')));
  const config=aiStudyConfig({...env,NODE_ENV:'development'});requireConfigured(config);
  const health=await(await fetch('http://127.0.0.1:5002/api/health')).json();
  assert.equal(health.manualAllRoles,true);assert.equal(health.expActive,false);assert.match(health.database,/^acadova_manual_qa_[a-f0-9]{32}$/);database=health.database;
  await mongoose.connect(`mongodb://127.0.0.1:27031/${database}?replicaSet=acadovaAiQA`,{serverSelectionTimeoutMS:5000});
  const hello=await mongoose.connection.db.admin().command({hello:1});assert.equal(hello.setName,'acadovaAiQA');assert.deepEqual(hello.hosts,['127.0.0.1:27031']);
  owner=(await User.create({name:'Synthetic authorized smoke account',email:`gemini-smoke-${randomBytes(16).toString('hex')}@example.test`,password:randomBytes(32).toString('hex'),role:'student',emailVerified:true,credits:0}))._id;
  process.env.JWT_SECRET=randomBytes(48).toString('hex');const token=jwt.sign({id:String(owner)},process.env.JWT_SECRET);
  const app=express();app.use(express.json());app.use('/api/ai-study',require('../routes/aiStudyRoutes').createAiStudyRouter({configFor:()=>config}));
  server=await new Promise(resolve=>{const value=app.listen(0,'127.0.0.1',()=>resolve(value));});const root=`http://127.0.0.1:${server.address().port}/api/ai-study`;
  const request=async(endpoint,body,multipart=false)=>{
    const response=await fetch(root+endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,...(multipart?{'Idempotency-Key':randomBytes(16).toString('hex')}:{'Content-Type':'application/json'})},body:multipart?body:JSON.stringify(body)});
    if(!response.ok)throw Object.assign(new Error('Live provider smoke failed.'),{status:response.status});return(await response.json()).data;
  };
  const data=new FormData();data.append('document',new Blob([pdf()]),'synthetic-binary-search.pdf');data.append('type','both');data.append(config.syntheticOnly?'syntheticConsent':'providerConsent','true');
  const preview=await request('/generate',data,true);const saved=await request('/sets',{previewId:preview.previewId,title:'Synthetic live-provider smoke'});
  const reload=await fetch(root+'/sets/'+saved.id,{headers:{Authorization:'Bearer '+token}});assert.equal(reload.status,200);
  const score=await request('/sets/'+saved.id+'/practice',{answers:saved.questions.map(q=>q.correctIndex)});assert.equal(score.creditsAwarded,0);assert.equal((await User.findById(owner)).credits,0);
  assert.equal(require('../config/growthPolicy').EXP_ACTIVE,false);
  console.log('PASS: one approved real-provider generation, private save/reload/practice, zero credit/EXP awards. Provider output and credentials omitted. This is not a deployed-module acceptance test.');
})().catch(error=>{console.error('Live smoke failed'+(Number.isInteger(error.status)?' (HTTP '+error.status+')':'')+'. No secret values or provider output disclosed.');process.exitCode=1;}).finally(async()=>{
  if(server)await new Promise(resolve=>server.close(resolve));
  if(owner&&mongoose.connection.name===database){for(const Model of[Set,Preview])await Model.deleteMany({owner});await Quota.deleteOne({_id:owner});await User.deleteOne({_id:owner});}
  await mongoose.disconnect();if(oldSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=oldSecret;
});
