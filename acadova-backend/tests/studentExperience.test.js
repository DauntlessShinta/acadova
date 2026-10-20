const test=require('node:test'),assert=require('node:assert/strict');
const {levelFor,badgesFor}=require('../services/growthPresentation');
const {classifyLegacySession,isSessionRatingEligible}=require('../utils/sessionLifecycleCompatibility');
const {createGeminiAcadiService,SYSTEM}=require('../services/geminiAcadiService');
const {acadiConfig}=require('../config/acadi');
test('exact progression thresholds, bounded progress and invalid evidence',()=>{
  [0,100,250,500,900,1500].forEach((amount,i)=>assert.equal(levelFor(amount).level,i+1));
  assert.equal(levelFor(99).needed,1);assert.equal(levelFor(2000).next,null);
  for(const invalid of [-1,NaN,2.5,'20'])assert.throws(()=>levelFor(invalid));
});
test('progression policy is versioned without changing historical floors; visibility fails private',()=>{
  const policy=require('../config/growthProgression');
  assert.equal(policy.version,'academic-progression-1');
  assert.deepEqual(policy.levels.map(row=>row[0]),[0,100,250,500,900,1500]);
  assert.ok(Object.isFrozen(policy.levels)&&policy.levels.every(Object.isFrozen));
  const {visibility}=require('../services/growthPresentation');
  assert.deepEqual(visibility(),{showLevel:false,showRank:false,badgeIds:[]});
  assert.deepEqual(visibility({showLevel:'true',showRank:1}),{showLevel:false,showRank:false,badgeIds:[]});
});
test('stable derived achievements unlock from real counts and revoke when evidence falls below requirement',()=>{
  const facts={assessments:3,everAssessments:3,tutoring:10,everTutoring:10,learners:5,everLearners:5};
  assert.equal(badgesFor(facts).filter(b=>b.earned).length,5);
  assert.deepEqual(badgesFor(facts),badgesFor(facts));
  const revoked=badgesFor({...facts,tutoring:0,learners:0});
  assert.ok(revoked.filter(b=>['first-mentor','helping-hand','consistent-mentor'].includes(b.id)).every(b=>b.revoked&&!b.earned));
});
test('free rating and terminal classification require actual canonical evidence, not zero price alone',()=>{
  const at=new Date(),row={economyVersion:'free-v1',creditAmount:0,status:'completed',lifecycleVersion:1,completedAt:at,validationSettledAt:at,startedAt:at,awaitingValidationAt:at,learnerCheckedInAt:at,tutorCheckedInAt:at,learnerConfirmedAt:at,tutorConfirmedAt:at};
  assert.equal(isSessionRatingEligible(row),true);
  assert.equal(isSessionRatingEligible({...row,learnerConfirmedAt:null}),false);
  assert.equal(isSessionRatingEligible(row,[{}]),false);
  const resolved={...row,status:'resolved',resolution:'confirm_session',resolvedAt:at,resolvedBy:'staff',resolutionNote:'Reviewed evidence'};
  assert.equal(isSessionRatingEligible(resolved),false);
  assert.equal(isSessionRatingEligible({...resolved,disputedAt:at,disputeReason:'Participant disputed'}),true);
  assert.equal(classifyLegacySession({status:'completed',legacyObligationResolvedAt:at,legacyObligationReview:'review'}).settlementState,'resolved_no_transfer');
});
test('environment variables cannot activate the economy or personal-context release',async()=>{
  const p=require('../config/studentExperience');assert.equal(p.active(),false);
  await assert.rejects(p.activateIsolatedStudentExperience());
  assert.equal(acadiConfig({ACADI_GEMINI_ENABLED:'true',ACADI_AUDIENCE_APPROVED:'true',ACADI_CONTEXT_ENABLED:'true'}).contextEnabled,false);
  assert.equal(acadiConfig({}).enabled,false);
});
const config={...acadiConfig({}),enabled:true,apiKey:'synthetic-not-a-secret',model:'gemini-synthetic-test',timeoutMs:40,maxInputTokens:100,maxOutputTokens:32};
const base={config,message:'Explain switches',facts:[],history:[{role:'user',text:'Networks?'},{role:'assistant',text:'A general explanation'}]};
test('SDK contract uses bounded chat contents/system instructions without tools or account metadata',async()=>{
  let input,count;
  const service=createGeminiAcadiService({clientFactory:()=>({models:{countTokens:async args=>{count=args;return {totalTokens:20};},generateContent:async args=>{input=args;return {candidates:[{finishReason:'STOP'}],text:'A synthetic academic reply.'};}}})});
  assert.equal(await service.generate(base),'A synthetic academic reply.');
  assert.equal(input.contents[1].role,'model');assert.equal(input.config.maxOutputTokens,32);
  assert.equal(input.config.systemInstruction,SYSTEM);assert.equal(input.config.tools,undefined);
  assert.ok(count.contents[0].parts[0].text.includes('read-only'));assert.ok(!JSON.stringify(input).includes('synthetic-not-a-secret'));
});
test('over-budget tokens, safety stops and unexpected functions fail closed',async()=>{
  for(const [count,reply,code] of [[101,{},'ACADI_INPUT_LIMIT'],[10,{candidates:[{finishReason:'SAFETY'}],text:'blocked'},'ACADI_SAFETY'],[10,{candidates:[{finishReason:'STOP'}],text:'reply',functionCalls:[{name:'award'}]},'ACADI_SAFETY']]){
    const service=createGeminiAcadiService({clientFactory:()=>({models:{countTokens:async()=>({totalTokens:count}),generateContent:async()=>reply}})});
    await assert.rejects(service.generate(base),{code});
  }
});
test('SDK failures are redacted; quota, timeout and cancellation remain actionable',async()=>{
  for(const status of [429,500]){
    const service=createGeminiAcadiService({clientFactory:()=>({models:{countTokens:async()=>{throw Object.assign(new Error('synthetic-private-provider-details'),{status});}}})});
    await assert.rejects(service.generate(base),error=>error.code===(status===429?'ACADI_PROVIDER_QUOTA':'ACADI_PROVIDER_UNAVAILABLE')&&!error.message.includes('private-provider'));
  }
  const held=createGeminiAcadiService({clientFactory:()=>({models:{countTokens:()=>new Promise(()=>{})}})});
  await assert.rejects(held.generate(base),{code:'ACADI_TIMEOUT'});
  const abort=new AbortController(),pending=held.generate({...base,signal:abort.signal});abort.abort();
  await assert.rejects(pending,{code:'ACADI_CANCELLED'});
  await assert.rejects(held.generate({...base,signal:abort.signal}),{code:'ACADI_CANCELLED'});
});
