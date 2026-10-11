// Fixed loopback test replica set; no dotenv or configurable connection target.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Assessment = require('../models/Assessment');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const CreditTransaction = require('../models/CreditTransaction');
const Session = require('../models/Session');
const StudySet = require('../models/StudySet');
const StudyAttempt = require('../models/StudyAttempt');
const StudyReport = require('../models/StudyReport');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const { validationErrorHandler } = require('../middleware/validation');
test('genuine MongoDB learning clarity, eligibility and reward safety', { skip: process.env.ACADOVA_ENHANCEMENTS_DB_TESTS !== '1' }, async (t) => {
  assert.notEqual(process.env.NODE_ENV, 'production');
  const database = `acadova_learning_enhancements_${process.pid}`;
  await mongoose.connect(`mongodb://127.0.0.1:27029/${database}?replicaSet=acadovaPhase1`, { serverSelectionTimeoutMS:10000 });
  assert.equal((await mongoose.connection.db.admin().command({ hello:1 })).setName,'acadovaPhase1');
  const oldSecret=process.env.JWT_SECRET; process.env.JWT_SECRET='enhancements-loopback-test';
  const provider=global.fetch; global.fetch=async()=>assert.fail('External provider is forbidden');
  await Promise.all([User.init(),Assessment.init(),AssessmentAttempt.init(),CreditTransaction.init(),Session.init(),Notification.init(),StudySet.init(),StudyAttempt.init(),StudyReport.init(),AuditLog.init()]);
  const [student,tutor,other,staff] = await User.create(['student','tutor','other','moderator'].map((role,i)=>({name:`Learning Fixture ${i}`, email:`learning${i}@example.test`,password:'fixture-password',role:role==='moderator'?role:'student',credits:100,emailVerified:true,skillsToTeach:['Java']})));
  const app=express();app.use(express.json());app.use('/api/moderator/study-sets',require('../routes/studyModerationRoutes'));app.use('/api/study-sets',require('../routes/studyRoutes'));app.use('/api/users',require('../routes/userRoutes'));app.use('/api/assessments',require('../routes/assessmentRoutes'));app.use('/api/sessions',require('../routes/sessionRoutes'));app.use(validationErrorHandler);
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  t.after(async()=>{await new Promise(r=>server.close(r));assert.equal(mongoose.connection.db.databaseName,database);await mongoose.connection.dropDatabase();await mongoose.disconnect();global.fetch=provider;if(oldSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=oldSecret;});
  const call=async(path,actor=student,method='GET',body)=>{const r=await provider(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{authorization:`Bearer ${jwt.sign({id:String(actor._id)},process.env.JWT_SECRET)}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};
  await t.test('availability validation, own editing/clear, public timezone and outside-hours request remain allowed',async()=>{
    const availability={timezone:'Asia/Manila',ranges:[{day:1,start:'09:00',end:'10:00'}]};
    assert.equal((await call('/users/me',tutor,'PATCH',{weeklyAvailability:availability})).status,200);
    assert.deepEqual((await call(`/users/${tutor._id}`)).body.data.weeklyAvailability,availability);
    assert.equal((await call('/users/me',tutor,'PATCH',{weeklyAvailability:{...availability,timezone:'Invalid/Zone'}})).status,400);
    const at=new Date(Date.now()+48*3600000).toISOString();
    const request=await call('/sessions',student,'POST',{tutorId:String(tutor._id),subject:'Java',scheduledAt:at,meetingMethod:'online',requestMessage:'Outside usual hours but still allowed.'});
    assert.equal(request.status,201);const id=request.body.data._id;await Session.updateOne({_id:id},{$set:{status:'scheduled'}});
    assert.equal((await call('/users/me',tutor,'PATCH',{weeklyAvailability:null})).status,200);
    assert.equal((await Session.findById(id)).scheduledAt.toISOString(),at);assert.equal((await Session.findById(id)).status,'scheduled');
    assert.equal((await call(`/users/${tutor._id}`)).body.data.weeklyAvailability,null);
    assert.equal(await CreditTransaction.countDocuments(),0);
  });
  const questions=[0,1,0].map((correctIndex,i)=>({prompt:`Question ${i}`,options:['One','Two'],correctIndex}));
  const assessment=await Assessment.create({title:'Official Test',topic:'Java',questions,passingScore:70,status:'published',createdBy:staff._id});
  const route=`/assessments/${assessment._id}`;
  await t.test('practice before reward never consumes eligibility and cannot accept client reward flags',async()=>{
    assert.equal((await call(route)).body.data.rewardEligible,true);
    assert.equal(JSON.stringify((await call(route)).body).includes('correctIndex'),false);
    const r=await call(route+'/practice',student,'POST',{answers:[0,1,0]});assert.equal(r.status,200);assert.equal(r.body.data.mode,'practice');assert.equal(r.body.data.rewardEligible,true);assert.equal(r.body.data.creditsAwarded,0);
    assert.equal((await User.findById(student._id).select('+rewardedAssessments')).rewardedAssessments.length,0);
    assert.equal(await CreditTransaction.countDocuments(),0);
    assert.equal((await call(route+'/practice',student,'POST',{answers:[0,1,0],mode:'official'})).status,400);
    assert.equal((await call(route+'/practice',staff,'POST',{answers:[0,1,0]})).status,403);
  });
  await t.test('failed official retry and concurrent first passes issue exactly one reward',async()=>{
    const failed=await call(route+'/submit',student,'POST',{answers:[1,0,1]});assert.equal(failed.body.data.rewardEligible,true);assert.equal(failed.body.data.passed,false);
    const race=await Promise.all([call(route+'/submit',student,'POST',{answers:[0,1,0]}),call(route+'/submit',student,'POST',{answers:[0,1,0]})]);
    assert.deepEqual(race.map(r=>r.status),[200,200]);assert.equal(race.reduce((n,r)=>n+r.body.data.creditsAwarded,0),20);
    assert.equal(await CreditTransaction.countDocuments({assessment:assessment._id}),1);assert.equal((await User.findById(student._id)).credits,120);
    assert.equal((await call(route,other)).body.data.rewardEligible,true);assert.equal((await call(route)).body.data.rewardEarned,true);
    const ownResult=race[0].body.data.id;assert.equal((await call(`/assessments/attempts/${ownResult}`,other)).status,404);
  });
  await t.test('practice and already-rewarded submissions bypass production reward index gate; fresh reward fails closed',async()=>{
    const before=process.env.NODE_ENV;const indexes=CreditTransaction.collection.indexes;process.env.NODE_ENV='production';CreditTransaction.collection.indexes=async()=>[];
    try {assert.equal((await call(route+'/practice',other,'POST',{answers:[0,1,0]})).status,200);const r=await call(route+'/submit',student,'POST',{answers:[0,1,0]});assert.equal(r.status,200);assert.equal(r.body.data.mode,'practice');assert.equal(r.body.data.creditsAwarded,0);assert.equal((await call(route+'/submit',other,'POST',{answers:[0,1,0]})).status,503);}finally{CreditTransaction.collection.indexes=indexes;if(before===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=before;}
    assert.equal(await CreditTransaction.countDocuments(),1);assert.equal((await User.findById(other._id)).credits,100);
  });
  await t.test('private ownership, unfinished drafts, repeated quiz snapshots and deletion leave credits untouched',async()=>{
    const blank=await call('/study-sets',student,'POST',{title:'',subject:'',questions:[]});assert.equal(blank.status,201);
    const id=blank.body.data.id;assert.equal(blank.body.data.state,'private');
    assert.equal((await call('/study-sets/'+id,other)).status,404);
    assert.equal((await call('/study-sets/'+id+'/review',other)).status,404);
    assert.equal((await call('/study-sets/'+id+'/start',other,'POST',{})).status,404);
    assert.equal((await call('/study-sets/'+id+'/start',student,'POST',{})).status,400);
    const content={title:'Private arrays',subject:'Java',questions:[{prompt:'First index?',options:['0','1'],correctIndex:0,explanation:'Starts at zero.'}]};
    assert.equal((await call('/study-sets/'+id,other,'PATCH',{...content,version:1})).status,409);
    const edited=await call('/study-sets/'+id,student,'PATCH',{...content,version:1});assert.equal(edited.status,200);assert.equal(edited.body.data.revision,2);
    const started=await call('/study-sets/'+id+'/start',student,'POST',{});assert.equal(started.status,201);assert.equal(JSON.stringify(started.body).includes('correctIndex'),false);
    assert.equal((await call('/study-sets/attempts/'+started.body.data.id,other)).status,404);
    assert.equal((await call('/study-sets/'+id,student,'PATCH',{...content,questions:[{...content.questions[0],correctIndex:1}],version:2})).status,200);
    const result=await call('/study-sets/attempts/'+started.body.data.id+'/submit',student,'POST',{answers:[0]});assert.equal(result.body.data.score,100);assert.equal(result.body.data.questions[0].correctIndex,0);assert.equal(result.body.data.creditsAwarded,0);
    assert.equal((await call('/study-sets/attempts/'+started.body.data.id+'/submit',student,'POST',{answers:[0]})).status,409);
    const again=await call('/study-sets/'+id+'/start',student,'POST',{});assert.equal(again.status,201);
    const race=await Promise.all([call('/study-sets/attempts/'+again.body.data.id+'/submit',student,'POST',{answers:[1]}),call('/study-sets/attempts/'+again.body.data.id+'/submit',student,'POST',{answers:[0]})]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
    const final=await call('/study-sets/'+id+'/start',student,'POST',{});assert.equal(final.status,201);
    assert.equal((await call('/study-sets/'+id+'/delete',student,'POST',{version:3})).status,200);assert.equal((await call('/study-sets/'+id)).status,404);
    assert.equal((await call('/study-sets/attempts/'+final.body.data.id+'/submit',student,'POST',{answers:[1]})).body.data.score,100);
    assert.equal((await call('/study-sets/results',other)).body.data.length,0);
    assert.equal(await CreditTransaction.countDocuments(),1);assert.equal((await User.findById(student._id)).credits,120);
  });

  const publicContent={title:'Shared arrays',subject:'Java',description:'Safe public practice',questions:[{prompt:'First index?',options:['0','1'],correctIndex:0,explanation:'Start at zero.'}]};
  const created=await call('/study-sets',tutor,'POST',publicContent);const sharedId=created.body.data.id;const sharedRoute='/study-sets/'+sharedId;
  const current=async()=>StudySet.findById(sharedId);
  const decision=async(outcome,version)=>call('/moderator/study-sets/'+sharedId+'/decision',staff,'POST',{outcome,version:version??(await current()).version,reason:'Reviewed this exact study revision.'});
  await t.test('publication requires staff approval and reason; private/pending content and staff bypass remain denied',async()=>{
    assert.equal((await call('/study-sets',student,'POST',{...publicContent,state:'published'})).status,400);
    assert.equal((await call(sharedRoute,other)).status,404);
    assert.equal((await call(sharedRoute+'/publication',tutor,'POST',{version:1})).status,200);
    assert.equal((await call(sharedRoute,other)).status,404);assert.equal((await call('/study-sets/shared?q=Shared',other)).body.data.length,0);
    assert.equal((await call('/moderator/study-sets',other)).status,403);
    assert.equal((await call('/moderator/study-sets/'+sharedId+'/decision',other,'POST',{outcome:'approve',version:2,reason:'Forged student approval attempt.'})).status,403);
    assert.equal((await call('/moderator/study-sets/'+sharedId+'/decision',staff,'POST',{outcome:'approve',version:2,reason:''})).status,400);
    const race=await Promise.all([decision('approve',2),decision('reject',2)]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
    if((await current()).state==='rejected'){assert.equal((await call(sharedRoute+'/publication',tutor,'POST',{version:(await current()).version})).status,200);assert.equal((await decision('approve')).status,200);}
    const visible=await call(sharedRoute,other);assert.equal(visible.status,200);assert.equal(visible.body.data.authorName,tutor.name);assert.equal(visible.body.data.isOwner,false);
    for(const key of ['correctIndex','explanation','decision','owner','version']) assert.equal(JSON.stringify(visible.body).includes('"'+key+'"'),false);
    assert.equal((await call('/study-sets/shared?q=Shared',other)).body.data.length,1);assert.equal((await call('/study-sets/shared?q=%5B',other)).body.data.length,0);
    assert.equal((await call(sharedRoute+'/review',other)).body.data.questions[0].correctIndex,0);
    assert.ok(await AuditLog.exists({targetId:sharedId,action:'study.publication_decided','metadata.reason':'Reviewed this exact study revision.'}));
    assert.equal(await Notification.countDocuments({relatedId:sharedId,type:'study.published'}),1);
  });
  await t.test('duplicate public reports converge; staff report closure requires a reason and audit; safe reopening',async()=>{
    const reports=await Promise.all([call(sharedRoute+'/report',other,'POST',{reason:'Please review the accuracy of this set.'}),call(sharedRoute+'/report',other,'POST',{reason:'Duplicate active report request.'})]);
    assert.deepEqual(reports.map(r=>r.status),[200,200]);assert.equal(reports[0].body.data.id,reports[1].body.data.id);assert.equal(await StudyReport.countDocuments({studySet:sharedId,state:'open'}),1);
    assert.equal((await call(sharedRoute+'/report',tutor,'POST',{reason:'Cannot report my own published set.'})).status,404);
    const queue=await call('/moderator/study-sets',staff);assert.equal(queue.body.data.find(row=>row.id===sharedId).reports.length,1);
    const report=await StudyReport.findOne({studySet:sharedId,reporter:other._id});const route='/moderator/study-sets/reports/'+report._id+'/close';
    assert.equal((await call(route,other,'POST',{reason:'Forged closure reason text.',version:1})).status,403);
    const auditCreate=AuditLog.create;AuditLog.create=async()=>{throw new Error('simulated report audit failure');};try{assert.equal((await call(route,staff,'POST',{reason:'Audited closure must roll back on failure.',version:1})).status,503);}finally{AuditLog.create=auditCreate;}assert.equal((await StudyReport.findById(report._id)).state,'open');
    assert.equal((await call(route,staff,'POST',{reason:'Reviewed and found no policy issue.',version:1})).status,200);
    assert.equal((await call(route,staff,'POST',{reason:'Repeated stale report closure.',version:1})).status,409);
    assert.ok(await AuditLog.exists({targetId:String(report._id),action:'study.report_closed'}));
    assert.equal((await call(sharedRoute+'/report',other,'POST',{reason:'New information for another review.'})).status,200);assert.equal((await StudyReport.findById(report._id)).cycle,2);
  });
  await t.test('unpublish/revision change cancels public active access but submitted own results persist; withdraw and reapproval',async()=>{
    const finished=await call(sharedRoute+'/start',other,'POST',{});const finishedResult=await call('/study-sets/attempts/'+finished.body.data.id+'/submit',other,'POST',{answers:[0]});assert.equal(finishedResult.body.data.score,100);
    const active=await call(sharedRoute+'/start',other,'POST',{});assert.equal(active.status,201);
    assert.equal((await call(sharedRoute+'/withdraw',tutor,'POST',{version:(await current()).version})).status,200);
    assert.equal((await call(sharedRoute,other)).status,404);assert.equal((await call(sharedRoute+'/review',other)).status,404);assert.equal((await call('/study-sets/attempts/'+active.body.data.id,other)).status,409);
    assert.equal((await call('/study-sets/attempts/'+active.body.data.id+'/submit',other,'POST',{answers:[0]})).status,409);assert.equal((await call('/study-sets/attempts/'+finished.body.data.id,other)).status,200);
    assert.equal((await call(sharedRoute+'/publication',tutor,'POST',{version:(await current()).version})).status,200);
    assert.equal((await call(sharedRoute+'/withdraw',tutor,'POST',{version:(await current()).version})).status,200);assert.equal((await current()).state,'private');
    assert.equal((await call(sharedRoute+'/publication',tutor,'POST',{version:(await current()).version})).status,200);assert.equal((await decision('approve')).status,200);
    assert.equal((await call('/study-sets/attempts/'+active.body.data.id+'/submit',other,'POST',{answers:[0]})).status,409,'republishing never revives old publication token');
    const oldVersion=(await current()).version;assert.equal((await call(sharedRoute,tutor,'PATCH',{...publicContent,title:'Changed private revision',version:oldVersion})).status,200);assert.equal((await current()).state,'private');assert.equal((await call('/study-sets/shared',other)).body.data.length,0);
    assert.equal((await decision('approve',oldVersion)).status,409);
    assert.equal((await call(sharedRoute+'/publication',tutor,'POST',{version:(await current()).version})).status,200);assert.equal((await decision('approve')).status,200);
  });
  await t.test('removal closes reports atomically, restore requires current reasoned revision, audit/notification failure rolls back',async()=>{
    const active=await call(sharedRoute+'/start',other,'POST',{});assert.equal(active.status,201);
    assert.equal((await decision('remove')).status,200);assert.equal((await current()).state,'removed');assert.equal(await StudyReport.countDocuments({studySet:sharedId,state:'open'}),0);
    assert.equal((await call(sharedRoute,other)).status,404);assert.equal((await call('/study-sets/attempts/'+active.body.data.id+'/submit',other,'POST',{answers:[0]})).status,409);
    assert.equal((await decision('restore')).status,200);const prior=await current();
    const createAudit=AuditLog.create;AuditLog.create=async()=>{throw new Error('simulated audit failure');};try{assert.equal((await decision('remove')).status,503);}finally{AuditLog.create=createAudit;}
    assert.equal((await current()).state,'published');assert.equal((await current()).version,prior.version);
    const publish=require('../services/notificationService').publish;require('../services/notificationService').publish=async()=>{throw new Error('simulated notification failure');};try{assert.equal((await decision('remove')).status,503);}finally{require('../services/notificationService').publish=publish;}
    assert.equal((await current()).state,'published');assert.equal((await current()).version,prior.version);
    assert.ok(await Notification.exists({relatedId:sharedId,type:'study.removed'}));
  });
  await t.test('new study routes enforce anonymous, suspended, verification and staff roles; moderation links and audit filters are authorized',async()=>{
    const capped=await StudySet.create({...publicContent,owner:tutor._id,state:'published',approvedRevision:1,publicationId:'isolated-cap-fixture'});await StudyReport.insertMany(Array.from({length:100},()=>({studySet:capped._id,reporter:new mongoose.Types.ObjectId(),reason:'Synthetic full review queue fixture.',revision:1,state:'open'})));assert.equal((await call('/study-sets/'+capped._id+'/report',other,'POST',{reason:'A full queue must remain bounded.'})).status,429);assert.equal(await StudyReport.countDocuments({studySet:capped._id}),100);
    const native=await provider(`http://127.0.0.1:${server.address().port}/api/study-sets/shared`);assert.equal(native.status,401);
    const rejected=await call('/study-sets',student,'POST',publicContent);assert.equal((await call('/study-sets/'+rejected.body.data.id+'/publication',student,'POST',{version:1})).status,200);assert.equal((await call('/moderator/study-sets/'+rejected.body.data.id+'/decision',staff,'POST',{outcome:'reject',version:2,reason:'Revise the question explanations before sharing.'})).status,200);assert.equal((await call('/study-sets/'+rejected.body.data.id,student)).body.data.state,'rejected');assert.equal((await call('/study-sets/'+rejected.body.data.id,other)).status,404);assert.ok(await Notification.exists({relatedId:rejected.body.data.id,type:'study.rejected'}));
    const denied=await User.create({name:'Denied Fixture',email:'denied@example.test',password:'fixture-password',role:'student',emailVerified:false});assert.equal((await call('/study-sets/shared',denied)).status,403);
    await User.updateOne({_id:denied._id},{$set:{emailVerified:true,suspendedAt:new Date()}});assert.equal((await call('/study-sets',denied,'POST',publicContent)).status,403);
    const admin=await User.create({name:'Admin Fixture',email:'admin-study@example.test',password:'fixture-password',role:'admin',emailVerified:true});
    assert.equal((await call('/study-sets',admin,'POST',publicContent)).status,403);
    assert.equal((await decision('remove')).status,200);assert.equal((await call('/moderator/study-sets?view=removed',admin)).body.data.some(row=>row.id===sharedId),true);
    const restored=await call('/moderator/study-sets/'+sharedId+'/decision',admin,'POST',{outcome:'restore',version:(await current()).version,reason:'Admin independently reviewed this exact revision.'});assert.equal(restored.status,200);
    const links=require('../services/notificationService');assert.equal(links.linkFor({relatedType:'StudySet',relatedId:sharedId},'student'),'/study-sets/'+sharedId);assert.equal(links.linkFor({relatedType:'StudySet',relatedId:sharedId},'admin'),'/admin/study-sets?set='+sharedId);
    const res={statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};await require('../controllers/adminAuditController').listAuditLogs({query:{targetType:'StudySet',action:'study.publication_decided'}},res);assert.equal(res.statusCode,200);assert.ok(res.body.data.length>0);
  });
  await t.test('report index gate, self-review prohibition after role change and public-submit/unpublish race',async()=>{
    const env=process.env.NODE_ENV;const indexes=StudyReport.collection.indexes;process.env.NODE_ENV='production';StudyReport.collection.indexes=async()=>[];try{assert.equal((await call(sharedRoute+'/report',other,'POST',{reason:'Cannot report without unique index.'})).status,503);}finally{StudyReport.collection.indexes=indexes;if(env===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=env;}
    const attempt=await call(sharedRoute+'/start',other,'POST',{});const race=await Promise.all([call('/study-sets/attempts/'+attempt.body.data.id+'/submit',other,'POST',{answers:[0]}),call(sharedRoute+'/withdraw',tutor,'POST',{version:(await current()).version})]);
    assert.equal(race[1].status,200);assert.ok([200,409].includes(race[0].status));const stored=await StudyAttempt.findById(attempt.body.data.id);assert.equal(Boolean(stored.submittedAt),race[0].status===200);
    const own=await call('/study-sets',other,'POST',publicContent);assert.equal((await call('/study-sets/'+own.body.data.id+'/publication',other,'POST',{version:1})).status,200);await User.updateOne({_id:other._id},{$set:{role:'moderator'}});
    assert.equal((await call('/moderator/study-sets/'+own.body.data.id+'/decision',other,'POST',{outcome:'approve',version:2,reason:'My own set must not be self-approved.'})).status,403);
    assert.equal(await CreditTransaction.countDocuments(),1);assert.equal((await User.findById(tutor._id)).credits,100);assert.equal((await User.findById(other._id)).credits,100);
  });

});
