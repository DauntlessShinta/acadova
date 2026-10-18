const Circle = require('../models/StudyCircle');
const Volunteer = require('../models/VolunteerHost');
const User = require('../models/User');
const Subject = require('../models/PersonalSubject');
const { withOwner, lockOwner, owned } = require('../services/academicWorkspaceService');
const { fail, idOf, transaction } = require('./studyController').helpers;
const { circleInput } = require('../utils/studyCircleValidation');
const { escapeRegExp, InvalidInput } = require('../middleware/validation');
const { recordAudit, ACTIONS } = require('../services/auditService');
const eligible = { role: 'student', suspendedAt: null, emailVerified: { $ne: false } };
const handle = action => async (req, res) => { try { await action(req, res); } catch (error) { const status = error instanceof InvalidInput || error.name === 'ValidationError' ? 400 : error.status || 503; res.status(status).json({ success: false, message: status < 500 ? error.message : 'Study circle unavailable. Refresh and retry.' }); } };
const secrets = '+participants +meetingUrl +subjectId +reports';
async function read(id, session) { const row = await Circle.findById(id).select(secrets).session(session || null); if (!row) fail('Study circle unavailable.', 404); return row; }
const member = (row, actor) => row.participants.some(id => idOf(id) === actor);
function view(row, actor, detail = false) { const host = idOf(row.host) === actor;
  return { id: idOf(row), kind: 'free_study_circle', title: row.title, description: row.description, tags: row.tags, startsAt: row.startsAt, endsAt: row.endsAt, timezone: row.timezone,
    capacity: row.capacity, enrolled: row.participants.length, status: row.status, version: row.version, hostName: row.host?.name || 'Acadova Student', isHost: host, joined: member(row, actor), ...(!row.host ? { hostUnavailable: true } : {}),
    ...(detail && row.status === 'scheduled' && new Date(row.endsAt) > new Date() && (host || member(row, actor)) ? { meetingUrl: row.meetingUrl } : {}),
    ...(detail && host ? { subjectId: row.subjectId, participants: row.participants.map(idOf) } : {}) };
}
async function response(row, req, res, status = 200) { await row.populate('host', 'name'); res.status(status).json({ success: true, data: view(row, req.user.id, true) }); }
exports.list = handle(async (req, res) => {
  const q = req.validatedQuery.q; const tag = req.validatedQuery.tag; const mine = req.validatedQuery.view === 'mine';
  const rows = await Circle.find({ ...(mine ? { $or: [{ host: req.user.id }, { participants: req.user.id }] } : { status: 'scheduled', startsAt: { $gt: new Date() } }),
    ...(q ? { title: { $regex: escapeRegExp(q), $options: 'i' } } : {}), ...(tag ? { tags: tag } : {}) }).select('+participants').populate({ path: 'host', match: eligible, select: 'name' }).sort({ startsAt: 1 }).limit(100);
  res.json({ success: true, data: rows.filter(row => mine || row.host).map(row => view(row, req.user.id)) });
});
exports.get = handle(async (req, res) => { const row = await read(req.params.id); if (!await User.exists({ _id: row.host, ...eligible }) || (row.status !== 'scheduled' || row.endsAt <= new Date()) && idOf(row.host) !== req.user.id && !member(row, req.user.id)) fail('Study circle unavailable.', 404); await response(row, req, res); });
exports.create = handle(async (req, res) => { const body = circleInput(req.body); const row = await withOwner(req.user.id, async session => {
  if (await Circle.countDocuments({ host: req.user.id, status: 'scheduled', endsAt: { $gt: new Date() } }).session(session) >= 20) fail('Manage your existing circles before creating more.', 429);
  if (body.subjectId) await owned(Subject, req.user.id, body.subjectId, session);
  return (await Circle.create([{ ...body, host: req.user.id }], { session }))[0];
}); await response(row, req, res, 201); });
exports.action = handle(async (req, res) => { const action = req.params.action; if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) fail('Enter valid circle details.', 400); const row = await withOwner(req.user.id, async session => {
  const current = await read(req.params.id, session); const host = idOf(current.host) === req.user.id;
  if (!host && action !== 'leave') await lockOwner(current.host, session);
  if (['cancel', 'complete', 'edit', 'remove'].includes(action) && !host) fail('Only the host can manage this circle.', 403);
  if (current.status !== 'scheduled') fail('This circle is no longer scheduled.');
  if (['cancel', 'complete', 'edit', 'remove'].includes(action) && current.version !== req.body.version) fail('This circle changed. Refresh before managing it.');
  if (action === 'join') { if (host) fail('The host already has access and cannot enroll as an attendee.'); if (current.startsAt <= new Date()) fail('Enrollment has closed.'); if (member(current, req.user.id)) fail('You already joined this circle.'); if (current.participants.length >= current.capacity) fail('This circle is full.'); current.participants.push(req.user.id); }
  else if (action === 'leave') { if (host || !member(current, req.user.id)) fail('You are not an attendee.'); current.participants = current.participants.filter(id => idOf(id) !== req.user.id); }
  else if (action === 'cancel') current.status = 'cancelled';
  else if (action === 'complete') { if (current.endsAt > new Date()) fail('The scheduled end must pass before closing the circle.'); current.status = 'completed'; }
  else if (action === 'edit') { if (current.startsAt <= new Date()) fail('Started circles cannot be edited.'); const { version, ...input } = req.body; void version; const body = circleInput(input); if ((body.capacity ?? 12) < current.participants.length) fail('Capacity cannot be below the enrolled count.'); if (body.subjectId) await owned(Subject, req.user.id, body.subjectId, session); Object.assign(current, body); }
  else if (action === 'remove') { if (!member(current, req.body.participantId)) fail('Attendee unavailable.', 404); current.participants = current.participants.filter(id => idOf(id) !== req.body.participantId); }
  else fail('Unknown circle action.', 400);
  current.version++; await current.save({ session }); return current;
}); await response(row, req, res); });
exports.report = handle(async (req, res) => { await withOwner(req.user.id, async session => { const row = await read(req.params.id, session);
  if (idOf(row.host) !== req.user.id && !member(row, req.user.id)) fail('Only a host or enrolled attendee can report this circle.', 403);
  const existing = row.reports.find(r => idOf(r.reporter) === req.user.id); if (existing?.open) return;
  if (row.reports.length >= 100 && !existing) { const closed = row.reports.findIndex(r => !r.open); if (closed < 0) fail('Review queue full; staff review is pending.', 429); row.reports.splice(closed, 1); }
  if (existing) Object.assign(existing, { reason: req.body.reason, at: new Date(), open: true }); else row.reports.push({ reporter: req.user.id, reason: req.body.reason, at: new Date(), open: true });
  row.version++; await row.save({ session });
}); res.json({ success: true, message: 'Report saved for moderator review.' }); });
exports.volunteers = handle(async (req, res) => { const rows = await Volunteer.find({ enabled: true }).populate({ path: 'owner', match: eligible, select: 'name' }).sort({ updatedAt: -1 }).limit(100); const q = (req.validatedQuery.q || '').toLowerCase();
  res.json({ success: true, data: rows.filter(row => row.owner && (!q || [row.owner.name, row.expertise, row.interests].some(v => v.toLowerCase().includes(q)))).map(row => ({ name: row.owner.name, expertise: row.expertise, interests: row.interests, selfDeclared: true })) }); });
exports.myVolunteer = handle(async (req, res) => { const row = await Volunteer.findOne({ owner: req.user.id }); res.json({ success: true, data: { enabled: row?.enabled || false, expertise: row?.expertise || '', interests: row?.interests || '' } }); });
exports.saveVolunteer = handle(async (req, res) => { await withOwner(req.user.id, session => Volunteer.findOneAndUpdate({ owner: req.user.id }, { $set: req.body }, { upsert: true, runValidators: true, session })); return exports.myVolunteer(req, res); });
exports.staffList = handle(async (req, res) => { const rows = await Circle.find({ 'reports.open': true }).select('+reports').populate('host', 'name').sort({ updatedAt: 1 }).limit(100); res.json({ success: true, data: rows.map(row => ({ id: idOf(row), title: row.title, description: row.description, tags: row.tags, hostName: row.host?.name || 'Acadova Student', status: row.status, version: row.version, reports: row.reports.filter(r => r.open).map(r => ({ reason: r.reason, at: r.at })) })) }); });
exports.staffDecide = handle(async (req, res) => { await transaction(async session => { const row = await read(req.params.id, session); if (row.version !== req.body.version || !row.reports.some(r => r.open)) fail('Review changed. Refresh before deciding.'); const previous = row.status;
  if (req.body.outcome === 'cancel') row.status = 'cancelled'; row.reports.forEach(r => { r.open = false; }); row.version++; await row.save({ session });
  await recordAudit({ actor: req.user, action: ACTIONS.circleReview, targetType: 'StudyCircle', targetId: row._id, summary: 'Study circle report reviewed', metadata: { reason: req.body.reason, previousStatus: previous, newStatus: row.status }, session });
}); res.json({ success: true, message: 'Review recorded. No credit changes.' }); });
