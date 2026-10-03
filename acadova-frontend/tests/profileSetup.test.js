import test from 'node:test';
import assert from 'node:assert/strict';
import { needsProfileSetup, splitDisplayName } from '../src/utils/profileSetup.js';

test('new Students need setup, returning Students with either skill list do not', () => {
  assert.equal(needsProfileSetup({ role: 'student', name: 'New Student', skillsToLearn: [], skillsToTeach: [] }), true);
  assert.equal(needsProfileSetup({ role: 'student', skillsToLearn: ['Python'], skillsToTeach: [] }), false);
  assert.equal(needsProfileSetup({ role: 'student', skillsToLearn: [], skillsToTeach: ['Java'] }), false);
  assert.equal(needsProfileSetup({ role: 'moderator', skillsToLearn: [], skillsToTeach: [] }), false);
  assert.deepEqual(splitDisplayName('Ada Lovelace'), { firstName: 'Ada', lastName: 'Lovelace' });
});
