const User = require('../models/User');
const Plan = require('../models/StudyPlanItem'); const Subject = require('../models/PersonalSubject'); const Module = require('../models/PersonalModule');
const StudySet = require('../models/StudySet'); const Attempt = require('../models/StudyAttempt');
const { owned } = require('./academicWorkspaceService');
const idOf = value => String(value?._id || value);
const view = row => ({ id: idOf(row), subjectId: idOf(row.subjectId), moduleId: row.moduleId ? idOf(row.moduleId) : null, kind: row.kind, title: row.title, notes: row.notes, dueAt: row.dueAt, timezone: row.timezone, completed: row.completed, completedAt: row.completedAt, version: row.version });
function ruleNudges({ items, modules, sets, attempts, dismissed = [], now = Date.now() }) {
  const candidates = [];
  for (const item of items) if (!item.completed && item.dueAt && new Date(item.dueAt).getTime() <= now + 7 * 86400000) candidates.push({ key: `task:${idOf(item)}:${item.version}`, kind: 'scheduled', title: `${new Date(item.dueAt).getTime() < now ? 'Past your entered date' : 'Upcoming study activity'}: ${item.title}`, subjectId: idOf(item.subjectId), dueAt: item.dueAt });
  for (const module of modules) if (module.status !== 'completed' && !module.lastReviewedAt) candidates.push({ key: `module:${idOf(module)}`, kind: 'unreviewed', title: `No recorded module review: ${module.title}`, subjectId: idOf(module.subjectId), moduleId: idOf(module) });
  for (const set of sets) {
    const latest = set.origin === 'ai' ? set.practiceHistory?.at(-1) : attempts.find(row => idOf(row.studySet) === idOf(set));
    const at = latest?.at || latest?.submittedAt;
    if (at && new Date(at).getTime() >= now - 30 * 86400000 && new Date(at).getTime() <= now && latest.score < 70) candidates.push({ key: `practice:${idOf(set)}:${new Date(at).getTime()}`, kind: 'practice', title: `Latest recorded practice ${latest.score}%: ${set.title}`, subjectId: idOf(set.subjectId), studySetId: idOf(set), origin: set.origin });
  }
  return candidates.filter(row => !dismissed.includes(row.key)).slice(0, 5);
}
async function planState(owner, subjectId, session = null) {
  const user = await User.findById(owner).select('currentTermId studyNudgesEnabled +studyNudgeDismissals').session(session).lean();
  const subjects = subjectId ? [await owned(Subject, owner, subjectId, session)] : user.currentTermId ? await Subject.find({ owner, termId: user.currentTermId, archived: { $ne: true } }).session(session).lean() : [];
  const ids = subjects.map(row => row._id); const filter = { owner, subjectId: { $in: ids } };
  const items = await Plan.find(filter).sort({ dueAt: 1, createdAt: 1 }).session(session).lean();
  // Undated entries stay visible but never acquire inferred deadlines.
  items.sort((a, b) => Number(a.completed) - Number(b.completed) || (a.dueAt ? new Date(a.dueAt).getTime() : Infinity) - (b.dueAt ? new Date(b.dueAt).getTime() : Infinity));
  let nudges = [];
  if (user.studyNudgesEnabled !== false) {
    const modules = await Module.find(filter).sort({ order: 1, createdAt: 1 }).session(session).lean();
    const sets = await StudySet.find({ ...filter, deletedAt: null }).select('_id title subjectId origin practiceHistory').session(session).lean();
    const attempts = await Attempt.find({ student: owner, studySet: { $in: sets.map(row => row._id) }, submittedAt: { $type: 'date' } }).select('studySet score submittedAt').sort({ submittedAt: -1 }).session(session).lean();
    nudges = ruleNudges({ items, modules, sets, attempts, dismissed: user.studyNudgeDismissals || [] });
  }
  return { items: items.map(view), subjects: subjects.map(row => ({ id: idOf(row), name: row.name })), nudgesEnabled: user.studyNudgesEnabled !== false, nudges };
}
module.exports = { planState, ruleNudges, view };
