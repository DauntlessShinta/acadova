import test from 'node:test';
import assert from 'node:assert/strict';
import { meetingBookmark, meetingProviders } from '../src/utils/meetingProviders.js';
test('provider shortcuts are fixed official destinations, never a meeting creation API',()=>{
 assert.deepEqual(meetingProviders.map(p=>p.createUrl),['https://meet.google.com/','https://zoom.us/signin','https://teams.microsoft.com/']);
 assert.equal(meetingBookmark('https://meet.google.com/abc-defg-hij').id,'meet');
 assert.equal(meetingBookmark('https://us02web.zoom.us/j/123456?pwd=synthetic').id,'zoom');
 assert.equal(meetingBookmark('https://teams.microsoft.com/meet/123?p=synthetic').id,'teams');
});
test('malicious, unsupported and redirect-bearing bookmarks do not become private meeting actions',()=>{
 for(const link of ['javascript:alert(1)','http://meet.google.com/abc-defg-hij','https://meet.google.com.evil.test/abc-defg-hij','https://meet.google.com@evil.test/abc-defg-hij','https://meet.google.com:8443/abc-defg-hij','https://meet.google.com/abc-defg-hij?next=https://evil.test','https://zoom.us/j/123?pwd=a&pwd=b','https://teams.microsoft.com/meet/123#fragment','https://zoom.us/signin','https://meet.google.com/','https://127.0.0.1/meet/123'])assert.equal(meetingBookmark(link),null,link);
});
