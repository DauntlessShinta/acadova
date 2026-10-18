const Plan = require('../models/StudyPlanItem'); const User = require('../models/User');
const { withOwner, owned, validateAssociations, fail } = require('../services/academicWorkspaceService');
const { planState, view } = require('../services/studyPlanService');
const { parse, objectId } = require('../utils/academicValidation');
const { InvalidInput, schemas } = require('../middleware/validation');
const optional = fn => value => value === undefined ? undefined : fn(value);
const text = max => value => { if (typeof value !== 'string' || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new InvalidInput('Use bounded plain text.'); return value.trim(); };
const boolean = value => { if (typeof value !== 'boolean') throw new InvalidInput('Use true or false.'); return value; };
const version = value => { if (!Number.isSafeInteger(value) || value < 1) throw new InvalidInput('Reload this study plan version.'); return value; };
const fields = { subjectId: objectId, moduleId: optional(value => value === null ? null : objectId(value)),
  kind: value => { if (!['exam', 'goal', 'task'].includes(value)) throw new InvalidInput('Choose exam, goal or task.'); return value; },
  title: value => { const clean = text(120)(value); if (!clean) throw new InvalidInput('A plan title is required.'); return clean; }, notes: optional(text(1000)),
  dueAt: optional(value => { if (value === null) return null; const date = schemas.session.scheduledAt(value); const year = new Date(date).getUTCFullYear(); if (year < 1900 || year > 2200) throw new InvalidInput('Use a date between 1900 and 2200.'); return date; }),
  timezone: value => { const zone = text(80)(value); try { new Intl.DateTimeFormat('en', { timeZone: zone }); } catch { throw new InvalidInput('Use a valid timezone.'); } return zone; },
  completed: optional(boolean),
};
const handle = action => async (req, res) => { try { await action(req, res); } catch (error) { const status = error instanceof InvalidInput || error.name === 'ValidationError' ? 400 : error.status || 503; res.status(status).json({ success: false, message: status < 500 ? error.message : 'Study plan unavailable. Retry later.' }); } };
exports.list = handle(async (req, res) => res.json({ success: true, data: await planState(req.user.id, req.validatedQuery.subjectId) }));
exports.create = handle(async (req, res) => {
  const input = parse(req.body, fields);
  const row = await withOwner(req.user.id, async session => {
    const association = await validateAssociations(req.user.id, input, session);
    if (await Plan.countDocuments({ owner: req.user.id }).session(session) >= 500) fail('Your study plan limit is 500 entries.', 429);
    return (await Plan.create([{ ...input, subjectId: association.subjectId, moduleId: association.moduleId, owner: req.user.id, completedAt: input.completed ? new Date() : null }], { session }))[0];
  }); res.status(201).json({ success: true, data: view(row) });
});
exports.edit = handle(async (req, res) => {
  const input = parse(req.body, { ...fields, version }, true); if (!input.version) throw new InvalidInput('Reload the study plan before editing.');
  const row = await withOwner(req.user.id, async session => {
    const row = await owned(Plan, req.user.id, req.params.id, session); if (row.version !== input.version) fail('This entry changed. Reload before saving.', 409);
    if (input.subjectId && String(input.subjectId) !== String(row.subjectId)) fail('Keep this entry in its original subject.');
    const association = await validateAssociations(req.user.id, { subjectId: row.subjectId, moduleId: input.moduleId === undefined ? row.moduleId : input.moduleId }, session);
    Object.assign(row, input, { subjectId: association.subjectId, moduleId: association.moduleId, version: row.version + 1 });
    if (Object.hasOwn(input, 'completed')) row.completedAt = input.completed ? row.completedAt || new Date() : null;
    await row.save({ session }); return row;
  }); res.json({ success: true, data: view(row) });
});
exports.remove = handle(async (req, res) => { const expected = version(req.body.version); await withOwner(req.user.id, async session => { const row = await owned(Plan, req.user.id, req.params.id, session); if (row.version !== expected) fail('This entry changed. Reload before deleting.', 409); await Plan.deleteOne({ _id: row._id, owner: req.user.id, version: expected }, { session }); }); res.json({ success: true }); });
exports.preferences = handle(async (req, res) => { await withOwner(req.user.id, async session => { await User.updateOne({ _id: req.user.id }, { $set: { studyNudgesEnabled: req.body.enabled } }, { session }); }); res.json({ success: true, data: { enabled: req.body.enabled } }); });
exports.dismiss = handle(async (req, res) => {
  await withOwner(req.user.id, async session => {
    const state = await planState(req.user.id, req.validatedQuery.subjectId, session);
    if (!state.nudges.some(row => row.key === req.body.key)) fail('This suggestion is no longer available.', 404);
    await User.updateOne({ _id: req.user.id }, { $push: { studyNudgeDismissals: { $each: [req.body.key], $slice: -100 } } }, { session });
  }); res.json({ success: true });
});
exports.validators = { version, boolean, fields };
