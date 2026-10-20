import test from 'node:test';
import assert from 'node:assert/strict';
import { circleSchedule, localFields, requireFutureStart, wallTimeToInstant } from '../src/utils/scheduling.js';
const now = Date.parse('2026-10-18T12:00:00Z');
const draft = patch => ({date:'2026-10-19',time:'16:20',timezone:'Asia/Manila',durationMinutes:90,...patch});
test('Manila October 19 wall clock, review and UTC agree; stale independent end fields have no effect',()=>{
 const schedule=circleSchedule(draft({endsAt:'2026-10-28T00:00:00Z',startsAt:'2026-10-12T00:00:00Z'}),{now});
 assert.equal(schedule.startsAt,'2026-10-19T08:20:00.000Z');assert.equal(schedule.endsAt,'2026-10-19T09:50:00.000Z');assert.deepEqual(localFields(schedule.startsAt,'Asia/Manila'),{date:'2026-10-19',time:'16:20'});assert.deepEqual(localFields(schedule.endsAt,'Asia/Manila'),{date:'2026-10-19',time:'17:50'});
});
test('supported durations derive their exact end; invalid and expired values are rejected again at confirmation',()=>{
 for(const durationMinutes of [30,60,90,120,180]){const value=circleSchedule(draft({durationMinutes}),{now});assert.equal(Date.parse(value.endsAt)-Date.parse(value.startsAt),durationMinutes*60000);}
 for(const durationMinutes of [0,29,181,300,NaN,30.5])assert.throws(()=>circleSchedule(draft({durationMinutes}),{now}),/between 30 minutes and 3 hours/);
 assert.throws(()=>circleSchedule(draft(),{now:Date.parse('2026-10-19T08:20:01Z')}),/already passed/);
 assert.throws(()=>circleSchedule(draft({date:'2026-10-17'}),{now}),/already passed/);
 assert.throws(()=>circleSchedule(draft({date:'2026-10-18',time:'19:59'}),{now}),/already passed/);
 assert.throws(()=>circleSchedule(draft({date:'2027-05-01'}),{now}),/180 days/);
});
test('cross-midnight, leap/calendar validation and non-Manila zones retain the correct local dates',()=>{
 const s=circleSchedule(draft({time:'23:30',durationMinutes:120}),{now});assert.deepEqual(localFields(s.endsAt,'Asia/Manila'),{date:'2026-10-20',time:'01:30'});
 assert.equal(wallTimeToInstant('2026-10-19T16:20','America/New_York'),'2026-10-19T20:20:00.000Z');
 assert.equal(wallTimeToInstant('2026-10-19T16:20','Asia/Kathmandu'),'2026-10-19T10:35:00.000Z');
 assert.throws(()=>wallTimeToInstant('2026-02-30T16:20','Asia/Manila'),/valid calendar/);
 assert.throws(()=>wallTimeToInstant('2026-10-19T25:00','Asia/Manila'),/valid calendar/);
 assert.throws(()=>wallTimeToInstant('2026-10-19T16:20','bad-zone'),/IANA/);
});
test('nonexistent and ambiguous DST clock times are refused rather than shifted or guessed',()=>{
 assert.throws(()=>wallTimeToInstant('2026-03-08T02:30','America/New_York'),/does not exist/);
 assert.throws(()=>wallTimeToInstant('2026-11-01T01:30','America/New_York'),/occurs twice/);
 assert.throws(()=>wallTimeToInstant('2026-10-04T02:15','Australia/Lord_Howe'),/does not exist/);
 const s=circleSchedule(draft({date:'2026-11-01',time:'00:30',timezone:'America/New_York',durationMinutes:180}),{now});assert.equal(s.startsAt,'2026-11-01T04:30:00.000Z');assert.equal(s.endsAt,'2026-11-01T07:30:00.000Z');assert.equal(localFields(s.endsAt,'America/New_York').time,'02:30');
});
test('unchanged legacy schedules retain exact instants; a changed schedule must meet new bounds',()=>{
 const existing={startsAt:'2026-10-19T08:20:17.000Z',endsAt:'2026-10-19T13:20:17.000Z',timezone:'Asia/Manila'};
 const s=circleSchedule(draft({durationMinutes:300}),{existing,now});assert.equal(s.startsAt,existing.startsAt);assert.equal(s.endsAt,existing.endsAt);
 assert.throws(()=>circleSchedule(draft({durationMinutes:300,time:'16:25'}),{existing,now}),/between 30/);
 assert.equal(circleSchedule(draft({durationMinutes:90,time:'16:25'}),{existing,now}).endsAt,'2026-10-19T09:55:00.000Z');
 assert.throws(()=>requireFutureStart('2026-10-18T12:00:00Z',now),/already passed/);
});
