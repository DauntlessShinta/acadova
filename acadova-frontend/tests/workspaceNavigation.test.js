import test from 'node:test';
import assert from 'node:assert/strict';
import { getStaffWorkspaceGroups, getRoleNavigation, staffWorkspaceGroup, canAccessStaffArea } from '../src/config/roleNavigation.js';
test('staff groups retain existing destinations with two Moderator and six Admin primary sections',()=>{
 assert.deepEqual(getStaffWorkspaceGroups('moderator').map(group=>group.label),['Queue','Learning Content']);
 assert.deepEqual(getStaffWorkspaceGroups('admin').map(group=>group.label),['Overview','Users & Roles','Catalog','Escalations','Policies & Settings','Audit Log']);
 for(const role of ['admin','moderator']){
  const destinations=new Set(getStaffWorkspaceGroups(role).flatMap(group=>group.items.map(([to])=>to.split(/[?#]/)[0])));
  for(const {to} of getRoleNavigation(role))assert.ok(destinations.has(to)||to==='/moderator/settings','Preserved staff destination '+to);
 }
 assert.equal(canAccessStaffArea('student','moderator'),false);assert.equal(canAccessStaffArea('moderator','admin'),false);
});
test('canonical audit, security and resource queues select the correct workspace',()=>{
 assert.equal(staffWorkspaceGroup('admin','/admin/trust-activity','?tab=activity').label,'Audit Log');
 assert.equal(staffWorkspaceGroup('admin','/admin/trust-activity','?tab=security').label,'Policies & Settings');
 assert.equal(staffWorkspaceGroup('moderator','/moderator/learning','','#manage-panel-resources').label,'Queue');
 assert.equal(staffWorkspaceGroup('moderator','/moderator/assessments').label,'Learning Content');
});
