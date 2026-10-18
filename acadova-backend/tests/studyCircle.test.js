const test = require('node:test'); const assert = require('node:assert/strict');
const { circleInput, meetingUrl, timezone } = require('../utils/studyCircleValidation');
const { studyContent, contentOf, gradeStudy } = require('../utils/studyQuiz');
const valid = () => ({ title: 'Synthetic circle', startsAt: new Date(Date.now() + 86400000).toISOString(), endsAt: new Date(Date.now() + 90000000).toISOString(), timezone: 'Asia/Manila', meetingUrl: 'https://meet.google.com/abc-defg-hij', capacity: 1, tags: ['Math'] });
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
