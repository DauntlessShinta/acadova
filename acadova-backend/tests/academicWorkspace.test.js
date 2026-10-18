const test = require('node:test');
const assert = require('node:assert/strict');
const { schemas, associations, parse, resourceUrl } = require('../utils/academicValidation');
const { AcademicTerm, PersonalModule, AcademicResource } = require('../models/academic');
test('academic year validation, custom terms and honest module states', async () => {
  const owner = 'a'.repeat(24);
  await new AcademicTerm({ owner, startYear: 2026, endYear: 2027, semester: 'Trimester / summer' }).validate();
  await assert.rejects(new AcademicTerm({ owner, startYear: 2026, endYear: 2028, semester: 'First' }).validate());
  for (const startYear of [2026.5, '2026', 1899, 2201]) assert.throws(() => parse({ startYear, semester: 'First' }, schemas.terms));
  assert.throws(() => parse({ startYear: 2026, semester: 'First', owner }, schemas.terms));
  assert.throws(() => parse({ title: 'Module', subjectId: owner, status: 'mastered' }, schemas.modules));
  assert.throws(() => parse({ order: -1 }, schemas.modules, true));
  const module = new PersonalModule({ owner, subjectId: owner, title: 'Module 12' }); assert.equal(module.status, 'not_started');
  const resource = new AcademicResource({ owner, subjectId: owner, title: 'Link', kind: 'external_link' }); assert.equal(resource.visibility, 'private');
});
test('Google bookmarks use exact HTTPS hosts and supported paths, never provider lookalikes', () => {
  for (const value of ['https://forms.gle/abcdef', 'https://docs.google.com/forms/d/e/abc/viewform', 'https://docs.google.com/forms/u/0/d/abc/edit']) assert.equal(resourceUrl('google_form_link', value), value);
  for (const value of ['https://drive.google.com/file/d/abc/view', 'https://drive.google.com/drive/folders/abc', 'https://docs.google.com/document/d/abc/edit', 'https://docs.google.com/presentation/d/abc/edit']) assert.equal(resourceUrl('google_drive_link', value), value);
  for (const value of ['http://forms.gle/abc', 'javascript:alert(1)', 'https://forms.gle.evil.test/abc', 'https://docs.google.com.evil.test/forms/d/abc', 'https://evil.test@forms.gle/abc', 'https://forms.gle:444/abc', 'https://docs.google.com/document/d/abc', 'https://docs.google.com/forms-evil/d/abc', 'https://forms.gle/']) assert.throws(() => resourceUrl('google_form_link', value));
  assert.throws(() => resourceUrl('google_drive_link', 'https://drive.google.com.evil.test/file/d/a'));
  assert.throws(() => resourceUrl('external_link', 'data:text/html,test'));
});
test('associations reject duplicate IDs, foreign fields, invalid IDs and excessive sources', () => {
  const id = 'a'.repeat(24);
  assert.deepEqual(parse({ subjectId: null, moduleId: null, sourceResourceIds: [] }, associations, true), { subjectId: null, moduleId: null, sourceResourceIds: [] });
  for (const body of [{ owner: id }, { subjectId: { $ne: null } }, { sourceResourceIds: [id, id] }, { sourceResourceIds: Array(21).fill(id) }]) assert.throws(() => parse(body, associations, true));
});
