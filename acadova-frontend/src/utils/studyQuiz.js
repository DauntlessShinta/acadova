export const emptyStudyQuestion = () => ({ prompt: '', options: ['', ''], correctIndex: null, explanation: '' });
export const emptyStudySet = () => ({ title: '', subject: '', description: '', questions: [] });
export function studyErrors(draft, complete = false) {
  const errors = {};
  for (const [key, max] of [['title', 120], ['subject', 80], ['description', 1000]]) {
    if ((draft[key] || '').length > max) errors[key] = `Use at most ${max} characters.`;
    if (complete && key !== 'description' && !draft[key]?.trim()) errors[key] = `Add a ${key}.`;
  }
  if (complete && !draft.questions.length) errors.questions = 'Add at least one complete question.';
  draft.questions.forEach((question, index) => {
    if (complete && (!question.prompt.trim() || question.options.length < 2 || question.options.some(option => !option.trim()) || question.correctIndex == null
      || new Set(question.options.map(option => option.trim().normalize('NFKC').toLowerCase())).size !== question.options.length)) errors[`questions.${index}.prompt`] = 'Add a prompt, two to five distinct options and one correct answer.';
  });
  return errors;
}
export const studyStateLabel = state => ({ private: 'Private draft', pending: 'Pending review', published: 'Published', rejected: 'Rejected', removed: 'Removed' }[state] || 'Unavailable');
