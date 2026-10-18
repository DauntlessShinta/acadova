const test = require('node:test');
const assert = require('node:assert/strict');
const { aiStudyConfig, requireConfigured } = require('../config/aiStudy');
const { createGeminiStudyService } = require('../services/geminiStudyService');
const { createAiStudyController } = require('../controllers/aiStudyController');
const mongoose = require('mongoose');
const Quota = require('../models/AiStudyQuota');
const real = () => aiStudyConfig({ NODE_ENV:'production', AI_STUDY_ENABLED:'true', AI_STUDY_LOCAL_QA:'false', GEMINI_API_KEY:'test-only-not-a-real-key', GEMINI_MODEL:'gemini-3.5-flash-lite' });
test('optional live smoke exits before loading credentials unless all owner-approval flags are supplied',()=>{
  const {spawnSync}=require('node:child_process');
  const result=spawnSync(process.execPath,['--max-old-space-size=64',require.resolve('../scripts/aiStudySmokeLocal.cjs')],{encoding:'utf8',timeout:5000});
  assert.equal(result.status,1);assert.match(result.stderr,/requires explicit owner approval/);assert.ok(!result.stdout);
});
const result = () => ({ statusCode:200, status(n){this.statusCode=n;return this;}, json(value){this.body=value;return this;} });
test('real deployment is explicit, synthetic QA remains local-only and ordinary automated tests cannot enable live calls',()=>{
  assert.equal(aiStudyConfig({}).enabled,false);
  assert.equal(real().enabled,true);assert.equal(real().syntheticOnly,false);
  assert.equal(aiStudyConfig({NODE_ENV:'production',AI_STUDY_ENABLED:'true',AI_STUDY_LOCAL_QA:'true'}).enabled,false);
  assert.equal(aiStudyConfig({NODE_ENV:'test',AI_STUDY_ENABLED:'true'}).enabled,false);
  assert.equal(aiStudyConfig({NODE_ENV:'test',AI_STUDY_ENABLED:'true',AI_STUDY_LOCAL_QA:'true'}).syntheticOnly,true);
  assert.throws(()=>requireConfigured({...real(),model:'https://untrusted.test/key'}),{code:'AI_STUDY_MODEL_INVALID'});
  assert.throws(()=>requireConfigured({...real(),apiKey:''}),{code:'AI_STUDY_UNCONFIGURED'});
});
test('server-owned mode scopes remote-host restriction; status never returns a key; client flags cannot configure the provider',async()=>{
  const oldHost=mongoose.connection.host;const original=Quota.findById;
  mongoose.connection.host='disconnected-host.invalid';Quota.findById=()=>({lean:async()=>null});
  try {
    const realController=createAiStudyController({configFor:real,provider:{generate(){assert.fail('No provider call permitted');}}});
    let next=false;realController.configured({},result(),()=>{next=true;});assert.equal(next,true);
    const response=result();await realController.status({user:{id:'synthetic'}},response);
    assert.equal(response.body.data.enabled,true);assert.equal(response.body.data.syntheticOnly,false);assert.ok(!JSON.stringify(response.body).includes(real().apiKey));
    const qa=createAiStudyController({configFor:()=>({...real(),syntheticOnly:true})});const denied=result();qa.configured({},denied,()=>assert.fail());assert.equal(denied.statusCode,503);assert.equal(denied.body.code,'AI_STUDY_LOCAL_ONLY');
    for(const body of [{type:'both',syntheticConsent:'true'},{type:'both',providerConsent:'false'},{type:'both',providerConsent:'true',enabled:true}]){
      const rejected=result();await realController.generate({body},rejected);assert.equal(rejected.statusCode,400);
    }
  } finally {mongoose.connection.host=oldHost;Quota.findById=original;}
});
test('all real provider operations retain configured model, schema, token preflight and per-process concurrency bound without fallback',async()=>{
  const {output,pptx}=require('./fixtures/aiStudyDocuments.cjs');
  const requests=[];let release;const gate=new Promise(resolve=>{release=resolve;});
  const adapter=createGeminiStudyService({clientFactory:()=>({models:{countTokens:async args=>{requests.push(args);return{totalTokens:100};},generateContent:async args=>{requests.push(args);await gate;return{text:JSON.stringify(output()),candidates:[{finishReason:'STOP'}]};}}})});
  const options={config:real(),type:'both',document:{format:'pptx',units:2,slides:[{number:1,text:'Synthetic binary search requires sorted input.'},{number:2,text:'Synthetic algorithm text only.'}],buffer:pptx()}};
  const first=adapter.generate(options),second=adapter.generate(options);
  await assert.rejects(adapter.generate(options),{code:'AI_STUDY_BUSY'});release();await first;await second;
  assert.ok(requests.every(r=>r.model===real().model));assert.ok(requests.filter(r=>r.config?.responseJsonSchema).length===2);
  assert.ok(requests.every(r=>!r.config?.tools));
});
