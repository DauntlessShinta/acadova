const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { validators, profileUpdates, publicProfileDetails, YEAR_LEVELS, LANGUAGES } = require('../utils/profileDetails');
const { schemas, validateBody } = require('../middleware/validation');

test('optional details are bounded, allow clearing and default to private', () => {
  assert.deepEqual(publicProfileDetails({ university: 'Private university', languages: ['English'] }), {});
  assert.deepEqual(profileUpdates({ bio: '  About me  ', university: '', yearLevel: '', languages: [], profileVisibility: {} }),
    { bio: 'About me', university: '', yearLevel: '', languages: [], profileVisibility: { bio: false, university: false, yearLevel: false, languages: false } });
  assert.deepEqual(publicProfileDetails({ university: 'Visible university', bio: 'Private bio', profileVisibility: { university: true } }), { university: 'Visible university' });
  for (const [key, values] of Object.entries({ bio: [null, {}, 'x'.repeat(1001), '\u0000'], university: [23, 'x'.repeat(121)], yearLevel: ['Doctor', 1], languages: [['English', 'English'], ['Unsupported'], LANGUAGES.slice(0, 11)], profileVisibility: [{ bio: 'true' }, { email: true }, []] })) {
    for (const value of values) assert.throws(() => validators[key](value));
  }
});

test('profile endpoint validation rejects privileged fields and nested visibility injection', () => {
  for (const body of [{ university: 'School', role: 'admin' }, { bio: 'Hello', credits: 500 },
    { profileVisibility: { password: true } }, { university: { $ne: '' } }]) {
    let status;
    validateBody(schemas.profile, { requireOne: true })({ body }, { status(code) { status = code; return this; }, json() {} }, () => assert.fail('Invalid patch accepted'));
    assert.equal(status, 400);
  }
});

test('client and server choices agree without adding registration requirements', async () => {
  const client = await import(pathToFileURL(path.resolve(__dirname, '../../acadova-frontend/src/utils/profileDetails.js')));
  assert.deepEqual(client.YEAR_LEVELS, YEAR_LEVELS); assert.deepEqual(client.LANGUAGES, LANGUAGES);
  assert.ok(!Object.keys(schemas.register).some(key => ['university', 'yearLevel', 'languages', 'bio'].includes(key)));
  assert.deepEqual(client.profileDetailsDraft({}).profileVisibility, { bio: false, university: false, yearLevel: false, languages: false });
});

test('public profile uses an explicit DTO even when a query returns private fields', async t => {
  const User = require('../models/User'); const Rating = require('../models/Rating');
  const oldFind = User.findOne; const oldAggregate = Rating.aggregate;
  t.after(() => { User.findOne = oldFind; Rating.aggregate = oldAggregate; });
  const id = '507f1f77bcf86cd799439011';
  User.findOne = () => ({ select: async () => ({ _id: id, name: 'Peer', role: 'student', skillsToTeach: ['Java'],
    university: 'Private university', bio: 'Shared bio', profileVisibility: { bio: true }, email: 'private@example.test',
    password: 'PRIVATE', credits: 100, authVersion: 'PRIVATE', emailVerified: true, suspensionReason: 'PRIVATE' }) });
  Rating.aggregate = async () => [{ average: 4, count: 2 }];
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  await require('../controllers/userController').getUserById({ params: { id } }, res);
  assert.deepEqual(res.body.data, { _id: id, name: 'Peer', role: 'student', skillsToTeach: ['Java'], skillsToLearn: [], weeklyAvailability: null, bio: 'Shared bio', rating: 4, ratingCount: 2 });
});
