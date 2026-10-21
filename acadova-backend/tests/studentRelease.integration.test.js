const test=require('node:test'),assert=require('node:assert/strict');
const {randomBytes,createHash}=require('node:crypto');
const mongoose=require('mongoose'),express=require('express'),bcrypt=require('bcryptjs');
const User=require('../models/User'),Session=require('../models/Session'),Credit=require('../models/CreditTransaction');
const Audit=require('../models/AuditLog'),Assessment=require('../models/Assessment'),Attempt=require('../models/AssessmentAttempt');
const Award=require('../models/ExpAward'),Ledger=require('../models/ExpLedgerEntry');
const safety=require('../config/studentReleaseSafety'),policy=require('../config/studentExperience');
const contracts=require('../config/studentIndexes');

// Opt-in, real enabled-mode code; never loads dotenv/server.js or a supplied URI.
// Uses only a new random database on the already-running synthetic replica.
test('approved Student release on a fresh synthetic loopback database',{
  skip:process.env.ACADOVA_RELEASE_SYNTHETIC!=='1',timeout:180000,
},async t=>{
  assert.equal(process.env.NODE_ENV,'production');assert.equal(policy.active(),true);
  assert.equal(require('../config/staffMfa').enabled(),false);
  const database='acadova_exp_engine_test_'+randomBytes(16).toString('hex');
  const uri='mongodb://127.0.0.1:27032/'+database+'?directConnection=true';
  const connect=()=>mongoose.connect(uri,{autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:5000,maxPoolSize:3});
  async function boundary(){
    assert.match(database,/^acadova_exp_engine_test_[a-f0-9]{32}$/);
    assert.equal(mongoose.connection.name,database);assert.equal(mongoose.connection.host,'127.0.0.1');assert.equal(mongoose.connection.port,27032);
    const h=await mongoose.connection.db.admin().command({hello:1});
    assert.equal(h.setName,'acadovaExpQA');assert.deepEqual(h.hosts,['127.0.0.1:27032']);
  }
  await connect();await boundary();
  assert.equal((await mongoose.connection.db.listCollections({},{nameOnly:true}).toArray()).length,0);
  t.after(async()=>{if(mongoose.connection.readyState===1){await boundary();await mongoose.connection.dropDatabase();await mongoose.disconnect();}});
  // Synthetic DDL exercises exactly the future additive plan, before any model
  // convenience creates other test collections. No existing collection changes.
  for(const c of contracts){await mongoose.connection.db.createCollection(c.name,c.options);for(const i of c.indexes)await mongoose.connection.db.collection(c.name).createIndex(i.key,i.options);}
  await t.test('four/eight exact additive specification passes actual MongoDB metadata',async()=>{
    assert.deepEqual(await require('../services/studentReleaseReadiness').verifyStudentIndexes(mongoose.connection.db),{ready:true,collections:4,secondaryIndexes:8});
  });
  const models=[User,Session,Credit,Audit,Assessment,Attempt,Award,Ledger,require('../models/ExpAccountLock'),require('../models/LegacyCreditReview'),
    require('../models/LearningTopic'),require('../models/LearningResource'),require('../models/LearningModule'),require('../models/LearningUnlock'),
    require('../models/LessonCompletion'),require('../models/StudySet'),require('../models/StudyAttempt'),require('../models/StudyPlanItem'),require('../models/Rating'),...Object.values(require('../models/academic'))];
  for(const m of new Set(models)){await m.createCollection();await m.createIndexes();}
  const secretBefore=process.env.JWT_SECRET;process.env.JWT_SECRET=randomBytes(48).toString('hex');
  t.after(()=>{if(secretBefore===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=secretBefore;});
  const password=randomBytes(20).toString('hex'),hashed=await bcrypt.hash(password,10);
  // Native insertion represents OLD records including absence/anomaly. Runtime
  // models never create positive credits in active mode. No real identities used.
  const accounts=Array.from({length:22},(_,i)=>({_id:new mongoose.Types.ObjectId(),name:'Synthetic member '+i,
    email:`release-fixture-${i}@${i<3?'phinmaed.com':'example.test'}`,password:hashed,
    role:i<18?'student':i<20?'admin':'moderator',skillsToTeach:['Networking'],skillsToLearn:['Networking'],
    ...(i%3===0?{emailVerified:true}:i%3===1?{}:{emailVerified:false}),
    ...(i===16?{}:{credits:i===0?0:100}),...(i===2||i===5?{openingGrantEligible:true,openingGrantAmount:50}:{})}));
  await User.collection.insertMany(accounts);const learner=accounts[0],tutor=accounts[6],admin=accounts[18],moderator=accounts[21];
  const oldSessions=Array.from({length:34},(_,i)=>({_id:new mongoose.Types.ObjectId(),learner:learner._id,tutor:tutor._id,subject:'Historical synthetic case',creditAmount:20,status:i<25?'completed':'cancelled',...(i<25?{completedAt:new Date(Date.now()-86400000)}:{})}));
  await Session.collection.insertMany(oldSessions);
  await Credit.collection.insertMany(Array.from({length:25},(_,i)=>i<22?{type:'initial_grant',toUser:accounts[i]._id,amount:100}:{type:'session_payment',session:oldSessions[i+9]._id,fromUser:learner._id,toUser:tutor._id,amount:20}));
  const typo=mongoose.connection.db.collection('credittranactions');
  await typo.insertMany(oldSessions.slice(0,2).map(row=>({type:'session_payment',session:row._id,fromUser:learner._id,toUser:tutor._id,amount:20})));
  const digest=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  const finances=()=>User.collection.find({},{projection:{_id:1,password:1,email:1,role:1,credits:1,emailVerified:1,openingGrantEligible:1,openingGrantAmount:1}}).sort({_id:1}).toArray().then(digest);
  const ledgers=async()=>digest([await Credit.collection.find().sort({_id:1}).toArray(),await mongoose.connection.db.collection('credittranactions').find().sort({_id:1}).toArray()]);
  const historic=()=>Session.collection.find({_id:{$in:oldSessions.map(r=>r._id)}}).sort({_id:1}).toArray().then(digest);
  const frozen={finances:await finances(),ledgers:await ledgers(),historic:await historic()};
  const notify=require('../services/notificationService'),oldNotify=notify.notifySession;notify.notifySession=async()=>{};t.after(()=>{notify.notifySession=oldNotify;});
  // Separate reserved test IPs model 22 clients without disabling auth limits.
  // This synthetic app setting is not used by server.js/Render.
  const app=express();app.set('trust proxy','loopback');app.use(express.json());app.use(safety.requestGuard);
  for(const [path,file]of [['auth','auth'],['sessions','session'],['growth','growth'],['assessments','assessment'],['credits','credit'],['admin','admin'],['moderator','moderator'],['learning','learning'],['study-sets','study'],['academic','academicWorkspace']])app.use('/api/'+path,require('../routes/'+file+'Routes'));
  app.use(require('../middleware/validation').validationErrorHandler);
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
  const root='http://127.0.0.1:'+server.address().port+'/api/';const tokens=new Map();
  const call=async(path,method='GET',body,actor=learner)=>{const client=path==='auth/login'?accounts.findIndex(a=>a.email===body?.email):-1;const r=await fetch(root+path,{method,headers:{'content-type':'application/json',...(client>=0?{'x-forwarded-for':'192.0.2.'+(client+1)}:{}),...(tokens.has(actor)?{authorization:'Bearer '+tokens.get(actor)}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};};
  await t.test('all 22 historical account shapes retain correct sign-in eligibility; staff MFA stays off',async()=>{
    for(const a of accounts){const r=await call('auth/login','POST',{email:a.email,password},null);
      assert.equal(r.status,a.emailVerified===false?403:200,'Synthetic historical sign-in eligibility');
      if(r.status===200){assert.ok(r.body.data.token);assert.equal(r.body.data.mfaRequired,undefined);assert.equal(r.body.data.user.experience.freeLearning,true);assert.equal(r.body.data.user.experience.recoveryWriteHold,safety.recoveryWriteHold());tokens.set(a,r.body.data.token);}
    }
    assert.equal(await User.countDocuments(),22);assert.equal(await finances(),frozen.finances);
  });
  await t.test('existing Staff access and database-authoritative Student separation',async()=>{
    assert.equal((await call('admin/users','GET',undefined,admin)).status,200);
    assert.equal((await call('moderator/sessions/disputed','GET',undefined,moderator)).status,200);
    assert.equal((await call('admin/users')).status,403);
  });
  if(safety.recoveryWriteHold()){
    await t.test('active-compatible recovery blocks content/economy mutations and background EXP',async()=>{
      // Pre-existing synthetic postactivation EXP, not a recovery-time award.
      const id=new mongoose.Types.ObjectId(),source=new mongoose.Types.ObjectId(),at=new Date(),event='assessment:'+source;
      await Award.collection.insertOne({_id:id,owner:learner._id,eventKey:event,kind:'official_assessment',sourceId:source,amount:20,status:'finalized',occurredAt:at,finalizedAt:at,createdAt:at,policy:{version:'student-free-exp-1'}});
      await Ledger.collection.insertOne({owner:learner._id,eventKey:event,kind:'official_assessment',sourceId:source,award:id,delta:20,reason:'Synthetic existing milestone',policyVersion:'student-free-exp-1',createdAt:at});
      const retained=digest([await Award.collection.find().toArray(),await Ledger.collection.find().toArray()]);
      for(const [p,m,b]of [['sessions','POST',{}],['assessments/'+new mongoose.Types.ObjectId()+'/submit','POST',{}],['growth/visibility','PATCH',{}],['academic/terms','POST',{}],['study-sets','POST',{}],['auth/register','POST',{}]])assert.equal((await call(p,m,b)).status,503);
      const growth=await call('growth');assert.equal(growth.body.data.totalExp,20);assert.equal(growth.body.data.events.length,1);assert.equal(growth.body.data.recoveryWriteHold,true);
      const engine=require('../services/expAwardService');
      for(const fn of ['awardAssessment','queueTutoring','finalizeTutoring','holdTutoring','releaseTutoringHold','reverseAward'])await assert.rejects(engine[fn](),{code:'STUDENT_RELEASE_WRITE_HOLD'});
      await require('../services/growthReplay').replayOwner(String(learner._id));await require('../services/growthReplay').replayBatch();
      assert.equal(await Award.countDocuments(),1);assert.equal(await Ledger.countDocuments(),1);
      assert.equal(digest([await Award.collection.find().toArray(),await Ledger.collection.find().toArray()]),retained);
    });
  }else{
    await t.test('wrong-password counters/cooldown still work with Credit retirement active',async()=>{
      const a=accounts[3];for(let i=0;i<3;i++)assert.equal((await call('auth/login','POST',{email:a.email,password:'wrong-synthetic-password'},null)).status,401);
      assert.equal((await call('auth/login','POST',{email:a.email,password},null)).status,429);
      const row=await User.collection.findOne({_id:a._id});assert.equal(row.failedLoginAttempts,3);assert.ok(row.loginCooldownUntil>new Date());
    });
    let free;
    await t.test('new zero-balance requests are truly free regardless of client price',async()=>{
      const body={tutorId:String(tutor._id),subject:'Networking',scheduledAt:new Date(Date.now()+86400000).toISOString(),meetingMethod:'online',requestMessage:'Synthetic release rehearsal'};
      assert.equal((await call('sessions','POST',{...body,creditAmount:100})).status,400);
      const r=await call('sessions','POST',body);assert.equal(r.status,201,JSON.stringify(r));free=r.body.data;assert.equal(free.economyVersion,'free-v1');assert.equal(free.creditAmount,0);
      assert.equal((await call('sessions','POST',{...body,economyVersion:'legacy-priced'})).status,400);
      assert.equal((await call(`sessions/${free._id}/status`,'PATCH',{status:'scheduled'},tutor)).status,200);
    });
    await t.test('dual confirmation completes a free session and queues persisted EXP without transfers',async()=>{
      const start=new Date(Date.now()-25*60000),end=new Date(Date.now()-60000);
      // Synthetic canonical attendance fixture, never an assertion of real attendance.
      await Session.collection.updateOne({_id:new mongoose.Types.ObjectId(free._id)},{$set:{lifecycleVersion:1,status:'awaiting_validation',scheduledAt:start,learnerCheckedInAt:start,tutorCheckedInAt:start,startedAt:start,awaitingValidationAt:end}});
      assert.equal((await call(`sessions/${free._id}/confirm`,'POST',{},tutor)).status,200);
      assert.equal((await call(`sessions/${free._id}/confirm`,'POST',{})).status,200);
      const row=await Session.findById(free._id).lean();assert.equal(row.status,'completed');assert.ok(row.validationSettledAt);assert.equal(row.creditsSettledAt,undefined);
      const a=await Award.findOne({sourceId:row._id}).lean();assert.equal(a.amount,50);assert.equal(a.status,'pending');assert.ok(+a.readyAt>=+row.completedAt+48*3600000);
      await assert.rejects(require('../services/expAwardService').finalizeTutoring(String(a._id)),{code:'EXP_AWARD_HELD'});
    });
    await t.test('official assessment awards actual EXP exactly once and survives reconnection',async()=>{
      const publishedAt=new Date(Date.now()-60000);
      const a=await Assessment.create({title:'Synthetic release assessment',topic:'Networks',status:'published',createdBy:moderator._id,approvedBy:moderator._id,publishedAt,passingScore:70,questions:[0,1,2].map(i=>({prompt:'Synthetic question '+i,options:['Correct','Other'],correctIndex:0}))});
      await Audit.create({actor:moderator._id,actorRole:'moderator',action:require('../services/auditService').ACTIONS.assessmentPublished,targetType:'Assessment',targetId:String(a._id),summary:'Synthetic publication',createdAt:publishedAt});
      const results=await Promise.all([call(`assessments/${a._id}/submit`,'POST',{answers:[0,0,0]}),call(`assessments/${a._id}/submit`,'POST',{answers:[0,0,0]})]);assert.ok(results.every(r=>r.status===200));
      await require('../services/growthReplay').replayOwner(String(learner._id));
      assert.equal(await Ledger.countDocuments({owner:learner._id,delta:20}),1);assert.equal(await Attempt.countDocuments({student:learner._id,mode:'official',passed:true}),1);
      await mongoose.disconnect();await connect();await boundary();
      const growth=await call('growth');assert.equal(growth.status,200);assert.equal(growth.body.data.totalExp,20);assert.equal(growth.body.data.rank.level,1);
      assert.equal((await call(`assessments/${a._id}/submit`,'POST',{answers:[0,0,0]})).body.data.mode,'practice');assert.equal(await Ledger.countDocuments({owner:learner._id}),1);
    });
    await t.test('25 legacy cases including separate-ledger evidence remain individually frozen',async()=>{
      for(const row of oldSessions.slice(0,25)){
        const view=await call('growth/legacy-reviews/'+row._id);assert.equal(view.status,200);assert.equal(view.body.data.frozen,true);assert.equal(view.body.data.caseWritesAllowed,false);
      }
      assert.equal((await call('growth/legacy-reviews/'+oldSessions[0]._id,'POST',{reason:'Synthetic forbidden closure'},moderator)).status,423);
      assert.equal((await call('growth/legacy-reviews/'+oldSessions[2]._id+'/consent','POST',{agree:true,version:1})).status,423);
      assert.equal((await call('sessions/'+oldSessions[0]._id+'/confirm','POST',{})).status,423);
      for(const [path,method,body]of [['status','PATCH',{status:'cancelled'}],['coordination','PATCH',{meetingLink:'https://example.test/meeting'}],['reschedule','POST',{scheduledAt:new Date(Date.now()+86400000).toISOString()}],['evidence','POST',{}],['messages','POST',{message:'Synthetic frozen discussion'}],['check-in','POST',{}],['finish','POST',{}],['no-show','POST',{}],['dispute','POST',{reason:'Synthetic review request'}]])assert.equal((await call('sessions/'+oldSessions[2]._id+'/'+path,method,body)).status,423);
      assert.equal(await require('../models/LegacyCreditReview').countDocuments(),0);
    });
    await t.test('Learning Hub exposes historical priced resources free, without altering their stored price',async()=>{
      const Topic=require('../models/LearningTopic'),Resource=require('../models/LearningResource');
      const topic=await Topic.create({name:'Synthetic release topic',slug:'synthetic-release-topic',description:'Synthetic only',status:'published',createdBy:moderator._id});
      const resource=await Resource.create({topic:topic._id,title:'Synthetic lesson',description:'Synthetic only',resourceType:'text',textContent:'Synthetic lesson content',submittedBy:moderator._id,reviewStatus:'published',creditCost:25});
      assert.equal((await call('learning/topics')).status,200);
      const r=await call('learning/resources/'+resource._id);assert.equal(r.status,200);assert.equal(r.body.data.locked,false);assert.equal(r.body.data.creditCost,0);assert.equal(r.body.data.textContent,'Synthetic lesson content');
      const u=await call('learning/resources/'+resource._id+'/unlock','POST',{});assert.equal(u.status,200);assert.equal(u.body.data.amountSpent,0);assert.equal((await Resource.findById(resource._id)).creditCost,25);
    });
    await t.test('Study Sets, flashcards, server-graded quizzes and academic workspace remain functional',async()=>{
      const made=await call('study-sets','POST',{title:'Synthetic study set',subject:'Networks',questions:[{prompt:'Synthetic question',options:['Correct','Other'],correctIndex:0,explanation:'Synthetic explanation'}],flashcards:[{front:'Synthetic front',back:'Synthetic back'}]});assert.equal(made.status,201);
      const set=made.body.data.id;assert.equal((await call('study-sets/'+set+'/review')).body.data.flashcards[0].back,'Synthetic back');
      const started=await call('study-sets/'+set+'/start','POST',{});assert.equal(started.status,201);assert.equal(started.body.data.questions[0].correctIndex,undefined);
      const submitted=await call('study-sets/attempts/'+started.body.data.id+'/submit','POST',{answers:[0]});assert.equal(submitted.status,200);assert.equal(submitted.body.data.score,100);assert.equal(submitted.body.data.creditsAwarded,0);
      const term=await call('academic/terms','POST',{startYear:2026,semester:'First'});assert.equal(term.status,201);
      assert.equal((await call('academic/current-term','PATCH',{currentTermId:term.body.data.id})).status,200);
      assert.equal((await call('academic/subjects','POST',{termId:term.body.data.id,name:'Synthetic networks'})).status,201);
      assert.equal((await call('academic/state')).body.data.subjects.length,1);
      const anomaly=accounts[16];const old=await call('academic/terms','POST',{startYear:2026,semester:'First'},anomaly);assert.equal(old.status,201);
      assert.equal((await call('academic/current-term','PATCH',{currentTermId:old.body.data.id},anomaly)).status,200);
      assert.equal(Object.hasOwn(await User.collection.findOne({_id:anomaly._id}),'credits'),false);
      assert.equal(Object.hasOwn(await User.collection.findOne({_id:anomaly._id}),'emailVerified'),false);
      assert.equal((await call('auth/login','POST',{email:anomaly.email,password},null)).status,200);
    });
    await t.test('Credit routes, balances and both ledger models cannot mutate in active mode',async()=>{
      assert.equal((await call('credits/mine')).status,410);
      await assert.rejects(User.updateOne({_id:learner._id},{$inc:{credits:20}}),{code:'CREDIT_ECONOMY_RETIRED'});
      await assert.rejects(User.updateOne({_id:learner._id},[{$set:{credits:20}}],{updatePipeline:true}),{code:'CREDIT_ECONOMY_RETIRED'});
      await assert.rejects(Credit.create({type:'initial_grant',toUser:learner._id,amount:20}),{code:'CREDIT_ECONOMY_RETIRED'});
    });
    await t.test('verification retains each opening promise without granting, consuming or converting it',async()=>{
      for(const amount of [50,undefined]){
        const verification=require('../utils/verificationTokens').createVerificationToken(),id=new mongoose.Types.ObjectId();
        await User.collection.insertOne({_id:id,name:'Synthetic pending promise',email:'promise-'+id+'@example.test',password:hashed,role:'student',credits:0,emailVerified:false,openingGrantEligible:true,...(amount===undefined?{}:{openingGrantAmount:amount}),emailVerificationTokenHash:verification.hash,emailVerificationExpires:verification.expires});
        try{
          assert.equal((await call('auth/verify-email','POST',{token:verification.token},null)).status,200);
          const row=await User.collection.findOne({_id:id});assert.equal(row.emailVerified,true);assert.equal(row.openingGrantEligible,true);assert.equal(row.openingGrantAmount,amount);assert.ok(row.openingGrantFrozenAt);assert.equal(row.credits,0);
          assert.equal(await Credit.countDocuments({toUser:id}),0);assert.equal(await Ledger.countDocuments({owner:id}),0);
        }finally{await User.collection.deleteOne({_id:id});}
      }
    });
  }
  await t.test('all original 22 financial/account shapes, 34 Sessions and both historical ledgers stay unchanged',async()=>{
    assert.equal(await User.countDocuments(),22);assert.equal(await finances(),frozen.finances);assert.equal(await ledgers(),frozen.ledgers);assert.equal(await historic(),frozen.historic);
  });
});
