const sections = new Set(['topics', 'resources', 'modules']);
export function staffLearningHash(section) {
  return `#manage-panel-${sections.has(section) ? section : 'topics'}`;
}
export function staffLearningSection(hash) {
  // Accept old queue links, but emit only the canonical panel URL.
  const section = hash.replace(/^#manage-(?:panel-)?/, '');
  return sections.has(section) ? section : 'topics';
}
