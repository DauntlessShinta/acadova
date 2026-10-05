export function discoveryDestination(scope, query) {
  const value = query.trim();
  if (scope === 'learning') return `/learning${value ? `?q=${encodeURIComponent(value)}` : ''}`;
  return `/tutors${value ? `?subject=${encodeURIComponent(value)}` : ''}`;
}

export function discoveryQueryError(scope, query) {
  const value = query.trim();
  if (value.length > 80) return 'Use 80 characters or fewer.';
  if (scope !== 'learning' && /[\\^$*?()[\]{}|]/.test(value)) return 'Use a subject or skill without search-pattern symbols.';
  return '';
}

export function learningTopicTitle(topic) {
  return topic.title?.trim() || topic.name?.trim() || 'Untitled topic';
}

export function filterLearningTopics(topics, query) {
  const value = query.trim().normalize('NFKC').toLocaleLowerCase();
  if (!value) return topics;
  return topics.filter((topic) => `${learningTopicTitle(topic)} ${topic.description || ''}`.normalize('NFKC').toLocaleLowerCase().includes(value));
}
