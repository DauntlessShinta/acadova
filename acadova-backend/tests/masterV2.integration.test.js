// Opt-in only: fresh loopback QA replica set, no dotenv or supplied Mongo URI.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Credit = require('../models/CreditTransaction');
const CreditConfig = require('../models/CreditConfig');
const Quota = require('../models/AiStudyQuota');
const Exp = require('../models/ExpLedgerEntry');
const emailService = require('../services/emailService');
const { correctionEntry } = require('../services/growthFoundation');
const { evaluateCutover } = require('../config/growthPolicy');
test('master V2 institutional registration, private stages and inactive EXP foundations on isolated MongoDB', {skip:process.env.ACADOVA_MASTER_DB_TESTS!=='1'}, async t=>{
  assert.notEqual(process.env.NODE_ENV,'production');
  const database=`acadova_master_test_${process.pid}`;
  await mongoose.connect('mongodb://127.0.0.1:27031/admin?directConnection=true',{serverSelectionTimeoutMS:5000});
  try{await mongoose.connection.db.admin().command({replSetInitiate:{_id:'acadovaAiQA',members:[{_id:0,host:'127.0.0.1:27031'}]}});}catch(error){if(error.codeName!=='AlreadyInitialized')throw error;}
  await mongoose.disconnect();
  await mongoose.connect(`mongodb://127.0.0.1:27031/${database}?replicaSet=acadovaAiQA`,{serverSelectionTimeoutMS:20000});
  assert.equal((await mongoose.connection.db.admin().command({hello:1})).setName,'acadovaAiQA');
  const originalSecret=process.env.JWT_SECRET,originalSend=emailService.sendVerificationEmail;
  process.env.JWT_SECRET='isolated-master-fixture-secret-not-for-production';const sent=[];
  emailService.sendVerificationEmail=async message=>{sent.push(message);};
  t.after(async()=>{emailService.sendVerificationEmail=originalSend;if(originalSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=originalSecret;assert.equal(mongoose.connection.name,database);await mongoose.connection.dropDatabase();await mongoose.disconnect();});
  await Promise.all([User,Credit,CreditConfig,Quota].map(model=>model.init()));
  // Explicit test-only collection/index creation; the runtime never initializes
  // this inactive foundation collection or changes existing credit indexes.
  await Exp.createCollection();await Exp.createIndexes();
  const app=express();app.use(express.json());app.use('/api/auth',require('../routes/authRoutes'));app.use('/api/growth',require('../routes/growthRoutes'));app.use('/api/ai-study',require('../routes/aiStudyRoutes').createAiStudyRouter({provider:{generate(){throw new Error('Provider access forbidden in this test');}}}));app.use(require('../middleware/validation').validationErrorHandler);
  const server=await new Promise(resolve=>{const value=app.listen(0,'127.0.0.1',()=>resolve(value));});t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}/api`;
  const call=async(path,body,token)=>{const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,body:await response.json()};};
  const signup=email=>({name:'Institutional Student',email,password:'Password1!',policyAccepted:true});
  let student,token,other;
  await t.test('personal and deceptive domains are refused; concurrent normalized duplicates produce one unverified account',async()=>{
    for(const email of ['s@gmail.com','s@yahoo.com','s@outlook.com','s@sub.phinmaed.com','s@phinmaed.com.evil.test','s+alias@phinmaed.com'])assert.equal((await call('/auth/register',signup(email))).status,400);
    const results=await Promise.all([call('/auth/register',signup(' STUDENT@PHINMAED.COM ')),call('/auth/register',signup('student@phinmaed.com'))]);
    assert.ok(results.every(result=>result.status===201));assert.deepEqual(results[0].body,results[1].body);
    assert.equal(await User.countDocuments({email:'student@phinmaed.com'}),1);assert.equal(sent.length,1);
    student=await User.findOne({email:'student@phinmaed.com'}).lean();assert.equal(student.emailVerified,false);assert.equal(student.credits,0);assert.equal(student.role,'student');
    assert.ok(results.every(result=>!result.body.data&&!result.body.token));
    const unverified=await call('/auth/login',{email:student.email,password:'Password1!'});assert.equal(unverified.status,403);
    const forged=jwt.sign({id:String(student._id),role:'admin'},process.env.JWT_SECRET);
    assert.equal((await call('/growth',undefined,forged)).status,403);
  });
  await t.test('verification remains single-use and grants the existing historical credit contract once',async()=>{
    const result=await call('/auth/verify-email',{token:sent[0].token});assert.equal(result.status,200);
    assert.equal((await call('/auth/verify-email',{token:sent[0].token})).status,400);
    const login=await call('/auth/login',{email:student.email,password:'Password1!'});assert.equal(login.status,200);token=login.body.data.token;
    student=await User.findById(student._id).lean();assert.equal(student.emailVerified,true);assert.equal(student.credits,100);
    assert.equal(await Credit.countDocuments({toUser:student._id,type:'initial_grant'}),1);
    const duplicate=await call('/auth/register',signup(' STUDENT@PHINMAED.COM '));assert.equal(duplicate.status,201);assert.equal(sent.length,1);
  });
  await t.test('real MongoDB login failure pipeline returns 401, records cooldown state and resets after valid credentials',async()=>{
    const invalid=await call('/auth/login',{email:student.email,password:'WrongPassword1!'});
    assert.equal(invalid.status,401);assert.equal(invalid.body.data?.token,undefined);
    let state=await User.findById(student._id).select('+failedLoginAttempts +loginCooldownUntil').lean();
    assert.equal(state.failedLoginAttempts,1);assert.equal(state.loginCooldownUntil,null);
    const valid=await call('/auth/login',{email:student.email,password:'Password1!'});
    assert.equal(valid.status,200);assert.ok(valid.body.data.token);
    state=await User.findById(student._id).select('+failedLoginAttempts +loginCooldownUntil').lean();
    assert.equal(state.failedLoginAttempts,0);assert.equal(state.loginCooldownUntil,undefined);
    assert.equal(state.credits,100);
  });
  await t.test('generation stages are private and inactive Growth exposes no award or balance mutation endpoint',async()=>{
    other=await User.create({name:'Other Student',email:'other@phinmaed.com',password:'fixture-only',role:'student',emailVerified:true,credits:0});
    const key='private-progress-key-123';await Quota.create({_id:student._id,requests:[{key,state:'pending',stage:'generating',fingerprint:'private',previewId:'private-preview'}]});
    const own=await call('/ai-study/requests/'+key,undefined,token);assert.equal(own.status,200);assert.deepEqual(own.body.data,{state:'pending',stage:'generating'});
    const otherToken=jwt.sign({id:String(other._id)},process.env.JWT_SECRET);assert.equal((await call('/ai-study/requests/'+key,undefined,otherToken)).status,404);
    assert.equal((await call('/ai-study/requests/'+key+'?owner='+student._id,undefined,otherToken)).status,400);
    const growth=await call('/growth',undefined,token);assert.equal(growth.status,200);assert.equal(growth.body.data.active,false);assert.equal(growth.body.data.totalExp,null);
    assert.equal((await fetch(base+'/growth',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{"amount":1000}'})).status,404);
  });
  await t.test('transactional duplicate award/reversal races preserve unique append-only EXP and every credit record',async()=>{
    const wallets=JSON.stringify(await User.find().select('_id credits').sort({_id:1}).lean());const credits=JSON.stringify(await Credit.find().sort({_id:1}).lean());
    const actor=await User.create({name:'Independent Administrator',email:'staff@example.test',password:'fixture-only',role:'admin',emailVerified:true,credits:0});
    const original={owner:student._id,eventKey:'assessment:synthetic-milestone',kind:'official_assessment',delta:20,sourceId:new mongoose.Types.ObjectId(),reason:'Synthetic official milestone fixture',policyVersion:'exp-foundation-1'};
    const insert=async entry=>{const session=await mongoose.startSession();try{let row;await session.withTransaction(async()=>{[row]=await Exp.create([entry],{session});});return row;}finally{await session.endSession();}};
    const awards=await Promise.allSettled([insert(original),insert(original)]);assert.equal(awards.filter(result=>result.status==='fulfilled').length,1);assert.equal(awards.find(result=>result.status==='rejected').reason.code,11000);
    const award=awards.find(result=>result.status==='fulfilled').value.toObject();
    const correction=correctionEntry(award,actor,'Synthetic invalid-evidence correction');
    const reversals=await Promise.allSettled([insert(correction),insert({...correction,eventKey:correction.eventKey+':different-retry-key'})]);
    assert.equal(reversals.filter(result=>result.status==='fulfilled').length,1);assert.equal(reversals.find(result=>result.status==='rejected').reason.code,11000);
    assert.equal((await Exp.aggregate([{$match:{owner:student._id}},{$group:{_id:null,total:{$sum:'$delta'}}}]))[0].total,0);
    await assert.rejects(Exp.updateOne({_id:award._id},{$set:{delta:100}}).exec(),/append-only/);
    assert.equal((await Exp.findById(award._id).lean()).delta,20);
    assert.equal(JSON.stringify(await User.find({_id:{$ne:actor._id}}).select('_id credits').sort({_id:1}).lean()),wallets);assert.equal(JSON.stringify(await Credit.find().sort({_id:1}).lean()),credits);
    const gate=evaluateCutover({transactionsVerified:true,uniqueIndexesVerified:true,awardRaceTestsPassed:true,reversalTestsPassed:true});assert.equal(gate.active,false);assert.equal(gate.ready,false);assert.ok(gate.blockers.includes('allCreditWritersRetired'));
  });
});
