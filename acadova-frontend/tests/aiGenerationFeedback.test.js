import test from 'node:test';
import assert from 'node:assert/strict';
import {isInlineAiError,isGenerationPage,failureRecovery} from '../src/utils/aiGenerationFeedback.js';
test('input errors stay inline while source/output and transport failures remain job failures',()=>{
  assert.equal(isInlineAiError({status:413}),true);assert.equal(isInlineAiError({status:400}),true);
  for(const error of [{status:422,code:'AI_STUDY_INSUFFICIENT_SOURCE'},{status:502,code:'AI_STUDY_BAD_OUTPUT'},{status:503},{message:'network'}])assert.equal(isInlineAiError(error),false);
  assert.equal(isInlineAiError({status:400,data:{code:'AI_STUDY_BAD_OUTPUT'}}),false,'API error envelope retains provider failure routing');
});
test('only exact generation context opens failure details automatically',()=>{
  const job={resumePath:'/learning/ai-study?subjectId=one&moduleId=two'};
  assert.equal(isGenerationPage(job,{pathname:'/subjects/one',search:''}),false);
  assert.equal(isGenerationPage(job,{pathname:'/learning/ai-study',search:'?subjectId=one&moduleId=two'}),true);
  assert.equal(isGenerationPage(job,{pathname:'/learning/ai-study',search:'?subjectId=other'}),false);
  assert.match(failureRecovery('AI_STUDY_INSUFFICIENT_SOURCE'),/fewer items/);
  assert.match(failureRecovery('AI_STUDY_TIMEOUT'),/daily limit/);
});
