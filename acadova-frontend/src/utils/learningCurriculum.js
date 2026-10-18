// Match the same governed-topic / legacy-text distinction used by the module API.
export function moduleAssessments(assessments, topic) {
  if (!topic) return [];
  return assessments.filter((item) => item.status === 'published'
    && (Object.hasOwn(item, 'learningTopic')
      ? item.learningTopic != null && String(item.learningTopic) === String(topic.id) : item.topic === topic.name));
}

export function moveLesson(resources, index, direction) {
  const target = index + direction;
  if (![1, -1].includes(direction) || index < 0 || index >= resources.length
    || target < 0 || target >= resources.length) return resources;
  const next = [...resources];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
