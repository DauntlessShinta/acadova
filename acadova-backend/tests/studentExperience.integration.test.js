const test=require('node:test'),assert=require('node:assert/strict');
const {randomUUID,randomBytes}=require('node:crypto');
const mongoose=require('mongoose'),express=require('express'),jwt=require('jsonwebtoken');
const User=require('../models/User'),Session=require('../models/Session'),Credit=require('../models/CreditTransaction'),Audit=require('../models/AuditLog');
const Assessment=require('../models/Assessment'),Attempt=require('../models/AssessmentAttempt'),Award=require('../models/ExpAward'),Ledger=require('../models/ExpLedgerEntry');
const Consent=require('../models/AcadiConsent'),Quota=require('../models/AcadiQuota');
const policy=require('../config/studentExperience'),engine=require('../services/expAwardService');
test('new Student experience on a fresh verified loopback replica', {skip:process.env.ACADOVA_STUDENT_EXPERIENCE_DB_TESTS!=='1'},async t=>{
  assert.equal(process.env.NODE_ENV,'test');
  const database='acadova_exp_engine_test_'+randomUUID().replaceAll('-','');
  await mongoose.connect('mongodb://127.0.0.1:27032/admin?directConnection=true',{serverSelectionTimeoutMS:10000});
  try{await mongoose.connection.db.admin().command({replSetInitiate:{_id:'acadovaExpQA',members:[{_id:0,host:'127.0.0.1:27032'}]}});}catch(e){if(e.codeName!=='AlreadyInitialized')throw e;}
  await mongoose.disconnect();await mongoose.connect(`mongodb://127.0.0.1:27032/${database}?replicaSet=acadovaExpQA`,{serverSelectionTimeoutMS:20000});
  t.after(async()=>{assert.equal(mongoose.connection.name,database);await mongoose.connection.dropDatabase();await mongoose.disconnect();});
  const academic=require('../models/academic');
  const models=[User,Session,Credit,Audit,Assessment,Attempt,Award,Ledger,Consent,Quota,require('../models/ExpAccountLock'),require('../models/LegacyCreditReview'),require('../models/LearningTopic'),require('../models/LearningResource'),require('../models/LearningModule'),require('../models/LearningUnlock'),require('../models/Rating'),require('../models/StudyPlanItem'),...Object.values(academic)];
  for(const model of new Set(models)){await model.createCollection();await model.createIndexes();}
  const oldSecret=process.env.JWT_SECRET;process.env.JWT_SECRET=randomBytes(48).toString('hex');t.after(()=>{if(oldSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=oldSecret;});
  const actors=await User.create(['Learner','Tutor','Other','Moderator','Admin','PeerTwo','LegacyLearner'].map((name,i)=>({name,email:`synthetic${i}@example.test`,password:'synthetic-only',role:name==='Moderator'?'moderator':name==='Admin'?'admin':'student',emailVerified:true,credits:name==='Learner'?0:100,skillsToTeach:['Networking']})));
  const [learner,tutor,other,moderator,admin,peerTwo,legacyLearner]=actors;
  const legacy=await Session.create({learner:legacyLearner._id,tutor:tutor._id,subject:'Networking',creditAmount:20,status:'completed',completedAt:new Date()});
  const verification=require('../utils/verificationTokens').createVerificationToken();
  const pendingGrant=await User.create({name:'Synthetic pending verification',email:'pending@phinmaed.com',password:'synthetic',role:'student',credits:0,emailVerified:false,openingGrantEligible:true,openingGrantAmount:50,emailVerificationTokenHash:verification.hash,emailVerificationExpires:verification.expires});
  const historical=await Credit.create({type:'initial_grant',toUser:other._id,amount:100});
  const wallets=()=>User.find().select('_id credits openingGrantEligible openingGrantAmount').sort({_id:1}).lean().then(JSON.stringify);
  const creditRows=()=>Credit.find().sort({_id:1}).lean().then(JSON.stringify);
  const beforeWallets=await wallets(),beforeCredit=await creditRows();
  await policy.activateIsolatedStudentExperience();assert.equal(policy.active(),true);
  const app=express();app.use(express.json({limit:'100kb'}));
  const notifications=require('../services/notificationService');const oldNotify=notifications.notifySession;notifications.notifySession=async()=>{};t.after(()=>{notifications.notifySession=oldNotify;});
  const chatCalls=[];let chatFailure=null;
  const config={...require('../config/acadi').acadiConfig({}),enabled:true,contextEnabled:true,syntheticOnly:true,dailyLimit:20,timeoutMs:1000};
  app.use('/api/acadi',require('../routes/acadiRoutes').createAcadiRouter({config,provider:{generate:async value=>{chatCalls.push(value);if(chatFailure)throw chatFailure;return 'Synthetic academic explanation. Suggestions only; no records changed.';}}}));
  app.use('/api/users',require('../routes/userRoutes'));
  app.use('/api/auth',require('../routes/authRoutes'));app.use('/api/moderator',require('../routes/moderatorRoutes'));app.use('/api/sessions',require('../routes/sessionRoutes'));app.use('/api/assessments',require('../routes/assessmentRoutes'));app.use('/api/growth',require('../routes/growthRoutes'));app.use('/api/learning',require('../routes/learningRoutes'));app.use('/api/credits',require('../routes/creditRoutes'));app.use('/api/admin',require('../routes/adminRoutes'));app.use(require('../middleware/validation').validationErrorHandler);
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));const root=`http://127.0.0.1:${server.address().port}/api/`;
  const call=async(path,method='GET',body,actor=learner)=>{const r=await fetch(root+path,{method,headers:{'content-type':'application/json',...(actor?{authorization:'Bearer '+jwt.sign({id:String(actor._id)},process.env.JWT_SECRET)}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};};
  const request=()=>({tutorId:String(tutor._id),subject:'Networking',scheduledAt:new Date(Date.now()+86400000).toISOString(),meetingMethod:'online',requestMessage:'Synthetic request'});
  let free;
  await t.test('zero-balance future request is free and client claims cannot set its price or economy',async()=>{
    const originalRequest=request();const r=await call('sessions','POST',originalRequest);assert.equal(r.status,201,JSON.stringify(r));free=r.body.data;assert.equal(free.economyVersion,'free-v1');assert.equal(free.creditAmount,0);assert.equal(free.status,'pending');
    assert.equal((await call('sessions','POST',{...request(),economyVersion:'paid'})).status,400);
    assert.equal((await call('sessions','POST',{...request(),scheduledAt:new Date(Date.now()-1000).toISOString()})).status,400);
    assert.equal((await call('sessions','POST',{...request(),subject:'Not offered'})).status,400);
    assert.equal((await call('sessions','POST',originalRequest)).status,409);
  });
  await t.test('accept/reject, rescheduling and private coordination retain participant authorization',async()=>{
    assert.equal((await call(`sessions/${free._id}/status`,'PATCH',{status:'scheduled'},other)).status,403);
    assert.equal((await call(`sessions/${free._id}/status`,'PATCH',{status:'scheduled'},tutor)).status,200);
    assert.equal((await call(`sessions/${free._id}/coordination`,'PATCH',{meetingLink:'https://meet.google.com/abc-defg-hij'},tutor)).status,200);
    assert.equal((await call(`sessions/${free._id}`,'GET',undefined,other)).status,403);
    const proposed=await call(`sessions/${free._id}/reschedule`,'POST',{scheduledAt:new Date(Date.now()+2*86400000).toISOString()},tutor);assert.equal(proposed.status,200,JSON.stringify(proposed));
    const row=await Session.findById(free._id).lean();assert.equal((await call(`sessions/${free._id}/reschedule/accept`,'POST',{proposalId:row.rescheduleProposalId})).status,200);
    assert.equal((await call(`sessions/${free._id}/status`,'PATCH',{status:'cancelled'})).status,200);
    const another=await call('sessions','POST',{...request(),scheduledAt:new Date(Date.now()+3*86400000).toISOString()});assert.equal(another.status,201);
    assert.equal((await call(`sessions/${another.body.data._id}/status`,'PATCH',{status:'declined'},tutor)).status,200);
  });
  await t.test('all active credit mutations and legacy automatic settlement fail closed',async()=>{
    assert.equal((await call('credits/mine')).status,410);
    assert.equal((await call(`sessions/${legacy._id}/confirm`,'POST',{},legacyLearner)).status,410);
    assert.equal((await call('admin/credits/adjustments','POST',{targetStudentId:String(learner._id),direction:'credit',amount:20,reason:'Synthetic authorized adjustment',reference:randomUUID()},admin)).status,410);
    await assert.rejects(User.updateOne({_id:learner._id},{$inc:{credits:20}}),{code:'CREDIT_ECONOMY_RETIRED'});
    await assert.rejects(User.updateOne({_id:learner._id},[{$set:{credits:20}}],{updatePipeline:true}),{code:'CREDIT_ECONOMY_RETIRED'});
    await assert.rejects(User.updateOne({_id:learner._id},{$rename:{rating:'credits'}}),{code:'CREDIT_ECONOMY_RETIRED'});
    await assert.rejects(User.replaceOne({_id:learner._id},{name:'No replacement'}),{code:'CREDIT_ECONOMY_RETIRED'});
    await assert.rejects(User.insertMany([{name:'Synthetic',email:'no-mint@example.test',password:'synthetic',credits:20}]),{code:'CREDIT_ECONOMY_RETIRED'});
    await assert.rejects(Credit.create({type:'initial_grant',toUser:learner._id,amount:20}),{code:'CREDIT_ECONOMY_RETIRED'});
    assert.equal(await wallets(),beforeWallets);assert.equal(await creditRows(),beforeCredit);assert.ok(await Credit.exists({_id:historical._id}));
  });
  await t.test('official first pass is graded server-side and awards exactly 20 EXP under concurrent retries',async()=>{
    const publishedAt=new Date(Date.now()-60000);
    const assessment=await Assessment.create({title:'Synthetic networking assessment',topic:'Networks',status:'published',createdBy:moderator._id,approvedBy:moderator._id,publishedAt,passingScore:70,questions:[0,1,2].map(i=>({prompt:'Question '+i,options:['Correct','Other'],correctIndex:0}))});
    await Audit.create({actor:moderator._id,actorRole:'moderator',action:require('../services/auditService').ACTIONS.assessmentPublished,targetType:'Assessment',targetId:String(assessment._id),summary:'Synthetic publication',createdAt:publishedAt});
    const result=await Promise.all([call(`assessments/${assessment._id}/submit`,'POST',{answers:[0,0,0]}),call(`assessments/${assessment._id}/submit`,'POST',{answers:[0,0,0]})]);
    assert.ok(result.every(r=>r.status===200),JSON.stringify(result));
    await require('../services/growthReplay').replayOwner(String(learner._id));
    assert.equal(await Award.countDocuments({owner:learner._id}),1);assert.equal(await Ledger.countDocuments({owner:learner._id,delta:20}),1);
    assert.equal(await Attempt.countDocuments({student:learner._id,mode:'official',passed:true}),1);const official=await Attempt.findOne({student:learner._id,assessment:assessment._id,mode:'official'});
    const reopened=await call(`assessments/attempts/${official._id}`);assert.equal(reopened.body.data.exp.status,'finalized');assert.equal(reopened.body.data.exp.amount,20);assert.equal(reopened.body.data.rewardEligible,false);
    assert.equal(await wallets(),beforeWallets);assert.equal(await creditRows(),beforeCredit);
    const growth=await call('growth');assert.equal(growth.body.data.totalExp,20);assert.equal(growth.body.data.rank.level,1);assert.equal(growth.body.data.badges.find(b=>b.id==='first-step').earned,true);
    assert.equal((await call('growth/reversals/'+(await Ledger.findOne({owner:learner._id}))._id,'POST',{reason:'Unauthorized correction attempt'})).status,403);
  });
  await t.test('growth visibility is private by default and shares only selected earned recognition',async()=>{
    const initial=await call('growth');assert.deepEqual(initial.body.data.visibility,{showLevel:false,showRank:false,badgeIds:[]});
    assert.equal((await call('users/'+learner._id,'GET',undefined,other)).body.data.growth,undefined);
    assert.equal((await call('growth/visibility','PATCH',{showLevel:'true'})).status,400);
    assert.equal((await call('growth/visibility','PATCH',{owner:String(other._id),showLevel:true})).status,400);
    assert.equal((await call('growth/visibility','PATCH',{badgeIds:['helping-hand']})).status,400);
    assert.equal((await call('growth/visibility','PATCH',{showLevel:true,showRank:true,badgeIds:['first-step']})).status,200);
    const peer=await call('users/'+learner._id,'GET',undefined,other);
    assert.deepEqual(peer.body.data.growth,{level:1,rankTitle:'Beginner',badges:[{id:'first-step',title:'First Step'}]});
    const encoded=JSON.stringify(peer.body.data);for(const key of ['totalExp','events','growthVisibility','pending','assessmentPerformance'])assert.equal(encoded.includes('"'+key+'"'),false);
    assert.equal((await call('growth')).body.data.totalExp,20);
    assert.equal((await call('growth/visibility','PATCH',{showLevel:false,showRank:false,badgeIds:[]})).status,200);
    assert.equal((await call('users/'+learner._id,'GET',undefined,other)).body.data.growth,undefined);
    assert.ok(await Audit.exists({actor:learner._id,action:'growth.visibility_updated'}));
  });
  await t.test('growth privacy controls cannot be used by staff or unauthenticated clients',async()=>{
    assert.equal((await call('growth/visibility','PATCH',{showLevel:true},null)).status,401);
    assert.equal((await call('growth/visibility','PATCH',{showLevel:true},moderator)).status,403);
    assert.equal((await call('growth/visibility','PATCH',{showLevel:true},admin)).status,403);
    assert.equal((await call('growth/visibility','PATCH',{badgeIds:['first-step','first-step']})).status,400);
  });
  await t.test('visibility changes roll back when the mandatory audit write fails',async()=>{
    const create=Audit.create;let attempted=false;
    Audit.create=async()=>{attempted=true;throw new Error('Synthetic audit outage');};
    try { assert.equal((await call('growth/visibility','PATCH',{showLevel:true})).status,503); }
    finally { Audit.create=create; }
    assert.equal(attempted,true);assert.equal((await call('growth')).body.data.visibility.showLevel,false);
  });
  await t.test('Admin EXP analytics use real ledger values, date filters, aggregate privacy and DB-authoritative RBAC',async()=>{
    const date=new Date().toISOString().slice(0,10), query='admin/exp-analytics?from='+date+'&to='+date;
    const walletsBefore=await wallets(),creditsBefore=await creditRows(),auditsBefore=await Audit.countDocuments();
    const result=await call(query,'GET',undefined,admin);assert.equal(result.status,200);
    assert.equal(result.body.data.totals.awarded,20);assert.equal(result.body.data.totals.net,20);assert.equal(result.body.data.progressingStudents,1);
    assert.equal(result.body.data.distribution.length,6);assert.equal(result.body.data.integrity.duplicateEventGroups,0);
    const encoded=JSON.stringify(result.body.data);for(const privateValue of [String(learner._id),learner.email,learner.name])assert.ok(!encoded.includes(privateValue));
    const empty=await call('admin/exp-analytics?from=2000-01-01&to=2000-01-02','GET',undefined,admin);assert.equal(empty.body.data.totals.awarded,0);assert.equal(empty.body.data.progressingStudents,0);assert.deepEqual(empty.body.data.distribution,result.body.data.distribution);
    assert.equal((await call(query)).status,403);assert.equal((await call(query,'GET',undefined,moderator)).status,403);assert.equal((await call(query,'GET',undefined,null)).status,401);
    assert.equal((await call('admin/exp-analytics?from=2026-02-30&to=2026-03-01','GET',undefined,admin)).status,400);
    const forged=await fetch(root+query,{headers:{authorization:'Bearer '+jwt.sign({id:String(learner._id),role:'admin'},process.env.JWT_SECRET)}});assert.equal(forged.status,403);
    assert.equal(await wallets(),walletsBefore);assert.equal(await creditRows(),creditsBefore);assert.equal(await Audit.countDocuments(),auditsBefore);
  });
  await t.test('historical passes without a mode marker cannot be farmed by a new official retry',async()=>{
    const publishedAt=new Date(Date.now()-2*3600000);
    const assessment=await Assessment.create({title:'Synthetic historical milestone',topic:'Networks',status:'published',createdBy:moderator._id,approvedBy:moderator._id,publishedAt,passingScore:70,questions:[0,1,2].map(i=>({prompt:'Historical question '+i,options:['Correct','Other'],correctIndex:0}))});
    await Audit.create({actor:moderator._id,actorRole:'moderator',action:require('../services/auditService').ACTIONS.assessmentPublished,targetType:'Assessment',targetId:String(assessment._id),summary:'Synthetic historical publication',createdAt:publishedAt});
    await Attempt.create({student:learner._id,assessment:assessment._id,answers:[0,0,0],score:100,passed:true,rewardIssued:false,submittedAt:new Date(Date.now()-3600000)});
    const retry=await call(`assessments/${assessment._id}/submit`,'POST',{answers:[0,0,0]});assert.equal(retry.status,200);assert.equal(retry.body.data.mode,'practice');assert.equal(retry.body.data.exp.amount,0);assert.equal(await Award.countDocuments({assessment:assessment._id}),0);
    assert.equal(await wallets(),beforeWallets);assert.equal(await creditRows(),beforeCredit);
  });
  const completeFixture=async(student=tutor,pupil=learner,agoMinutes=0)=>{
    const completed=new Date(Date.now()-agoMinutes*60000-1000),start=new Date(completed-25*60000);
    return Session.create({learner:pupil._id,tutor:student._id,subject:'Networking',economyVersion:'free-v1',creditAmount:0,lifecycleVersion:1,status:'awaiting_validation',scheduledAt:start,learnerCheckedInAt:start,tutorCheckedInAt:start,startedAt:start,awaitingValidationAt:new Date(completed-60000)});
  };
  let completed;
  await t.test('dual confirmation completes without transfers and queues a real pending contribution',async()=>{
    completed=await completeFixture();assert.equal((await call(`sessions/${completed._id}/confirm`,'POST',{},tutor)).status,200);
    assert.equal(await Ledger.countDocuments({owner:tutor._id}),0);
    const result=await call(`sessions/${completed._id}/confirm`,'POST',{});assert.equal(result.status,200,JSON.stringify(result));
    const row=await Session.findById(completed._id).lean();assert.equal(row.status,'completed');assert.ok(row.validationSettledAt);assert.equal(row.creditsSettledAt,undefined);
    const award=await Award.findOne({sourceId:row._id});assert.ok(award);assert.equal(award.status,'pending');assert.equal(award.amount,50);assert.ok(+award.readyAt>=+row.completedAt+48*3600000);
    await assert.rejects(engine.finalizeTutoring(String(award._id)),{code:'EXP_AWARD_HELD'});
    assert.equal(await wallets(),beforeWallets);assert.equal(await creditRows(),beforeCredit);
  });
  await t.test('participant reports block finalization and require an independent audited staff decision',async()=>{
    assert.equal((await call(`sessions/${completed._id}/exp-report`,'POST',{reason:'Synthetic completion disagreement'},other)).status,403);
    assert.equal((await call(`sessions/${completed._id}/exp-report`,'POST',{reason:'Synthetic completion disagreement'})).status,200);
    assert.equal((await call('growth/reports')).status,403);
    const reports=await call('growth/reports','GET',undefined,moderator);assert.equal(reports.status,200);assert.equal(reports.body.data.length,1);
    const award=await Award.findOne({sourceId:completed._id});assert.equal((await call('growth','GET',undefined,tutor)).body.data.pending[0].status,'held');
    assert.equal((await call(`growth/reports/${completed._id}`,'POST',{outcome:'upheld',reason:'Synthetic evidence review confirms concern'},moderator)).status,200);
    assert.equal((await Award.findById(award._id)).status,'held');assert.equal(await Ledger.countDocuments({award:award._id}),0);
  });
  await t.test('free dispute resolution preserves its non-financial version in the resolved staff queue and creates no EXP',async()=>{
    const row=await completeFixture();
    const disputed=await call(`sessions/${row._id}/dispute`,'POST',{reason:'Synthetic participant concern before confirmation'});assert.equal(disputed.status,200,JSON.stringify(disputed));
    const resolved=await call(`moderator/sessions/${row._id}/resolve`,'POST',{resolution:'confirm_session',resolutionNote:'Synthetic independent review of check-in and work evidence',reviewVersion:disputed.body.data.reviewVersion},moderator);assert.equal(resolved.status,200,JSON.stringify(resolved));
    assert.equal(resolved.body.data.economyVersion,'free-v1');assert.ok(resolved.body.data.validationSettledAt);assert.equal(resolved.body.data.creditsSettledAt,undefined);assert.ok(!resolved.body.message.includes('Credits transferred'));
    const queue=await call('moderator/sessions/resolved','GET',undefined,moderator);assert.equal(queue.status,200);const listed=queue.body.data.find(item=>String(item._id)===String(row._id));assert.equal(listed.economyVersion,'free-v1');assert.equal(require('../utils/sessionLifecycleCompatibility').classifyLegacySession(listed).requiresReconciliation,false);
    await require('../services/growthReplay').replayOwner(String(tutor._id));assert.equal(await Award.countDocuments({sourceId:row._id}),0);assert.equal(await wallets(),beforeWallets);assert.equal(await creditRows(),beforeCredit);
  });
  await t.test('legacy closure needs staff proposal plus both actual participant consents; no price/history rewrite',async()=>{
    assert.equal((await call(`growth/legacy-reviews/${legacy._id}`,'POST',{reason:'Synthetic mutual resolution proposal'})).status,403);
    const proposed=await call(`growth/legacy-reviews/${legacy._id}`,'POST',{reason:'Synthetic mutual resolution proposal'},moderator);assert.equal(proposed.status,200,JSON.stringify(proposed));
    const queue=await call('growth/legacy-reviews','GET',undefined,moderator);assert.equal(queue.body.data.find(row=>String(row._id)===String(legacy._id)).review.state,'proposed');
    assert.equal((await call(`growth/legacy-reviews/${legacy._id}/consent`,'POST',{agree:true,version:1},other)).status,403);
    const first=await call(`growth/legacy-reviews/${legacy._id}/consent`,'POST',{agree:true,version:1},legacyLearner);assert.equal(first.status,200);
    assert.equal((await Session.findById(legacy._id)).legacyObligationResolvedAt,undefined);
    const second=await call(`growth/legacy-reviews/${legacy._id}/consent`,'POST',{agree:true,version:first.body.data.version},tutor);assert.equal(second.status,200,JSON.stringify(second));
    assert.equal(second.body.data.state,'closed');const row=await Session.findById(legacy._id).lean();assert.ok(row.legacyObligationResolvedAt);assert.equal(row.status,'completed');assert.equal(row.creditAmount,20);
    assert.equal(await require('../utils/sessionRoleGuard').hasInFlightSessions(legacyLearner._id),false);
    assert.equal((await call(`growth/legacy-reviews/${legacy._id}`,'GET',undefined,legacyLearner)).body.data.frozen,false);
    assert.equal(await wallets(),beforeWallets);assert.equal(await creditRows(),beforeCredit);
  });
  for(const source of ['credittransactions','credittranactions'])await t.test(`${source} evidence blocks proposal and late evidence rolls back consent`,async()=>{
    const Review=require('../models/LegacyCreditReview'),collection=mongoose.connection.db.collection(source);
    const paid=await Session.create({learner:legacyLearner._id,tutor:tutor._id,subject:'Networking',creditAmount:20,status:'completed',completedAt:new Date()});
    const inserted=[];
    try {
      inserted.push((await collection.insertOne({session:paid._id,fromUser:legacyLearner._id,toUser:tutor._id,type:'session_payment',amount:20})).insertedId);
      assert.equal((await call(`growth/legacy-reviews/${paid._id}`,'POST',{reason:'Synthetic paid case must remain frozen'},moderator)).status,409);
      assert.equal(await Review.countDocuments({session:paid._id}),0);
      assert.equal((await Session.findById(paid._id)).reviewVersion,undefined);
      const late=await Session.create({learner:legacyLearner._id,tutor:tutor._id,subject:'Networking',creditAmount:20,status:'completed',completedAt:new Date()});
      const proposal=await call(`growth/legacy-reviews/${late._id}`,'POST',{reason:'Synthetic later evidence blocks closure'},moderator);assert.equal(proposal.status,200,JSON.stringify(proposal));
      const first=await call(`growth/legacy-reviews/${late._id}/consent`,'POST',{agree:true,version:1},legacyLearner);assert.equal(first.status,200);
      inserted.push((await collection.insertOne({session:late._id,fromUser:legacyLearner._id,toUser:tutor._id,type:'session_payment',amount:20})).insertedId);
      const before=JSON.stringify(await Review.findOne({session:late._id}).lean()),audits=await Audit.countDocuments(),sessionBefore=JSON.stringify(await Session.findById(late._id).lean());
      assert.equal((await call(`growth/legacy-reviews/${late._id}/consent`,'POST',{agree:true,version:first.body.data.version},tutor)).status,409);
      assert.equal(JSON.stringify(await Review.findOne({session:late._id}).lean()),before);
      assert.equal(JSON.stringify(await Session.findById(late._id).lean()),sessionBefore);assert.equal(await Audit.countDocuments(),audits);
      assert.equal(await wallets(),beforeWallets);
    } finally {
      // Only fixtures inserted above, in this already-verified random loopback DB.
      await collection.deleteMany({_id:{$in:inserted}});
    }
    assert.equal(await creditRows(),beforeCredit);
  });
  await t.test('25 retained synthetic obligations stay frozen without blanket consent or Credit changes',async()=>{
    const rows=await Session.create(Array.from({length:25},()=>({learner:legacyLearner._id,tutor:tutor._id,subject:'Networking',creditAmount:20,status:'pending'})));
    for(const row of rows)assert.ok([400,410].includes((await call(`sessions/${row._id}/confirm`,'POST',{},legacyLearner)).status));
    assert.equal(await Session.countDocuments({_id:{$in:rows.map(r=>r._id)},legacyObligationResolvedAt:null,creditsSettledAt:null}),25);
    assert.equal(await require('../models/LegacyCreditReview').countDocuments({session:{$in:rows.map(r=>r._id)}}),0);
    assert.equal(await wallets(),beforeWallets);assert.equal(await creditRows(),beforeCredit);
    assert.equal(await mongoose.connection.db.collection('credittranactions').countDocuments({}),0);
  });
  const question=(text='Explain the difference between a switch and a router',extra={})=>({requestId:randomUUID(),message:text,mode:'general',...extra});
  await t.test('chat authenticates, requires consent, is idempotent and never sends general account metadata',async()=>{
    assert.equal((await call('acadi/status','GET',undefined,null)).status,401);
    assert.equal((await call('acadi/messages','POST',question())).status,403);
    assert.equal((await call('acadi/consent','PUT',{general:true,context:false})).status,200);
    const body=question();const r=await call('acadi/messages','POST',body);assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.data.source,'synthetic');assert.deepEqual(chatCalls[0].facts,[]);
    const repeat=await call('acadi/messages','POST',{...body,conversationId:r.body.data.conversationId});assert.equal(repeat.status,200);assert.equal(chatCalls.length,1);
    assert.equal((await call('acadi/messages','POST',question('Follow-up',{conversationId:r.body.data.conversationId}),other)).status,403);
    assert.equal((await Quota.findOne({owner:learner._id})).used,1);
  });
  await t.test('context ownership is re-read and projections exclude notes, email, grades and meeting links',async()=>{
    const term=await academic.AcademicTerm.create({owner:learner._id,startYear:2026,endYear:2027,semester:'Synthetic term'});
    const subject=await academic.PersonalSubject.create({owner:learner._id,termId:term._id,name:'Networking'});
    const module=await academic.PersonalModule.create({owner:learner._id,subjectId:subject._id,title:'Switching',status:'in_progress'});
    await require('../models/StudyPlanItem').create({owner:learner._id,subjectId:subject._id,kind:'goal',title:'Synthetic study goal',notes:'private@example.test / private meeting link',dueAt:new Date(Date.now()+86400000),timezone:'Asia/Manila'});
    await call('acadi/consent','PUT',{general:true,context:true},peerTwo);
    const forged=await call('acadi/messages','POST',question('Explain switching',{mode:'context',subjectId:String(subject._id),moduleId:String(module._id)}),peerTwo);assert.equal(forged.status,404,JSON.stringify(forged));
    await call('acadi/consent','PUT',{general:true,context:true});
    const contextual=question('Help me organize my study',{mode:'context',subjectId:String(subject._id),moduleId:String(module._id)});
    const reply=await call('acadi/messages','POST',contextual);assert.equal(reply.status,200,JSON.stringify(reply));
    const projection=JSON.stringify(chatCalls.at(-1).facts);assert.ok(projection.includes('Switching'));assert.ok(!projection.includes('private@'));assert.ok(!projection.includes('notes'));assert.ok(!projection.includes('learner'));assert.ok(!projection.includes('grades'));
    await academic.PersonalSubject.updateOne({_id:subject._id},{$set:{archived:true}});
    assert.equal((await call('acadi/messages','POST',{...contextual,conversationId:reply.body.data.conversationId})).status,404);
    await academic.PersonalSubject.updateOne({_id:subject._id},{$set:{archived:false}});
    const unknown=await call('acadi/messages','POST',question('When is my next exam?',{mode:'context',subjectId:String(subject._id)}));assert.equal(unknown.status,200);assert.equal(unknown.body.data.source,'saved-facts');assert.match(unknown.body.data.text,/No upcoming exam date/);
  });
  await t.test('clear/revoke remove history, confidential input is rejected, provider errors expose no internals',async()=>{
    await call('acadi/consent','PUT',{general:true,context:false},other);
    const first=await call('acadi/messages','POST',question(),other);assert.equal(first.status,200);
    assert.equal((await call('acadi/conversation','DELETE',undefined,other)).status,200);
    assert.equal((await call('acadi/messages','POST',question('Follow-up',{conversationId:first.body.data.conversationId}),other)).status,404);
    assert.equal((await call('acadi/messages','POST',question('Email me at private@example.test'),other)).status,400);
    await call('acadi/consent','PUT',{general:false,context:false},other);
    assert.equal((await call('acadi/messages','POST',question(),other)).status,403);
    assert.equal(await wallets(),beforeWallets);assert.equal(await creditRows(),beforeCredit);
  });
  await t.test('mature tutoring finalization and exact negative correction are atomic and update badge projections',async()=>{
    const row=await completeFixture(tutor,peerTwo,49*60),done=new Date(Date.now()-49*3600000);
    await Session.updateOne({_id:row._id},{$set:{status:'completed',completedAt:done,validationSettledAt:done,learnerConfirmedAt:new Date(done-30000),tutorConfirmedAt:new Date(done-10000)}});
    const awards=await Promise.all([engine.queueTutoring(String(row._id)),engine.queueTutoring(String(row._id))]);assert.equal(String(awards[0]._id),String(awards[1]._id));
    await Promise.all([engine.finalizeTutoring(String(awards[0]._id)),engine.finalizeTutoring(String(awards[0]._id))]);
    const positive=await Ledger.findOne({award:awards[0]._id,kind:'verified_tutoring'});assert.equal(positive.delta,50);
    const growth=(await call('growth','GET',undefined,tutor)).body.data;assert.equal(growth.totalExp,50);assert.equal(growth.badges.find(b=>b.id==='first-mentor').earned,true);
    assert.equal((await call('growth/visibility','PATCH',{badgeIds:['first-mentor']},tutor)).status,200);
    assert.deepEqual((await call('users/'+tutor._id)).body.data.growth.badges,[{id:'first-mentor',title:'First Mentor'}]);
    const corrections=await Promise.all([call(`growth/reversals/${positive._id}`,'POST',{reason:'Synthetic verified evidence correction'},admin),call(`growth/reversals/${positive._id}`,'POST',{reason:'Synthetic verified evidence correction'},admin)]);assert.ok(corrections.every(r=>r.status===200),JSON.stringify(corrections));
    assert.equal(await Ledger.countDocuments({reversalOf:positive._id}),1);assert.equal((await Ledger.findOne({reversalOf:positive._id})).delta,-50);assert.equal((await Ledger.findById(positive._id)).delta,50);
    const corrected=(await call('growth','GET',undefined,tutor)).body.data;assert.equal(corrected.totalExp,0);assert.equal(corrected.badges.find(b=>b.id==='first-mentor').revoked,true);
    assert.deepEqual((await call('users/'+tutor._id)).body.data.growth.badges,[]);
    assert.equal((await call('growth/visibility','PATCH',{badgeIds:['first-mentor']},tutor)).status,400);
    const date=new Date().toISOString().slice(0,10);
    const metrics=(await call('admin/exp-analytics?from='+date+'&to='+date,'GET',undefined,admin)).body.data;
    assert.deepEqual(metrics.totals,{awarded:70,corrections:-50,net:20});assert.equal(metrics.progressingStudents,1);
    assert.equal(metrics.types.find(row=>row.kind==='verified_tutoring').exp,50);assert.equal(metrics.trend.reduce((sum,row)=>sum+row.corrections,0),-50);
    assert.equal(await wallets(),beforeWallets);assert.equal(await creditRows(),beforeCredit);
  });
  await t.test('durable event replay retries award infrastructure failures without failing or duplicating the graded attempt',async()=>{
    const publishedAt=new Date(Date.now()-60000);
    const assessment=await Assessment.create({title:'Synthetic retry milestone',topic:'Networks',status:'published',createdBy:moderator._id,approvedBy:moderator._id,publishedAt,passingScore:70,questions:[0,1,2].map(i=>({prompt:'Retry question '+i,options:['Correct','Other'],correctIndex:0}))});
    await Audit.create({actor:moderator._id,actorRole:'moderator',action:require('../services/auditService').ACTIONS.assessmentPublished,targetType:'Assessment',targetId:String(assessment._id),summary:'Synthetic publication',createdAt:publishedAt});
    const original=Audit.create;
    Audit.create=async()=>{throw new Error('Synthetic audit storage failure');};
    try{const result=await call(`assessments/${assessment._id}/submit`,'POST',{answers:[0,0,0]});assert.equal(result.status,200);assert.equal(result.body.data.exp.status,'processing');assert.equal(await Award.countDocuments({assessment:assessment._id}),0);}finally{Audit.create=original;}
    assert.equal(await Attempt.countDocuments({student:learner._id,assessment:assessment._id}),1);
    await require('../services/growthReplay').replayOwner(String(learner._id));await require('../services/growthReplay').replayOwner(String(learner._id));
    assert.equal(await Award.countDocuments({assessment:assessment._id}),1);assert.equal(await Ledger.countDocuments({owner:learner._id,eventKey:'assessment:'+assessment._id}),1);
  });
  await t.test('durable chat quotas, cancellation and consent races never fabricate a reply or refund a possibly charged attempt',async()=>{
    const create=require('../services/acadiConversation').createAcadiConversation;
    let calls=0;
    const service=create({config:{...config,dailyLimit:2},provider:{generate:async()=>{calls++;if(calls===1)throw require('../config/acadi').acadiError('Synthetic timeout',504,'ACADI_TIMEOUT');return 'Synthetic bounded reply';}}});
    await service.setConsent(String(peerTwo._id),{general:true,context:false});
    await assert.rejects(service.send(String(peerTwo._id),question()),{code:'ACADI_TIMEOUT'});
    await service.send(String(peerTwo._id),question());
    await assert.rejects(service.send(String(peerTwo._id),question()),{code:'ACADI_QUOTA'});assert.equal(calls,2);assert.equal((await Quota.findOne({owner:peerTwo._id})).used,2);
    let release;
    const held=create({config,provider:{generate:()=>new Promise(resolve=>{release=resolve;})}});
    await held.setConsent(String(other._id),{general:true,context:false});
    const pending=held.send(String(other._id),question());
    for(let i=0;i<50&&!release;i++)await new Promise(r=>setTimeout(r,10));assert.ok(release);
    await held.setConsent(String(other._id),{general:false,context:false});release('This response must not be returned after revocation.');
    await assert.rejects(pending,{code:'ACADI_CANCELLED'});assert.equal(await wallets(),beforeWallets);assert.equal(await creditRows(),beforeCredit);
  });

  await t.test('legacy staff cancellation cannot bypass the obligation freeze',async()=>{
    const row=await Session.create({learner:legacyLearner._id,tutor:tutor._id,subject:'Networking',creditAmount:20,status:'disputed',disputedAt:new Date(),disputeReason:'Synthetic dispute'});
    const result=await call(`moderator/sessions/${row._id}/resolve`,'POST',{resolution:'cancel_session',resolutionNote:'Synthetic staff review must not erase obligation'},moderator);
    assert.equal(result.status,410,JSON.stringify(result));assert.equal((await Session.findById(row._id)).status,'disputed');
    assert.equal(await wallets(),beforeWallets);assert.equal(await creditRows(),beforeCredit);
  });
  await t.test('published historical priced content is free without changing prices, privacy or entitlements',async()=>{
    const Topic=require('../models/LearningTopic'),Resource=require('../models/LearningResource'),Module=require('../models/LearningModule');
    const topic=await Topic.create({name:'Synthetic free topic',slug:'synthetic-free-topic',description:'Published synthetic topic',status:'published',createdBy:moderator._id});
    const resource=await Resource.create({topic:topic._id,title:'Synthetic priced resource',description:'Approved synthetic content',resourceType:'text',textContent:'Synthetic authorized lesson',reviewStatus:'published',creditCost:40,submittedBy:moderator._id});
    const module=await Module.create({topic:topic._id,title:'Synthetic module',description:'Approved module',resources:[resource._id],status:'published',createdBy:moderator._id,creditCost:60});
    const opened=await call(`learning/resources/${resource._id}`);assert.equal(opened.status,200);assert.equal(opened.body.data.creditCost,0);assert.equal(opened.body.data.textContent,'Synthetic authorized lesson');
    const lesson=await call(`learning/modules/${module._id}`);assert.equal(lesson.body.data.resources[0].locked,false);
    assert.equal((await call(`learning/resources/${resource._id}/unlock`,'POST',{})).status,200);
    assert.equal((await Resource.findById(resource._id)).creditCost,40);assert.equal((await Module.findById(module._id)).creditCost,60);
    await Resource.updateOne({_id:resource._id},{$set:{reviewStatus:'archived'}});assert.equal((await call(`learning/resources/${resource._id}`)).status,404);
    assert.equal(await wallets(),beforeWallets);assert.equal(await creditRows(),beforeCredit);
  });
  await t.test('missing confirmation or short actual evidence never creates tutoring EXP',async()=>{
    const row=await completeFixture(tutor,other,2),done=new Date(Date.now()-1000);
    await Session.updateOne({_id:row._id},{$set:{status:'completed',completedAt:done,validationSettledAt:done,learnerConfirmedAt:done}});
    await assert.rejects(engine.queueTutoring(String(row._id)),{code:'EXP_TUTORING_EVIDENCE'});
    await Session.updateOne({_id:row._id},{$set:{tutorConfirmedAt:done,startedAt:new Date(done-10*60000),awaitingValidationAt:new Date(done-60000)}});
    await assert.rejects(engine.queueTutoring(String(row._id)),{code:'EXP_TUTORING_EVIDENCE'});assert.equal(await Award.countDocuments({sourceId:row._id}),0);
  });
  await t.test('verification freezes an old promised grant while new registration creates no credit obligation',async()=>{
    const verified=await call('auth/verify-email','POST',{token:verification.token},null);assert.equal(verified.status,200,JSON.stringify(verified));
    const existing=await User.findById(pendingGrant._id).select('+openingGrantEligible +openingGrantAmount +openingGrantFrozenAt').lean();
    assert.equal(existing.emailVerified,true);assert.equal(existing.credits,0);assert.equal(existing.openingGrantEligible,true);assert.equal(existing.openingGrantAmount,50);assert.ok(existing.openingGrantFrozenAt);
    const email=require('../services/emailService'),previous=email.sendVerificationEmail;let captured;
    email.sendVerificationEmail=async value=>{captured=value.token;};
    try{
      const registered=await call('auth/register','POST',{name:'Synthetic new student',email:'new-student@phinmaed.com',password:'Synthetic-only-qa-123!',policyAccepted:true},null);assert.equal(registered.status,201,JSON.stringify(registered));
      const loginBody={email:'new-student@phinmaed.com',password:'Synthetic-only-qa-123!'};
      assert.equal((await call('auth/login','POST',loginBody,null)).status,403);
      const row=await User.findOne({email:'new-student@phinmaed.com'}).select('+openingGrantEligible');assert.equal(row.credits,0);assert.notEqual(row.openingGrantEligible,true);
      assert.equal((await call('auth/verify-email','POST',{token:captured},null)).status,200);assert.equal((await User.findById(row._id)).credits,0);const login=await call('auth/login','POST',loginBody,null);assert.equal(login.status,200);assert.equal(login.body.data.user.experience.freeLearning,true);
    }finally{email.sendVerificationEmail=previous;}
    assert.equal(await creditRows(),beforeCredit);
  });

  await t.test('missing durable quota uniqueness fails closed before a provider request',async()=>{
    await Quota.collection.dropIndex('uniq_acadi_owner_day');
    const service=require('../services/acadiConversation').createAcadiConversation({config,provider:{generate:async()=>{throw new Error('Must not reach provider');}}});
    await assert.rejects(service.setConsent(String(peerTwo._id),{general:true,context:false}),{code:'ACADI_INDEXES_REQUIRED'});
    await Quota.createIndexes();
  });
  await t.test('ten real finalized claims derive stable mentor/unique-learner achievements and reversals revoke them',async()=>{
    const fresh=await User.create(Array.from({length:6},(_,i)=>({name:'Synthetic badge actor '+i,email:`badge-${i}@example.test`,password:'synthetic-only',emailVerified:true,credits:0,skillsToTeach:['Networking']})));
    const mentor=fresh[0],pupils=fresh.slice(1);let clock;
    const verified=await engine.createIsolatedExpEngine({clock:()=>clock});let positive;
    for(let i=0;i<10;i++){
      const done=new Date(Date.now()-(80-i*7)*86400000),start=new Date(+done-25*60000);clock=new Date(+done+49*3600000);
      const row=await Session.create({learner:pupils[i%5]._id,tutor:mentor._id,subject:'Networking',economyVersion:'free-v1',creditAmount:0,lifecycleVersion:1,status:'completed',scheduledAt:start,learnerCheckedInAt:start,tutorCheckedInAt:start,startedAt:start,awaitingValidationAt:new Date(+done-60000),learnerConfirmedAt:new Date(+done-20000),tutorConfirmedAt:new Date(+done-10000),completedAt:done,validationSettledAt:done});
      const claim=await verified.queueTutoring(String(row._id));await verified.finalizeTutoring(String(claim._id));positive=await Ledger.findOne({award:claim._id});
    }
    const summary=require('../services/growthPresentation').summary;
    const result=await summary(String(mentor._id));assert.equal(result.totalExp,500);assert.equal(result.rank.level,4);assert.equal(result.badges.find(b=>b.id==='helping-hand').earned,true);assert.equal(result.badges.find(b=>b.id==='consistent-mentor').earned,true);
    assert.deepEqual((await summary(String(mentor._id))).badges,result.badges);
    await verified.reverseAward(String(positive._id),String(admin._id),'Synthetic review reverses the tenth contribution');
    const revised=await summary(String(mentor._id));assert.equal(revised.totalExp,450);assert.equal(revised.rank.level,3);assert.equal(revised.badges.find(b=>b.id==='consistent-mentor').revoked,true);assert.equal(revised.badges.find(b=>b.id==='helping-hand').earned,true);
  });

  await t.test('exhausted message throttling does not consume the separate revoke/clear allowance',async()=>{
    const owner=await User.create({name:'Synthetic privacy control student',email:'privacy-allowance@example.test',password:'synthetic-only',emailVerified:true,credits:0});
    assert.equal((await call('acadi/consent','PUT',{general:true,context:false},owner)).status,200);
    let last;for(let i=0;i<9;i++)last=await call('acadi/messages','POST',question(),owner);
    assert.equal(last.status,429);
    assert.equal((await call('acadi/consent','PUT',{general:false,context:false},owner)).status,200);
    assert.equal((await call('acadi/conversation','DELETE',undefined,owner)).status,200);
    assert.equal((await Consent.findOne({owner:owner._id})).general,false);
  });

  await t.test('a non-qualifying published result reports ineligible immediately and after refresh, never a fictitious pending award',async()=>{
    const row=await Assessment.create({title:'Synthetic publication without approval audit',topic:'Networks',status:'published',createdBy:moderator._id,approvedBy:moderator._id,publishedAt:new Date(Date.now()-60000),passingScore:70,questions:[0,1,2].map(i=>({prompt:'Evidence question '+i,options:['Correct','Other'],correctIndex:0}))});
    const result=await call(`assessments/${row._id}/submit`,'POST',{answers:[0,0,0]},peerTwo);assert.equal(result.status,200);assert.equal(result.body.data.passed,true);assert.equal(result.body.data.exp.status,'ineligible');assert.equal(result.body.data.exp.amount,0);
    const refresh=await call(`assessments/attempts/${result.body.data.id}`,'GET',undefined,peerTwo);assert.equal(refresh.body.data.exp.status,'ineligible');assert.equal(await Award.countDocuments({assessment:row._id}),0);
  });
});
