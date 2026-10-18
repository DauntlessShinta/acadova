const { InvalidInput, isValidObjectId } = require('../middleware/validation');
const optional = fn => value => value === undefined ? undefined : fn(value);
const text = (max, empty = false) => value => {
  if (typeof value !== 'string' || (!empty && !value.trim()) || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new InvalidInput(`Enter ${empty ? 'up to' : '1–'}${max} characters of text.`);
  return value.trim();
};
const objectId = value => { if (!isValidObjectId(value)) throw new InvalidInput('Invalid academic record ID.'); return value; };
const nullableId = value => value === null ? null : objectId(value);
const integer = value => { if (!Number.isSafeInteger(value) || value < 0 || value > 10000) throw new InvalidInput('Order must be a whole number from 0 to 10000.'); return value; };
const bool = value => { if (typeof value !== 'boolean') throw new InvalidInput('Use true or false.'); return value; };
const oneOf = values => value => { if (!values.includes(value)) throw new InvalidInput('Choose a supported value.'); return value; };
function resourceUrl(kind, value) {
  const clean = text(1000)(value); let url;
  try { url = new URL(clean); } catch { throw new InvalidInput('Enter a valid HTTPS link.'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.port || /[\s\\]/.test(clean)) throw new InvalidInput('Use an HTTPS link without credentials or a custom port.');
  if (kind === 'google_form_link' && !(url.hostname === 'forms.gle' && url.pathname.length > 1 || url.hostname === 'docs.google.com' && /^\/forms\/(?:d\/|[ue]\/\d+\/d\/)/.test(url.pathname))) throw new InvalidInput('Use a forms.gle or docs.google.com/forms link.');
  if (kind === 'google_drive_link' && !(url.hostname === 'drive.google.com' && /^\/(?:file\/d\/|drive\/|open$)/.test(url.pathname) || url.hostname === 'docs.google.com' && /^\/(?:document|presentation|spreadsheets)\/(?:d\/|[u]\/\d+\/d\/)/.test(url.pathname))) throw new InvalidInput('Use a Google Drive, Docs, Slides, or Sheets link.');
  return url.href;
}
const schemas = {
  terms: { startYear: value => { if (!Number.isSafeInteger(value) || value < 1900 || value > 2200) throw new InvalidInput('Use an academic start year from 1900 to 2200.'); return value; }, semester: text(80) },
  subjects: { termId: objectId, name: text(120), courseCode: optional(text(40, true)), instructor: optional(text(120, true)), section: optional(text(60, true)), order: optional(integer), archived: optional(bool) },
  periods: { subjectId: objectId, label: text(80), order: optional(integer) },
  modules: { subjectId: objectId, periodId: optional(nullableId), title: text(120), order: optional(integer), status: optional(oneOf(['not_started', 'in_progress', 'completed'])) },
  resources: { subjectId: objectId, moduleId: optional(nullableId), title: text(120), kind: oneOf(['google_form_link', 'google_drive_link', 'external_link', 'note']), url: optional(text(1000)), note: optional(text(10000)) },
};
const associations = { subjectId: optional(nullableId), moduleId: optional(nullableId), sourceResourceIds: optional(value => {
  if (!Array.isArray(value) || value.length > 20 || new Set(value).size !== value.length) throw new InvalidInput('Choose up to 20 distinct owned source resources.'); return value.map(objectId);
}) };
function parse(body, schema, patch = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length || Object.keys(body).some(key => !Object.hasOwn(schema, key))) throw new InvalidInput('Invalid academic fields.');
  const clean = {};
  for (const [key, fn] of Object.entries(schema)) {
    if (patch && !Object.hasOwn(body, key)) continue;
    const value = fn(body[key]); if (value !== undefined) clean[key] = value;
  }
  return clean;
}
module.exports = { schemas, associations, parse, resourceUrl, objectId };
