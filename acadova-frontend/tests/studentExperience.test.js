import test from 'node:test';
import assert from 'node:assert/strict';
import { isUnifiedStudentPath } from '../src/utils/studentExperience.js';
import { circleActionState, myCircleRows } from '../src/utils/circlePresentation.js';
test('unified student scope includes nested learning and peer routes while excluding staff and lookalikes', () => {
  for(const path of ['/dashboard','/dashboard/peer','/subjects/id','/learning','/learning/ai-study/id','/assessments','/study-sets/new','/study-share/id','/study-together','/tutors/id','/sessions/id','/profile','/growth'])assert.equal(isUnifiedStudentPath(path),true,path);
  for(const path of ['/admin','/admin/study-sets','/moderator','/settings','/credits','/subjects-other','/sessionsx'])assert.equal(isUnifiedStudentPath(path),false,path);
});
test('circle display states respect actual membership, capacity, closure and host availability', () => {
  const now=Date.parse('2026-10-18T00:00:00Z'),row={status:'scheduled',startsAt:'2026-10-19T00:00:00Z',endsAt:'2026-10-19T01:00:00Z',capacity:6,enrolled:5};
  assert.equal(circleActionState(row,now).canJoin,true);
  assert.equal(circleActionState({...row,enrolled:6},now).full,true);
  for(const change of [{joined:true},{isHost:true},{hostUnavailable:true},{status:'cancelled'},{status:'completed'},{startsAt:'2026-10-17T00:00:00Z'}])assert.equal(circleActionState({...row,...change},now).canJoin,false);
  assert.equal(circleActionState({...row,joined:true,hostUnavailable:true},now).canLeave,true);
  assert.equal(circleActionState({...row,isHost:true},now).canEdit,true);
  assert.equal(circleActionState({...row,isHost:true,startsAt:'2026-10-17T00:00:00Z'},now).canEdit,false);
  assert.equal(circleActionState({...row,status:'completed'},now).label,'Closed by host');
});
test('My Circles categories are projections of returned records and never inferred attendance',()=>{
  const rows=[{id:'host',isHost:true,status:'scheduled',endsAt:'2026-10-20'}, {id:'joined',joined:true,status:'scheduled',endsAt:'2026-10-20'}, {id:'past',joined:true,status:'completed',endsAt:'2026-10-10'}];const now=Date.parse('2026-10-18');
  assert.deepEqual(myCircleRows(rows,'hosted',now).map(r=>r.id),['host']);
  assert.deepEqual(myCircleRows(rows,'joined',now).map(r=>r.id),['joined','past']);
  assert.deepEqual(myCircleRows(rows,'past',now).map(r=>r.id),['past']);assert.equal(rows.length,3);
});
