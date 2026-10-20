import test from 'node:test';
import assert from 'node:assert/strict';
import {getSessionTimeline,getSessionNextStep} from '../src/utils/sessionPresentation.js';
import {localAcadiReply} from '../src/utils/acadiLocal.js';
test('free completion uses validation evidence without requiring a fabricated credit settlement',()=>{
  const session={economyVersion:'free-v1',status:'completed',validationSettledAt:'2026-10-19T01:00:00Z',learnerConfirmedAt:'2026-10-19T01:00:00Z',tutorConfirmedAt:'2026-10-19T01:00:00Z'};
  assert.equal(getSessionTimeline(session).at(-1).state,'done');
  assert.equal(getSessionTimeline({...session,validationSettledAt:null}).at(-1).state,'waiting');
  assert.ok(!getSessionNextStep({...session,status:'resolved',resolution:'confirm_session'}).includes('credits'));
});
test('local fallback distinguishes free tutoring from the preserved legacy economy and never pretends to be Gemini',()=>{
  assert.match(localAcadiReply('Find a tutor',null,Date.now(),{freeLearning:true}).message,/new peer tutoring are free/);
  assert.match(localAcadiReply('Find a tutor',null).message,/existing Credit rules/);
  assert.match(localAcadiReply('Explain a switch',null).message,/Local guidance does not call Gemini/);
});
