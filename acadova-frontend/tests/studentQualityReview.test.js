import test from 'node:test';
import assert from 'node:assert/strict';
import {friendlyApiError,connectionErrorMessage} from '../src/utils/friendlyApiError.js';
import {getSessionEconomyLabel} from '../src/utils/sessionPresentation.js';

test('useful validation survives while missing/non-JSON and infrastructure errors are understandable',()=>{
 assert.equal(friendlyApiError('Choose a future session time.',400),'Choose a future session time.');
 for(const message of [null,'','API route not found','MongoDB E11000 duplicate key','Transaction aborted for 0123456789abcdef01234567'])assert.doesNotMatch(friendlyApiError(message,503),/API|Mongo|E11000|Transaction|012345/);
 assert.match(friendlyApiError(undefined,404),/item is unavailable/);
 assert.match(friendlyApiError('Gemini is not configured on the backend.',503,'AI_STUDY_UNCONFIGURED'),/saved Study Sets/);
 assert.match(connectionErrorMessage,/Check your connection/);
});
test('active Student economy labels never display a historical charge or claim a legacy session is free',()=>{
 for(const settlementState of ['settled','resolved_no_transfer','not_applicable',undefined]){
  const row={creditAmount:50,settlementState};
  assert.equal(getSessionEconomyLabel(row,true),'Historical session (read only)');
  assert.equal(getSessionEconomyLabel(row,false),'50 credits');
 }
 assert.equal(getSessionEconomyLabel({economyVersion:'free-v1',creditAmount:0},true),'Free peer tutoring');
});
