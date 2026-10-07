import { learningTopicTitle } from './discoverySearch.js';

export function assessmentHref(id, context = {}) {
  const params = new URLSearchParams({ open: id });
  if (context.topicId) params.set('topic', context.topicId);
  if (context.moduleId && context.topicId) {
    params.set('module', context.moduleId);
    params.set('lesson', String(context.lessonIndex || 0));
  }
  return '/assessments?' + params;
}

export function learningReviewHref(context) {
  if (!context?.topicId) return '/learning';
  const params = new URLSearchParams({ topic: context.topicId });
  if (context.moduleId) {
    params.set('module', context.moduleId);
    params.set('lesson', String(context.lessonIndex || 0));
  }
  return '/learning?' + params;
}

export function candidateAssessmentTopic(assessment, topics) {
  const matches = topics.filter((topic) => learningTopicTitle(topic) === assessment.topic);
  return matches.length === 1 ? matches[0] : null;
}

export function verifiedAssessmentReview(assessmentId, topic, module, lesson = 0) {
  if (!assessmentId || !topic?.id) return null;
  if (module?.id && String(module.topic) === String(topic.id) && String(module.assessment) === String(assessmentId)) {
    const last = Math.max(0, (module.resources || []).length - 1);
    return { topicId: topic.id, moduleId: module.id, lessonIndex: Math.min(last, Math.max(0, Number.parseInt(lesson, 10) || 0)) };
  }
  return topic.assessments?.some((item) => String(item.id) === String(assessmentId)) ? { topicId: topic.id } : null;
}
