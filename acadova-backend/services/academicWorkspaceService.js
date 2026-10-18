const User = require('../models/User');
const { PersonalSubject, PersonalModule, AcademicResource } = require('../models/academic');
const { transaction } = require('../controllers/studyController').helpers;
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
async function lockOwner(owner, session) {
  const user = await User.findOneAndUpdate({ _id: owner, role: 'student', suspendedAt: null, emailVerified: { $ne: false } }, { $inc: { academicGuard: 1 } }, { session, returnDocument: 'after' });
  if (!user) fail('Student workspace unavailable.', 403);
  return user;
}
const withOwner = (owner, action) => transaction(async session => { const user = await lockOwner(owner, session); return action(session, user); });
async function owned(Model, owner, id, session = null) {
  const row = await Model.findOne({ _id: id, owner }).session(session);
  if (!row) fail('Academic record not found.', 404); return row;
}
async function validateAssociations(owner, input, session) {
  let subjectId = input.subjectId || null; const moduleId = input.moduleId || null;
  if (moduleId) { const module = await owned(PersonalModule, owner, moduleId, session); if (subjectId && String(module.subjectId) !== String(subjectId)) fail('Module belongs to another subject.'); subjectId = module.subjectId; }
  if (subjectId) await owned(PersonalSubject, owner, subjectId, session);
  const ids = input.sourceResourceIds || [];
  if (ids.length && !subjectId) fail('Choose a subject for source resources.');
  for (const id of ids) {
    const row = await owned(AcademicResource, owner, id, session);
    if (String(row.subjectId) !== String(subjectId) || moduleId && row.moduleId && String(row.moduleId) !== String(moduleId)) fail('Source resource belongs to another subject or module.');
  }
  return { subjectId, moduleId, sourceResourceIds: ids };
}
module.exports = { fail, lockOwner, withOwner, owned, validateAssociations };
