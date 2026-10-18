export function moduleProgress(row) {
  const total = Number.isSafeInteger(row.moduleCount) && row.moduleCount > 0 ? row.moduleCount : 0;
  const complete = Math.min(total, Math.max(0, Number.isSafeInteger(row.completedCount) ? row.completedCount : 0));
  return { total, complete, percent: total ? Math.round(complete / total * 100) : 0 };
}
export function subjectProgressState(row) {
  const { total, complete } = moduleProgress(row);
  return total && complete === total ? 'completed' : complete ? 'with_progress' : 'no_completions';
}
export function visibleSubjects(subjects, { query = '', filter = 'all', sort = 'order' } = {}) {
  const q = query.trim().toLocaleLowerCase();
  return subjects.filter(row => (filter === 'archived' ? row.archived : !row.archived)
    && (['all', 'archived'].includes(filter) || subjectProgressState(row) === filter)
    && [row.name, row.courseCode, row.instructor, row.section].some(v => String(v || '').toLocaleLowerCase().includes(q)))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'progress' ? moduleProgress(b).percent - moduleProgress(a).percent : (a.order || 0) - (b.order || 0));
}
export function academicSummary(subjects) {
  const active = subjects.filter(row => !row.archived);
  return { active: active.length, complete: active.reduce((sum, row) => sum + moduleProgress(row).complete, 0),
    total: active.reduce((sum, row) => sum + moduleProgress(row).total, 0), completedSubjects: active.filter(row => subjectProgressState(row) === 'completed').length };
}
