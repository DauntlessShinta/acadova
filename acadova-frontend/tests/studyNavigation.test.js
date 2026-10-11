import test from 'node:test';import assert from 'node:assert/strict';import { safeStudyReturnPath, safeStudentReturnPath } from '../src/utils/studyNavigation.js';
test('study Login returns allow only named own/shared/result destinations and preserve Session allowlist',()=>{
 const id='507f1f77bcf86cd799439011';assert.equal(safeStudyReturnPath('/study-sets/'+id),'/study-sets/'+id);assert.equal(safeStudyReturnPath('/study-sets/'+id+'?attempt='+id),'/study-sets/'+id+'?attempt='+id);
 for(const value of ['//evil.test/study-sets','https://evil.test/study-sets','/study-sets?returnTo=https://evil.test','/study-sets/'+id+'?edit=1&review=1','/study-sets?view=private&view=shared','/study-sets/guess','/study-sets/'+id+'#secret','/credits'])assert.equal(safeStudyReturnPath(value),null,value);
 assert.equal(safeStudentReturnPath('/sessions/'+id+'#session-completion'),'/sessions/'+id+'#session-completion');assert.equal(safeStudentReturnPath('/admin/users'),null);
});
