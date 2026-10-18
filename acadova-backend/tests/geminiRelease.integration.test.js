// Explicit reuse of the already running disposable manual-QA replica set.
// Never reads dotenv/URI configuration, creates a database or drops one.
const test=require('node:test');const assert=require('node:assert/strict');const mongoose=require('mongoose');
const express=require('express');const jwt=require('jsonwebtoken');const {randomBytes}=require('node:crypto');
const User=require('../models/User');const Set=require('../models/StudySet');const Quota=require('../models/AiStudyQuota');const Preview=require('../models/AiStudyPreview');
const Term=require('../models/AcademicTerm');const Subject=require('../models/PersonalSubject');const Module=require('../models/PersonalModule');const Resource=require('../models/AcademicResource');
const strict=require('./fixtures/strictStudyDocuments.cjs');const basic=require('./fixtures/aiStudyDocuments.cjs');
test('configured real-provider route contracts with mocked Gemini on the existing isolated QA database',{skip:process.env.ACADOVA_REAL_GEMINI_DB_TESTS!=='1'},async t=>{
  assert.equal(process.env.NODE_ENV,'test');
  const health=await(await fetch('http://127.0.0.1:5002/api/health')).json();
  assert.equal(health.manualAllRoles,true);assert.equal(health.expActive,false);assert.match(health.database,/^acadova_manual_qa_[a-f0-9]{32}$/);
  await mongoose.connect(`mongodb://127.0.0.1:27031/${health.database}?replicaSet=acadovaAiQA`,{serverSelectionTimeoutMS:5000});
  const hello=await mongoose.connection.db.admin().command({hello:1});assert.equal(hello.setName,'acadovaAiQA');assert.deepEqual(hello.hosts,['127.0.0.1:27031']);
  const oldSecret=process.env.JWT_SECRET;process.env.JWT_SECRET=randomBytes(48).toString('hex');
  const owners=[];let server;
  t.after(async()=>{
    if(server)await new Promise(resolve=>server.close(resolve));
    assert.equal(mongoose.connection.name,health.database);
    // Only IDs created by this test; no named/manual QA record is updated/deleted.
    if(owners.length){for(const Model of [Set,Term,Subject,Module,Resource,Preview])await Model.deleteMany({owner:{$in:owners}});await Quota.deleteMany({_id:{$in:owners}});await User.deleteMany({_id:{$in:owners}});}
    await mongoose.disconnect();if(oldSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=oldSecret;
  });
  for(const label of ['a','b']){const u=await User.create({name:'Release integration synthetic '+label,email:`gemini-release-${randomBytes(8).toString('hex')}@example.test`,password:'not-a-login-account',role:'student',emailVerified:true,credits:0});owners.push(u._id);}
  const [a,b]=owners;
  const term=await Term.create({owner:a,startYear:2026,endYear:2027,semester:'Integration only'});
  const subject=await Subject.create({owner:a,termId:term._id,name:'Isolated integration source'});
  const module=await Module.create({owner:a,subjectId:subject._id,title:'Source module'});const source=strict.source();
  const resource=await Resource.create({owner:a,subjectId:subject._id,moduleId:module._id,title:'Owned synthetic file',kind:'pptx',fileName:'integration.pptx',bytes:source.buffer.length,content:source.buffer});
  let behavior='valid';let providerCalls=0;
  const provider={async generate({document,type,mode}){providerCalls++;if(behavior==='empty')return{title:'Insufficient source',flashcards:[],questions:[]};if(behavior==='outage')throw Object.assign(new Error('Synthetic provider unavailable'),{status:429,code:'AI_STUDY_PROVIDER_LIMIT'});const output=mode==='strict_source'?strict.output(document):basic.output();return{...output,...(type==='quiz'?{flashcards:[]}:type==='flashcards'?{questions:[]}:{}),modelVersion:'mock-only'};}};
  const config=require('../config/aiStudy').aiStudyConfig({NODE_ENV:'production',AI_STUDY_ENABLED:'true',AI_STUDY_LOCAL_QA:'false',GEMINI_API_KEY:'not-a-real-provider-key'});
  const app=express();app.use(express.json());app.use('/api/ai-study',require('../routes/aiStudyRoutes').createAiStudyRouter({provider,configFor:()=>config}));app.use(require('../middleware/validation').validationErrorHandler);
  server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const root=`http://127.0.0.1:${server.address().port}/api/ai-study`;
  const token=owner=>jwt.sign({id:String(owner)},process.env.JWT_SECRET);
  const call=async(path,owner=a,method='GET',body)=>{const r=await fetch(root+path,{method,headers:{Authorization:'Bearer '+token(owner),'Content-Type':'application/json','Idempotency-Key':randomBytes(16).toString('hex')},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,body:await r.json()};};
  const payload={resourceId:String(resource._id),sourceId:source.sourceId,type:'both',mode:'strict_source',count:1,providerConsent:true};let preview,saved;
  await t.test('explicit external-processing consent, source ownership and source identity precede any provider call',async()=>{
    assert.equal((await call('/generate-resource',a,'POST',{...payload,providerConsent:undefined,syntheticConsent:true})).status,400);
    assert.equal((await call('/generate-resource',b,'POST',payload)).status,404);
    assert.equal((await call('/generate-resource',a,'POST',{...payload,sourceId:'f'.repeat(64)})).status,409);assert.equal(providerCalls,0);
    const status=await call('/status');assert.equal(status.body.data.enabled,true);assert.equal(status.body.data.syntheticOnly,false);assert.ok(!JSON.stringify(status).includes(config.apiKey));
  });
  await t.test('actual stored PPTX extraction, strict evidence, edited-answer rejection and once-only source-associated save',async()=>{
    const response=await call('/generate-resource',a,'POST',payload);assert.equal(response.status,200);preview=response.body.data;assert.equal(preview.ai.sourceId,source.sourceId);
    const bad=structuredClone({flashcards:preview.flashcards,questions:preview.questions});bad.flashcards[0].back='Fabricated answer';
    assert.equal((await call('/sets',a,'POST',{previewId:preview.previewId,title:'Invalid edits',content:bad})).status,400);
    const body={previewId:preview.previewId,title:'Verified private integration set',content:{flashcards:preview.flashcards,questions:preview.questions},subjectId:String(subject._id),moduleId:String(module._id)};
    const result=await call('/sets',a,'POST',body);assert.equal(result.status,201);saved=result.body.data;
    assert.equal(String(saved.subjectId),String(subject._id));assert.equal(String(saved.moduleId),String(module._id));assert.ok(saved.sourceResourceIds.includes(String(resource._id)));
    assert.equal((await call('/sets',a,'POST',body)).body.data.id,saved.id);assert.equal(await Set.countDocuments({owner:a}),1);
    assert.equal((await call('/sets/'+saved.id,b)).status,404);assert.equal((await call('/sources/'+resource._id,b)).status,404);
  });
  await t.test('insufficient-source failure creates no saved set or preview and does not invent a result',async()=>{
    behavior='empty';const count=await Set.countDocuments({owner:a});const result=await call('/generate-resource',a,'POST',payload);assert.equal(result.status,422);assert.equal(result.body.code,'AI_STUDY_INSUFFICIENT_SOURCE');assert.equal(await Set.countDocuments({owner:a}),count);assert.equal(await Preview.countDocuments({owner:a}),0);behavior='valid';
  });
  await t.test('real-mode PDF multipart consent and standard review edits remain validated and privately linked',async()=>{
    const data=new FormData();data.append('document',new Blob([basic.pdf()]),'integration.pdf');data.append('type','both');data.append('mode','standard');data.append('providerConsent','true');
    const r=await fetch(root+'/generate',{method:'POST',headers:{Authorization:'Bearer '+token(a),'Idempotency-Key':randomBytes(16).toString('hex')},body:data});const p=await r.json();assert.equal(r.status,200);
    const content={flashcards:p.data.flashcards,questions:p.data.questions};content.flashcards[0].front='Reviewed: what input is required?';
    const result=await call('/sets',a,'POST',{previewId:p.data.previewId,title:'Reviewed standard private set',content,subjectId:String(subject._id),moduleId:String(module._id)});assert.equal(result.status,201);assert.equal(result.body.data.flashcards[0].front,content.flashcards[0].front);
    assert.equal(String(result.body.data.moduleId),String(module._id));assert.equal(result.body.data.origin,'ai');
  });
  await t.test('provider outage stays an explicit failure and AI workflows never change credits or activate EXP',async()=>{
    behavior='outage';const data=new FormData();data.append('document',new Blob([basic.pdf()]),'integration.pdf');data.append('type','both');data.append('providerConsent','true');
    const r=await fetch(root+'/generate',{method:'POST',headers:{Authorization:'Bearer '+token(b),'Idempotency-Key':randomBytes(16).toString('hex')},body:data});assert.equal(r.status,429);assert.equal(await Set.countDocuments({owner:b}),0);
    assert.ok((await User.find({_id:{$in:owners}}).lean()).every(u=>u.credits===0));assert.equal(await require('../models/CreditTransaction').countDocuments({$or:[{fromUser:{$in:owners}},{toUser:{$in:owners}}]}),0);assert.equal(require('../config/growthPolicy').EXP_ACTIVE,false);
  });
});
