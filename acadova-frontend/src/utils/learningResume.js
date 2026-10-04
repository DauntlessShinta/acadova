const keyFor = (userId) => 'acadova_learning_resume_' + String(userId || '');

export function readLearningResume(userId) {
  if (!userId) return null;
  try {
    const value = JSON.parse(localStorage.getItem(keyFor(userId)) || 'null');
    return value && typeof value.topicId === 'string' && typeof value.moduleId === 'string'
      && Number.isInteger(value.lessonIndex) && value.lessonIndex >= 0 ? value : null;
  } catch { return null; }
}

export function saveLearningResume(userId, value) {
  if (!userId) return;
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify({
      topicId: value.topicId, moduleId: value.moduleId, lessonIndex: value.lessonIndex,
      moduleTitle: value.moduleTitle,
    }));
  } catch { /* Learning remains available when browser storage is unavailable. */ }
}
