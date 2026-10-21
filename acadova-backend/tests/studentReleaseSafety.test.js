const test=require('node:test'),assert=require('node:assert/strict');
const contracts=require('../config/studentIndexes');
const {verifyStudentIndexes}=require('../services/studentReleaseReadiness');
const safety=require('../config/studentReleaseSafety'),policy=require('../config/studentExperience');
function dbFixture(change=()=>{}){
  const rows=contracts.map(c=>({name:c.name,type:'collection',options:{}}));
  const all=new Map(contracts.map(c=>[c.name,[{name:'_id_',key:{_id:1}},...c.indexes.map(i=>({key:i.key,...i.options}))]]));
  change({rows,all});
  return {listCollections:()=>({toArray:async()=>rows,close:async()=>{}}),collection:name=>({listIndexes:()=>({toArray:async()=>all.get(name)})})};
}
test('release is integrated EXP/free with MFA off and historical case mutations deferred',()=>{
  assert.equal(policy.active(),true);assert.equal(policy.capabilities().freeLearning,true);assert.equal(policy.capabilities().expActive,true);
  assert.equal(require('../config/staffMfa').enabled(),false);assert.equal(safety.legacyCaseWritesAllowed(),false);
  assert.throws(()=>policy.rejectCreditWrite(),{code:'CREDIT_ECONOMY_RETIRED'});
});
test('exact P4 four namespaces/eight index contracts pass with effective default simple collation',async()=>{
  assert.deepEqual(contracts.map(c=>c.name),['expaccountlocks','expawards','expledgerentries','legacycreditreviews']);
  assert.equal(contracts.reduce((n,c)=>n+c.indexes.length,0),8);
  assert.deepEqual(await verifyStudentIndexes(dbFixture()),{ready:true,collections:4,secondaryIndexes:8});
});
test('missing namespace or wrong unique/partial/collation/TTL cannot admit active startup',async()=>{
  for(const change of [({rows})=>rows.pop(),({all})=>{all.get('expawards')[1].unique=false;},
    ({all})=>{all.get('expledgerentries')[2].partialFilterExpression=undefined;},
    ({rows})=>{rows[0].options={collation:{locale:'en'}};},
    ({all})=>{all.get('expawards')[1].expireAfterSeconds=0;},
    ({all})=>{all.get('legacycreditreviews').push({name:'unexpected',key:{other:1}});}]){
      // Clone declarations so a deliberately malformed fixture cannot mutate
      // the contract objects used by the next check.
      const db=dbFixture(({rows,all})=>{for(const [k,v]of all)all.set(k,JSON.parse(JSON.stringify(v)));change({rows,all});});
      await assert.rejects(verifyStudentIndexes(db),{code:'STUDENT_INDEX_READINESS_REQUIRED'});
    }
});
test('legacy proposal and consent fail before any transaction or case write',async()=>{
  const mongoose=require('mongoose'),old=mongoose.startSession;let attempts=0;mongoose.startSession=async()=>{attempts++;throw Error();};
  try{const c=require('../controllers/growthReviewController');for(const handler of [c.proposeLegacy,c.consentLegacy]){
    const res={code:200,status(n){this.code=n;return this;},set(){return this;},json(v){this.value=v;return this;}};
    await handler({user:{id:'507f1f77bcf86cd799439011',role:'admin'},params:{id:'507f1f77bcf86cd799439012'},body:{}},res);
    assert.equal(res.code,423);assert.equal(attempts,0);
  }}finally{mongoose.startSession=old;}
});

test('active credit guard preserves atomic login cooldowns without admitting other pipelines',()=>{
  const {safeLoginPipeline}=require('../utils/creditMutation');
  assert.equal(safeLoginPipeline([{$set:{failedLoginAttempts:{$add:[1,1]},lastFailedLoginAt:new Date(),loginCooldownUntil:null}},{$set:{updatedAt:new Date()}}]),true);
  for(const bad of [[],[{$set:{credits:0}}],[{$set:{'credits.value':0}}],[{$replaceRoot:{newRoot:{}}}],[{$project:{credits:0}}],[{$unset:'credits'}],[{$set:{openingGrantEligible:false}}],[{$set:{failedLoginAttempts:0},$unset:'credits'}]])assert.equal(safeLoginPipeline(bad),false);
});
