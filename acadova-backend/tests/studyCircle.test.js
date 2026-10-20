const test = require('node:test'); const assert = require('node:assert/strict');
const { circleInput, meetingUrl, timezone } = require('../utils/studyCircleValidation');
const { studyContent, contentOf, gradeStudy } = require('../utils/studyQuiz');
const valid = () => ({ title: 'Synthetic circle', startsAt: new Date(Date.now() + 86400000).toISOString(), endsAt: new Date(Date.now() + 90000000).toISOString(), timezone: 'Asia/Manila', meetingUrl: 'https://meet.google.com/abc-defg-hij', capacity: 1, tags: ['Math'] });
test('server duration, horizon and expired-clock constraints are specific and cannot be waived by clients', () => {
  const body=valid(), start=Date.parse(body.startsAt);
  for(const minutes of [30,60,90,120,180])assert.equal(circleInput({...body,endsAt:new Date(start+minutes*60000).toISOString()}).startsAt,body.startsAt);
  for(const minutes of [29,181,300])assert.throws(()=>circleInput({...body,endsAt:new Date(start+minutes*60000).toISOString()}),/between 30 minutes and 3 hours/);
  assert.throws(()=>circleInput({...body,endsAt:body.startsAt}),/after the start time/);
  assert.throws(()=>circleInput({...body,startsAt:new Date(Date.now()-60000).toISOString()}),/already passed/);
  assert.throws(()=>circleInput({...body,startsAt:new Date(Date.now()+181*86400000).toISOString()}),/180 days/);
  assert.throws(()=>circleInput({...body,legacy:true}),/Invalid academic fields/);
});
test('only an exact server-read legacy schedule bypasses new duration bounds for metadata edits',()=>{
  const body=valid(), old={...body,endsAt:new Date(Date.parse(body.startsAt)+300*60000).toISOString()};
  assert.equal(circleInput({...old,title:'Updated metadata'},old).endsAt,old.endsAt);
  assert.throws(()=>circleInput({...old,startsAt:new Date(Date.parse(old.startsAt)+60000).toISOString()},old),/between 30/);
  assert.throws(()=>circleInput({...old,timezone:'UTC'},old),/between 30/);
});
test('circle input has bounded UTC times, IANA zone and explicit free capacity', () => { assert.equal(circleInput(valid()).capacity, 1); assert.equal(timezone('America/New_York'), 'America/New_York');
  for (const patch of [{ credits: 50 }, { host: 'someone' }, { title: '' }, { title: 'x'.repeat(121) }, { capacity: 0 }, { capacity: 51 }, { capacity: '1' }, { tags: Array(6).fill('Math') }, { tags: [123] }, { timezone: 'invalid' }, { startsAt: '2026-02-30T09:00:00Z' }, { startsAt: '2027-01-01T09:00' }, { startsAt: new Date(Date.now() - 1000).toISOString() }, { endsAt: new Date(Date.now() + 86400000 * 4).toISOString() }]) assert.throws(() => circleInput({ ...valid(), ...patch }), JSON.stringify(patch));
});
test('meeting bookmarks reject redirects, credentials, IPs, lookalike hosts and unsafe protocols', () => {
  for (const link of ['http://meet.google.com/abc-defg-hij', 'https://meet.google.com.evil.test/abc-defg-hij', 'https://meet.google.com@evil.test/abc-defg-hij', 'https://meet.google.com:8443/abc-defg-hij', 'https://127.0.0.1/j/123', 'javascript:alert(1)', 'https://meet.google.com/abc-defg-hij?next=https://evil.test', 'https://meet.google.com/abc-defg-hij#x', 'https://evil.test/redirect']) assert.throws(() => meetingUrl(link), link);
  assert.equal(meetingUrl('https://zoom.us/j/123456?pwd=synthetic'), 'https://zoom.us/j/123456?pwd=synthetic');
  assert.throws(() => meetingUrl('https://zoom.us/j/123456?next=https://evil.test'));
  assert.throws(() => meetingUrl('https://zoom.us/j/123456?pwd=one&pwd=two'));
  assert.throws(() => timezone('+08:00'));
});
test('authored flashcards use existing content validation without accepting AI evidence or private IDs', () => {
  const body = { title: 'Author cards', subject: 'Math', questions: [], flashcards: [{ front: 'Term', back: 'Meaning' }] };
  assert.deepEqual(studyContent(body, true).flashcards, body.flashcards); assert.deepEqual(contentOf({ ...body, origin: 'manual' }), { ...body, description: undefined });
  assert.throws(() => studyContent({ ...body, flashcards: [{ ...body.flashcards[0], sourceId: 'a'.repeat(64) }] }, true));
  assert.throws(() => studyContent({ ...body, flashcards: [{ front: '', back: 'Missing prompt' }] }, true)); assert.throws(() => studyContent({ ...body, flashcards: Array(11).fill(body.flashcards[0]) }));
  assert.throws(() => gradeStudy(body, []));
});
