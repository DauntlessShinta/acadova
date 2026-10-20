const test = require('node:test'); const assert = require('node:assert/strict');
const mongoose = require('mongoose'); const express = require('express'); const jwt = require('jsonwebtoken');
const User = require('../models/User'); const Circle = require('../models/StudyCircle'); const Volunteer = require('../models/VolunteerHost');
const StudySet = require('../models/StudySet'); const Report = require('../models/StudyReport'); const Audit = require('../models/AuditLog');
const Ledger = require('../models/CreditTransaction'); const Session = require('../models/Session'); const models = require('../models/academic');
test('Bundle C disposable API integration: free circles, safe sharing, moderation and privacy', { skip: process.env.ACADOVA_BUNDLE_C_DB_TESTS !== '1' }, async t => {
  assert.notEqual(process.env.NODE_ENV, 'production'); const database = `acadova_bundle_c_test_${process.pid}`; const oldSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'bundle-c-synthetic-test-only';
  await mongoose.connect(`mongodb://127.0.0.1:27031/${database}?replicaSet=acadovaAiQA`, { serverSelectionTimeoutMS: 10000 });
  assert.equal((await mongoose.connection.db.admin().command({ hello: 1 })).setName, 'acadovaAiQA');
  await Promise.all([User, Circle, Volunteer, StudySet, Report, Audit, Ledger, Session, ...Object.values(models)].map(m => m.init()));
  t.after(async () => { assert.equal(mongoose.connection.name, database); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret; });
  const [a, b, c, d, moderator] = await User.create(['Alice', 'Bob', 'Carol', 'Dan', 'Moderator'].map(name => ({ name, email: `${name}@example.test`, password: 'synthetic', emailVerified: true, role: name === 'Moderator' ? 'moderator' : 'student', credits: 100 })));
  const [scheduleHost,invalidHost,providerHost,uploadHost]=await User.create(['ScheduleHost','InvalidHost','ProviderHost','UploadHost'].map(name=>({name,email:name+'@example.test',password:'synthetic',emailVerified:true,role:'student',credits:100})));
  const historical = await Session.create({ learner: a._id, tutor: b._id, subject: 'Historical paid session', creditAmount: 50, status: 'completed', creditsSettledAt: new Date() });
  await Ledger.create({ type: 'session_payment', fromUser: a._id, toUser: b._id, session: historical._id, amount: 50 });
  const walletSnapshot = JSON.stringify(await User.find().select('_id credits').sort({ _id: 1 }).lean()); const ledgerSnapshot = JSON.stringify(await Ledger.find().lean()); const sessionSnapshot = JSON.stringify(await Session.find().lean());
  const term = await models.AcademicTerm.create({ owner: a._id, startYear: 2026, endYear: 2027, semester: 'Private term' });
  const subject = await models.PersonalSubject.create({ owner: a._id, termId: term._id, name: 'Secret subject', instructor: 'Private instructor' });
  const resource = await models.AcademicResource.create({ owner: a._id, subjectId: subject._id, title: 'Private source PDF', kind: 'pdf', fileName: 'private.pdf', bytes: 15, content: Buffer.from('synthetic-file') });
  let uploadExtractCalls=0,uploadProviderCalls=0;
  const uploadConfig=require('../config/aiStudy').aiStudyConfig({NODE_ENV:'test',AI_STUDY_ENABLED:'true',AI_STUDY_LOCAL_QA:'true',GEMINI_API_KEY:'synthetic-offline-only'});
  const app = express(); app.use(express.json());app.use('/api/ai-study',require('../routes/aiStudyRoutes').createAiStudyRouter({configFor:()=>uploadConfig,extract:async()=>{uploadExtractCalls++;throw Error('Unexpected extraction');},provider:{generate:async()=>{uploadProviderCalls++;throw Error('Unexpected provider');}}})); app.use('/api/study-circles', require('../routes/studyCircleRoutes')); app.use('/api/study-sharing', require('../routes/studySharingRoutes')); app.use('/api/study-sets', require('../routes/studyRoutes')); app.use('/api/moderator/study-sets', require('../routes/studyModerationRoutes')); app.use('/api/academic', require('../routes/academicWorkspaceRoutes')); app.use(require('../middleware/validation').validationErrorHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r)); t.after(() => new Promise(r => server.close(r)));
  const root = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, method = 'GET', body, actor = a) => { const r = await fetch(root + '/api/' + path, { method, headers: { 'content-type': 'application/json', ...(actor ? { authorization: `Bearer ${jwt.sign({ id: String(actor._id) }, process.env.JWT_SECRET)}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, data: await r.json(), cache: r.headers.get('cache-control') }; };
  const draft = () => ({ title: 'Synthetic Math Circle', description: 'Bring questions about algebra.', tags: ['Math'], startsAt: new Date(Date.now() + 86400000).toISOString(), endsAt: new Date(Date.now() + 90000000).toISOString(), timezone: 'Asia/Manila', capacity: 1, subjectId: String(subject._id), meetingUrl: 'https://meet.google.com/abc-defg-hij' });
  let circle;
  await t.test('create is free; public-safe listings and direct-ID responses conceal private fields and meeting URLs', async () => {
    const created = await call('study-circles', 'POST', draft()); assert.equal(created.status, 201, JSON.stringify(created)); circle = created.data.data; assert.equal(circle.kind, 'free_study_circle'); assert.ok(circle.meetingUrl);
    assert.equal((await call('study-circles', 'POST', draft(), b)).status, 404);
    const listed = await call('study-circles?q=Math&tag=Math', 'GET', undefined, c); assert.equal(listed.status, 200); assert.equal(listed.data.data.length, 1); assert.equal(listed.cache, 'private, no-store');
    const text = JSON.stringify(listed.data); for (const secret of ['meetingUrl', 'subjectId', 'participants', 'email', 'Secret subject', 'Private instructor', 'private.pdf']) assert.ok(!text.includes(secret), secret);
    const direct = await call(`study-circles/${circle.id}`, 'GET', undefined, c); assert.equal(direct.status, 200); assert.equal(direct.data.data.meetingUrl, undefined); assert.equal(direct.data.data.subjectId, undefined);
    assert.equal((await call('study-circles', 'GET', undefined, null)).status, 401);
  });
  await t.test('host, duplicate, capacity and cross-user management checks are enforced server-side', async () => {
    assert.equal((await call(`study-circles/${circle.id}/join`, 'POST', {})).status, 409);
    const joined = await call(`study-circles/${circle.id}/join`, 'POST', {}, b); assert.equal(joined.status, 200); assert.ok(joined.data.data.meetingUrl); assert.equal(joined.data.data.subjectId, undefined);
    assert.equal((await call(`study-circles/${circle.id}/join`, 'POST', {}, b)).status, 409);
    assert.equal((await call(`study-circles/${circle.id}/join`, 'POST', {}, c)).status, 409);
    assert.equal((await call(`study-circles/${circle.id}/cancel`, 'POST', { version: joined.data.data.version }, b)).status, 403);
    assert.equal((await call(`study-circles/${circle.id}/edit`, 'POST', { ...draft(), version: joined.data.data.version }, b)).status, 403);
    assert.equal((await call(`study-circles/${circle.id}/leave`, 'POST', {}, b)).status, 200);
    assert.equal((await call(`study-circles/${circle.id}`, 'GET', undefined, b)).data.data.meetingUrl, undefined);
  });
  await t.test('concurrent capacity joins cannot overbook and canceled links stop resolving', async () => {
    const joined = await Promise.all([b, c, d].map(actor => call(`study-circles/${circle.id}/join`, 'POST', {}, actor)));
    assert.equal(joined.filter(r => r.status === 200).length, 1, JSON.stringify(joined)); assert.equal((await Circle.findById(circle.id).select('+participants')).participants.length, 1);
    circle = (await call(`study-circles/${circle.id}`)).data.data;
    assert.equal((await call(`study-circles/${circle.id}/cancel`, 'POST', { version: 1 })).status, 409);
    const canceled = await call(`study-circles/${circle.id}/cancel`, 'POST', { version: circle.version }); assert.equal(canceled.status, 200); assert.equal(canceled.data.data.meetingUrl, undefined);
    assert.equal((await call(`study-circles/${circle.id}/join`, 'POST', {}, d)).status, 409);
    assert.equal((await call('study-circles')).data.data.length, 0);
  });
  await t.test('new schedule policy rejects forged bounds and stores exact supported UTC schedules', async () => {
    const body={...draft(),subjectId:null}, start=Date.parse(body.startsAt);
    for(const minutes of [30,60,90,120,180]){
      const input={...body,endsAt:new Date(start+minutes*60000).toISOString()};const result=await call('study-circles','POST',input,scheduleHost);assert.equal(result.status,201,JSON.stringify(result));
      assert.equal(result.data.data.startsAt,input.startsAt);assert.equal(result.data.data.endsAt,input.endsAt);
      const stored=await Circle.findById(result.data.data.id);assert.equal(stored.startsAt.toISOString(),input.startsAt);assert.equal(stored.endsAt.toISOString(),input.endsAt);assert.equal(stored.timezone,'Asia/Manila');
      await call(`study-circles/${stored.id}/cancel`,'POST',{version:result.data.data.version},scheduleHost);
    }
    for(const [patch,message] of [
      [{startsAt:new Date(Date.now()-60000).toISOString()},/already passed/],
      [{startsAt:new Date(Date.now()+181*86400000).toISOString()},/180 days/],
      [{endsAt:body.startsAt},/after the start/],
      [{endsAt:new Date(start+29*60000).toISOString()},/between 30/],
      [{endsAt:new Date(start+181*60000).toISOString()},/between 30/],
    ]){const r=await call('study-circles','POST',{...body,...patch},invalidHost);assert.equal(r.status,400);assert.match(r.data.message,message);}
    assert.equal((await call('study-circles','POST',{...body,legacy:true},invalidHost)).status,400);
  });
  await t.test('historical longer circles remain readable and metadata edits preserve their exact schedule',async()=>{
    const body=draft(),start=Date.parse(body.startsAt),legacy={...body,endsAt:new Date(start+300*60000).toISOString()};
    const row=await Circle.create({...legacy,host:a._id});const read=await call(`study-circles/${row.id}`);assert.equal(read.status,200);assert.equal(read.data.data.endsAt,legacy.endsAt);
    const edited=await call(`study-circles/${row.id}/edit`,'POST',{...legacy,title:'Legacy metadata updated',version:1});assert.equal(edited.status,200,JSON.stringify(edited));assert.equal(edited.data.data.startsAt,legacy.startsAt);assert.equal(edited.data.data.endsAt,legacy.endsAt);
    assert.equal((await call(`study-circles/${row.id}/edit`,'POST',{...legacy,version:2},b)).status,403);
    assert.equal((await call(`study-circles/${row.id}/edit`,'POST',{...legacy,startsAt:new Date(start+60000).toISOString(),version:2})).status,400);
    const unchanged=await Circle.findById(row.id);assert.equal(unchanged.version,2);assert.equal(unchanged.startsAt.toISOString(),legacy.startsAt);assert.equal(unchanged.endsAt.toISOString(),legacy.endsAt);
    const revised={...legacy,startsAt:new Date(start+60000).toISOString(),endsAt:new Date(start+91*60000).toISOString(),version:2};const changed=await call(`study-circles/${row.id}/edit`,'POST',revised);assert.equal(changed.status,200);assert.equal(changed.data.data.endsAt,revised.endsAt);
    await call(`study-circles/${row.id}/cancel`,'POST',{version:changed.data.data.version});
  });
  await t.test('provider invitation links remain host/member-only and malicious links never save',async()=>{
    for(const link of ['https://meet.google.com/abc-defg-hij','https://us02web.zoom.us/j/123456?pwd=synthetic','https://teams.microsoft.com/meet/123?p=synthetic']){
      const created=await call('study-circles','POST',{...draft(),subjectId:null,meetingUrl:link},providerHost);assert.equal(created.status,201);const row=created.data.data;
      assert.equal((await call(`study-circles/${row.id}`,'GET',undefined,b)).data.data.meetingUrl,undefined);
      assert.equal((await call(`study-circles/${row.id}/join`,'POST',{},b)).data.data.meetingUrl,link);
      await call(`study-circles/${row.id}/leave`,'POST',{},b);assert.equal((await call(`study-circles/${row.id}`,'GET',undefined,b)).data.data.meetingUrl,undefined);
      const host=(await call(`study-circles/${row.id}`,'GET',undefined,providerHost)).data.data;await call(`study-circles/${row.id}/cancel`,'POST',{version:host.version},providerHost);
    }
    for(const link of ['javascript:alert(1)','https://meet.google.com.evil.test/abc-defg-hij','https://zoom.us/j/123?next=https://evil.test','https://teams.microsoft.com@evil.test/meet/123'])assert.equal((await call('study-circles','POST',{...draft(),subjectId:null,meetingUrl:link},providerHost)).status,400);
  });
  await t.test('configured synthetic multipart rejects >5 MiB, 8 MiB and 10 MiB before parsing, quota or provider',async()=>{
    for(const size of [5242881,8*1048576,10*1048576]){
      const bytes=Buffer.alloc(size);bytes.write('%PDF-1.7');const form=new FormData();form.append('document',new Blob([bytes],{type:'application/pdf'}),'synthetic.pdf');form.append('type','both');form.append('mode','strict_source');form.append('syntheticConsent','true');
      const token=jwt.sign({id:String(uploadHost._id)},process.env.JWT_SECRET);const response=await fetch(root+'/api/ai-study/generate',{method:'POST',headers:{authorization:'Bearer '+token},body:form});assert.equal(response.status,413);assert.match((await response.json()).message,/maximum 5 MiB/);
    }
    assert.equal(uploadExtractCalls,0);assert.equal(uploadProviderCalls,0);assert.equal(await require('../models/AiStudyQuota').countDocuments(),0);
  });
  await t.test('all circle transitions leave wallets, historical credit ledgers and Session records byte-equivalent', async () => {
    assert.equal(JSON.stringify(await User.find().select('_id credits').sort({ _id: 1 }).lean()), walletSnapshot);
    assert.equal(JSON.stringify(await Ledger.find().lean()), ledgerSnapshot); assert.equal(JSON.stringify(await Session.find().lean()), sessionSnapshot);
  });
  await t.test('volunteer capability is opt-in, self-declared, public-safe and removed by opt out or suspension', async () => {
    assert.deepEqual((await call('study-circles/volunteers')).data.data, []);
    assert.equal((await call('study-circles/volunteer-profile', 'PUT', { enabled: true, expertise: 'Self-declared Math', interests: 'Algebra' })).status, 200);
    let list = (await call('study-circles/volunteers?q=algebra', 'GET', undefined, b)).data.data; assert.equal(list.length, 1); assert.equal(list[0].selfDeclared, true); assert.equal(list[0].email, undefined); assert.equal(list[0].owner, undefined);
    await User.updateOne({ _id: a._id }, { $set: { suspendedAt: new Date() } }); assert.equal((await call('study-circles/volunteers', 'GET', undefined, b)).data.data.length, 0); await User.updateOne({ _id: a._id }, { $set: { suspendedAt: null } });
    await call('study-circles/volunteer-profile', 'PUT', { enabled: false, expertise: '', interests: '' }); assert.equal((await call('study-circles/volunteers')).data.data.length, 0);
  });
  await t.test('participant reporting, staff takedown, concurrency guards and audit work without meeting/source disclosure', async () => {
    let created = (await call('study-circles', 'POST', { ...draft(), title: 'Reported synthetic circle' })).data.data;
    assert.equal((await call(`study-circles/${created.id}/report`, 'POST', { reason: 'An outsider report must fail' }, c)).status, 403);
    await call(`study-circles/${created.id}/join`, 'POST', {}, b);
    assert.equal((await call(`study-circles/${created.id}/report`, 'POST', { reason: 'Synthetic content concern' }, b)).status, 200);
    assert.equal((await call('study-circles/moderation', 'GET', undefined, b)).status, 403);
    const list = await call('study-circles/moderation', 'GET', undefined, moderator); assert.equal(list.status, 200); assert.equal(list.data.data.length, 1); assert.ok(!JSON.stringify(list.data).includes('meetingUrl')); created = list.data.data[0];
    const decision = { version: created.version, outcome: 'cancel', reason: 'Synthetic moderator takedown' };
    assert.equal((await call(`study-circles/moderation/${created.id}`, 'POST', decision, moderator)).status, 200);
    assert.equal((await call(`study-circles/moderation/${created.id}`, 'POST', decision, moderator)).status, 409);
    assert.equal((await call(`study-circles/${created.id}`, 'GET', undefined, b)).data.data.meetingUrl, undefined);
    assert.equal(await Audit.countDocuments({ action: 'circle.report_reviewed' }), 1);
  });
  await t.test('host editing/removal, enrollment limits and completion never imply attendance or credits', async () => {
    let row = (await call('study-circles', 'POST', { ...draft(), subjectId: null, capacity: 2 }, c)).data.data;
    await call(`study-circles/${row.id}/join`, 'POST', {}, b); await call(`study-circles/${row.id}/join`, 'POST', {}, d);
    row = (await call(`study-circles/${row.id}`, 'GET', undefined, c)).data.data;
    assert.equal((await call(`study-circles/${row.id}/edit`, 'POST', { ...draft(), subjectId: null, capacity: 1, version: row.version }, c)).status, 409);
    const edited = await call(`study-circles/${row.id}/edit`, 'POST', { ...draft(), subjectId: null, title: 'Updated synthetic circle', capacity: 3, version: row.version }, c); assert.equal(edited.status, 200); row = edited.data.data;
    assert.equal((await call(`study-circles/${row.id}/remove`, 'POST', { version: row.version, participantId: String(b._id) }, c)).status, 200);
    assert.equal((await call(`study-circles/${row.id}`, 'GET', undefined, b)).data.data.meetingUrl, undefined);
    row = (await call(`study-circles/${row.id}`, 'GET', undefined, c)).data.data;
    assert.equal((await call(`study-circles/${row.id}/complete`, 'POST', { version: row.version }, c)).status, 409);
    await Circle.updateOne({ _id: row.id }, { $set: { startsAt: new Date(Date.now() - 7200000), endsAt: new Date(Date.now() - 3600000) } });
    assert.equal((await call(`study-circles/${row.id}/join`, 'POST', {}, b)).status, 409);
    const complete = await call(`study-circles/${row.id}/complete`, 'POST', { version: row.version }, c); assert.equal(complete.status, 200); assert.equal(complete.data.data.status, 'completed'); assert.equal(complete.data.data.meetingUrl, undefined);
    assert.equal(JSON.stringify(await Ledger.find().lean()), ledgerSnapshot);
  });
  await t.test('verification, suspension, role, malformed IDs and mass-assignment checks precede circle writes', async () => {
    assert.equal((await call('study-circles', 'POST', { ...draft(), credits: 1000 })).status, 400);
    assert.equal((await call('study-circles/not-an-id', 'GET')).status, 400);
    assert.equal((await call('study-circles', 'POST', draft(), moderator)).status, 403);
    await User.updateOne({ _id: d._id }, { $set: { emailVerified: false } }); assert.equal((await call('study-circles', 'GET', undefined, d)).status, 403);
    await User.updateOne({ _id: d._id }, { $set: { emailVerified: true, suspendedAt: new Date() } }); assert.equal((await call('study-circles', 'GET', undefined, d)).status, 403);
    await User.updateOne({ _id: d._id }, { $set: { suspendedAt: null } });
  });
  await t.test('an unavailable host cannot expose a link or accept joins, but enrolled students can still leave', async () => {
    const row = (await call('study-circles', 'POST', { ...draft(), subjectId: null }, c)).data.data;
    assert.equal((await call(`study-circles/${row.id}/join`, 'POST', {}, d)).status, 200);
    await User.updateOne({ _id: c._id }, { $set: { suspendedAt: new Date() } });
    assert.equal((await call(`study-circles/${row.id}`, 'GET', undefined, d)).status, 404);
    assert.equal((await call(`study-circles/${row.id}/join`, 'POST', {}, b)).status, 403);
    const mine = (await call('study-circles?view=mine', 'GET', undefined, d)).data.data.find(r => r.id === row.id); assert.equal(mine.hostUnavailable, true); assert.equal(mine.meetingUrl, undefined);
    assert.equal((await call(`study-circles/${row.id}/leave`, 'POST', {}, d)).status, 200);
    await User.updateOne({ _id: c._id }, { $set: { suspendedAt: null } });
  });
  const authored = { title: 'Student authored Algebra', subject: 'Math', description: 'Synthetic content only', questions: [{ prompt: 'Two plus two?', options: ['Four', 'Five'], correctIndex: 0, explanation: 'Addition.' }], flashcards: [{ front: 'Sum', back: 'Result of addition' }] }; let set, token;
  await t.test('private is default, IDs do not grant access, rights consent and ownership gate share creation', async () => {
    set = (await call('study-sets', 'POST', authored)).data.data;
    assert.equal((await call(`study-sets/${set.id}`, 'GET', undefined, b)).status, 404);
    assert.equal((await call(`study-sharing/${set.id}`, 'PUT', { version: set.version, visibility: 'unlisted', rightsAcknowledged: true }, b)).status, 404);
    assert.equal((await call(`study-sharing/${set.id}`, 'PUT', { version: set.version, visibility: 'unlisted' })).status, 400);
    const shared = await call(`study-sharing/${set.id}`, 'PUT', { version: set.version, visibility: 'unlisted', rightsAcknowledged: true }); assert.equal(shared.status, 200, JSON.stringify(shared)); token = shared.data.data.token; set.version = shared.data.data.version;
    assert.match(token, /^[a-f0-9]{64}$/); assert.notEqual((await StudySet.findById(set.id).select('+unlistedHash')).unlistedHash, token);
    assert.equal((await call(`study-sets/${set.id}`, 'GET', undefined, b)).status, 404);
    assert.equal((await call(`study-sharing/${set.id}/open`, 'POST', { token }, null)).status, 401);
    assert.equal((await call(`study-sharing/${set.id}/open`, 'POST', { token: 'a'.repeat(64) }, b)).status, 404);
    assert.equal((await call(`study-sharing/${set.id}/open`, 'POST', { token: { $ne: '' } }, b)).status, 400);
    const opened = await call(`study-sharing/${set.id}/open`, 'POST', { token }, b); assert.equal(opened.status, 200); assert.equal(opened.data.data.readOnly, true); assert.equal(opened.data.data.flashcards.length, 1);
    for (const field of ['owner', 'email', 'sourceResourceIds', 'subjectId', 'moduleId', 'ai', 'practiceHistory', 'unlistedHash', 'decision']) assert.equal(opened.data.data[field], undefined, field);
    assert.equal((await call('study-sets/shared')).data.data.length, 0);
  });
  await t.test('rotation, revocation, stale replay and concurrent transitions revoke previous links immediately', async () => {
    const changes = await Promise.all([1, 2].map(() => call(`study-sharing/${set.id}`, 'PUT', { version: set.version, visibility: 'unlisted', rightsAcknowledged: true })));
    assert.equal(changes.filter(r => r.status === 200).length, 1); assert.equal(changes.filter(r => r.status === 409).length, 1);
    assert.equal((await call(`study-sharing/${set.id}/open`, 'POST', { token }, b)).status, 404); const changed = changes.find(r => r.status === 200).data.data; token = changed.token; set.version = changed.version;
    assert.equal((await call(`study-sharing/${set.id}/open`, 'POST', { token }, b)).status, 200);
    const revoked = await call(`study-sharing/${set.id}`, 'PUT', { version: set.version, visibility: 'private' }); assert.equal(revoked.status, 200); set.version = revoked.data.data.version;
    assert.equal((await call(`study-sharing/${set.id}/open`, 'POST', { token }, b)).status, 404);
  });
  await t.test('unlisted reports use existing staff review; removal revokes access and cannot silently become public on restore', async () => {
    const shared = (await call(`study-sharing/${set.id}`, 'PUT', { version: set.version, visibility: 'unlisted', rightsAcknowledged: true })).data.data; token = shared.token; set.version = shared.version;
    assert.equal((await call(`study-sharing/${set.id}/report`, 'POST', { token, reason: 'Synthetic sharing concern' }, b)).status, 200);
    const list = await call('moderator/study-sets', 'GET', undefined, moderator); const item = list.data.data.find(r => r.id === set.id); assert.ok(item); assert.equal(item.unlistedHash, undefined); assert.equal(item.subjectId, undefined);
    const removed = await call(`moderator/study-sets/${set.id}/decision`, 'POST', { version: item.version, outcome: 'remove', reason: 'Synthetic unlisted takedown' }, moderator); assert.equal(removed.status, 200, JSON.stringify(removed)); set.version = removed.data.data.version;
    assert.equal((await call(`study-sharing/${set.id}/open`, 'POST', { token }, b)).status, 404);
    assert.equal((await call(`moderator/study-sets/${set.id}/decision`, 'POST', { version: set.version, outcome: 'restore', reason: 'Must not promote unlisted to public' }, moderator)).status, 409);
    assert.equal((await call(`study-sharing/${set.id}`, 'PUT', { version: set.version, visibility: 'unlisted', rightsAcknowledged: true })).status, 409);
  });
  await t.test('a historical report grants no access to a later private draft or authority to remove that new revision', async () => {
    const row = (await call('study-sets', 'POST', authored)).data.data;
    const link = (await call(`study-sharing/${row.id}`, 'PUT', { version: row.version, visibility: 'unlisted', rightsAcknowledged: true })).data.data;
    await call(`study-sharing/${row.id}/report`, 'POST', { token: link.token, reason: 'Historical synthetic reported revision' }, b);
    const edited = await call(`study-sets/${row.id}`, 'PATCH', { ...authored, title: 'NEW_PRIVATE_CONTENT', flashcards: [{ front: 'NEW_PRIVATE_CONTENT', back: 'NEW_PRIVATE_CONTENT' }], version: link.version }); assert.equal(edited.status, 200);
    const reviewed = await call(`moderator/study-sets/${row.id}`, 'GET', undefined, moderator); assert.equal(reviewed.status, 200); assert.equal(reviewed.data.data.contentUnavailable, true); assert.ok(!JSON.stringify(reviewed.data).includes('NEW_PRIVATE_CONTENT'));
    assert.equal((await call(`moderator/study-sets/${row.id}/decision`, 'POST', { version: edited.data.data.version, outcome: 'remove', reason: 'A stale report cannot remove new private content' }, moderator)).status, 409);
    const report = reviewed.data.data.reports[0]; assert.ok(report);
    assert.equal((await call(`moderator/study-sets/reports/${report.id}/close`, 'POST', { version: report.cycle, reason: 'Reported revision changed; closing historical report' }, moderator)).status, 200);
    assert.equal((await call(`study-sharing/${row.id}/open`, 'POST', { token: link.token }, b)).status, 404);
  });
  await t.test('reporting a newly shared revision replaces a stale open report cycle without duplicate reports', async () => {
    const row = (await call('study-sets', 'POST', authored)).data.data;
    const first = (await call(`study-sharing/${row.id}`, 'PUT', { version: row.version, visibility: 'unlisted', rightsAcknowledged: true })).data.data;
    await call(`study-sharing/${row.id}/report`, 'POST', { token: first.token, reason: 'First synthetic shared revision report' }, b);
    const old = (await call(`moderator/study-sets/${row.id}`, 'GET', undefined, moderator)).data.data.reports[0];
    const edit = (await call(`study-sets/${row.id}`, 'PATCH', { ...authored, title: 'Explicitly shared revised content', version: first.version })).data.data;
    const next = (await call(`study-sharing/${row.id}`, 'PUT', { version: edit.version, visibility: 'unlisted', rightsAcknowledged: true })).data.data;
    assert.equal((await call(`study-sharing/${row.id}/report`, 'POST', { token: next.token, reason: 'Latest synthetic shared revision report' }, b)).status, 200);
    const current = (await call(`moderator/study-sets/${row.id}`, 'GET', undefined, moderator)).data.data;
    assert.equal(current.contentUnavailable, undefined); assert.equal(current.reports.length, 1); assert.equal(current.reports[0].revision, edit.revision); assert.equal(current.reports[0].cycle, old.cycle + 1);
    assert.equal((await call(`moderator/study-sets/reports/${old.id}/close`, 'POST', { version: old.cycle, reason: 'Stale report closure must not erase latest report' }, moderator)).status, 409);
    assert.equal((await call(`moderator/study-sets/${row.id}/decision`, 'POST', { version: next.version, outcome: 'remove', reason: 'Synthetic current revision takedown' }, moderator)).status, 200);
  });
  await t.test('explicit public review remains required; editing clears publication and unlisted tokens', async () => {
    const edited = await call(`study-sets/${set.id}`, 'PATCH', { ...authored, version: set.version }); assert.equal(edited.status, 200); set = edited.data.data;
    assert.equal((await call(`study-sharing/${set.id}`, 'PUT', { version: set.version, visibility: 'public', rightsAcknowledged: true })).status, 400);
    const pending = await call(`study-sets/${set.id}/publication`, 'POST', { version: set.version }); assert.equal(pending.status, 200); set = pending.data.data; assert.equal((await call('study-sets/shared')).data.data.length, 0);
    const approved = await call(`moderator/study-sets/${set.id}/decision`, 'POST', { version: set.version, outcome: 'approve', reason: 'Synthetic authorized content review' }, moderator); assert.equal(approved.status, 200); set = approved.data.data;
    assert.equal((await call('study-sets/shared?q=Algebra')).data.data.length, 1);
    const publicSet = await call(`study-sets/${set.id}`, 'GET', undefined, b); assert.equal(publicSet.data.data.flashcards[0].front, 'Sum'); assert.equal(publicSet.data.data.subjectId, undefined);
    const attempt = await call(`study-sets/${set.id}/start`, 'POST', {}, b); assert.equal(attempt.status, 201);
    assert.equal((await call(`study-sets/attempts/${attempt.data.data.id}`, 'GET', undefined, a)).status, 404);
    const withdrawn = await call(`study-sharing/${set.id}`, 'PUT', { version: set.version, visibility: 'private' }); assert.equal(withdrawn.status, 200);
    assert.equal((await call(`study-sets/attempts/${attempt.data.data.id}/submit`, 'POST', { answers: [0] }, b)).status, 409); assert.equal((await call('study-sets/shared')).data.data.length, 0);
    set.version = withdrawn.data.data.version;
    const link = (await call(`study-sharing/${set.id}`, 'PUT', { version: set.version, visibility: 'unlisted', rightsAcknowledged: true })).data.data;
    assert.equal((await call(`study-sets/${set.id}`, 'PATCH', { ...authored, version: link.version })).status, 200); assert.equal((await call(`study-sharing/${set.id}/open`, 'POST', { token: link.token }, b)).status, 404);
  });
  await t.test('strict-source sets, evidence pins and original files remain private and immutable', async () => {
    const strict = await StudySet.create({ owner: a._id, origin: 'ai', title: 'Strict private', subjectId: subject._id, sourceResourceIds: [resource._id], ai: { generationMode: 'strict_source', sourceId: 'b'.repeat(64), sourceResourceId: resource._id }, questions: [] });
    const before = JSON.stringify(await StudySet.findById(strict._id).lean()); const sourceBefore = (await models.AcademicResource.findById(resource._id).select('+content')).content;
    assert.equal((await call(`study-sharing/${strict._id}`, 'PUT', { version: 1, visibility: 'unlisted', rightsAcknowledged: true })).status, 403);
    assert.equal((await call(`study-sets/${strict._id}/publication`, 'POST', { version: 1 })).status, 403);
    assert.equal((await call(`study-sharing/${strict._id}/open`, 'POST', { token: 'b'.repeat(64) }, b)).status, 404);
    assert.equal((await call(`academic/resources/${resource._id}/file`, 'GET', undefined, b)).status, 404);
    assert.equal(JSON.stringify(await StudySet.findById(strict._id).lean()), before); assert.deepEqual((await models.AcademicResource.findById(resource._id).select('+content')).content, sourceBefore);
    assert.equal(JSON.stringify(await User.find().select('_id credits').sort({ _id: 1 }).lean()), walletSnapshot); assert.equal(JSON.stringify(await Ledger.find().lean()), ledgerSnapshot);
  });
  await t.test('new circle creation and authenticated token probes are rate limited without credit effects', async () => {
    const created = [];
    for (let i = 0; i < 11; i++) created.push(await call('study-circles', 'POST', { ...draft(), subjectId: null }, d));
    assert.equal(created.filter(r => r.status === 201).length, 10); assert.equal(created.at(-1).status, 429);
    const probes = []; for (let i = 0; i < 65; i++) probes.push((await call(`study-sharing/${set.id}/open`, 'POST', { token: 'f'.repeat(64) }, d)).status);
    assert.ok(probes.includes(429)); assert.ok(probes.includes(404));
    assert.equal(JSON.stringify(await User.find().select('_id credits').sort({ _id: 1 }).lean()), walletSnapshot); assert.equal(JSON.stringify(await Ledger.find().lean()), ledgerSnapshot);
  });
});
