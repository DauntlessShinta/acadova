const LearningResource = require('../models/LearningResource');
const Assessment = require('../models/Assessment');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const LessonCompletion = require('../models/LessonCompletion');
const id = String;
const assessmentMatches = (assessment, topic) => assessment.status === 'published'
  && (assessment.learningTopic !== undefined ? assessment.learningTopic != null
    && id(assessment.learningTopic) === id(topic._id) : assessment.topic === topic.name);
const summarize = (completed, total) => ({ completedRequirements: completed, totalRequirements: total,
  percent: total ? completed === total ? 100 : Math.min(99, Math.round(completed * 100 / total)) : null,
  complete: total > 0 && completed === total });

async function curriculumProgress(student, topic, modules) {
  const [resources, assessments, completions, attempts] = await Promise.all([
    LearningResource.find({ _id: { $in: modules.flatMap((row) => row.resources) },
      topic: topic._id, reviewStatus: 'published' }).select('_id').lean(),
    Assessment.find({ _id: { $in: modules.map((row) => row.assessment).filter(Boolean) },
      status: 'published' }).select('_id status topic learningTopic').lean(),
    LessonCompletion.find({ student, module: { $in: modules.map((row) => row._id) } }).lean(),
    AssessmentAttempt.find({ student, assessment: { $in: modules.map((row) => row.assessment).filter(Boolean) },
      passed: true, $or: [{ mode: 'official' }, { mode: { $exists: false } }] })
      .select('assessment').lean(),
  ]);
  const eligible = new Set(resources.map((row) => id(row._id)));
  const completed = new Map(completions.map((row) => [`${row.module}:${row.resource}`, row.completedAt]));
  const eligibleAssessments = new Set(assessments.filter((row) => assessmentMatches(row, topic)).map((row) => id(row._id)));
  const passed = new Set(attempts.map((row) => id(row.assessment)));
  const progress = modules.map((module) => {
    const lessons = [...new Set(module.resources.map(id))].filter((resource) => eligible.has(resource))
      .map((resource) => ({ resource, completed: completed.has(`${module._id}:${resource}`),
        completedAt: completed.get(`${module._id}:${resource}`) || null }));
    const assessment = module.assessment && eligibleAssessments.has(id(module.assessment))
      ? { id: id(module.assessment), passed: passed.has(id(module.assessment)) } : null;
    return { module: id(module._id), lessons, assessment,
      ...summarize(lessons.filter((row) => row.completed).length + (assessment?.passed ? 1 : 0),
        lessons.length + (assessment ? 1 : 0)) };
  });
  return { modules: progress,
    ...summarize(progress.reduce((sum, row) => sum + row.completedRequirements, 0),
      progress.reduce((sum, row) => sum + row.totalRequirements, 0)),
    completedModules: progress.filter((row) => row.complete).length, publishedModules: modules.length,
    passedAssessments: progress.filter((row) => row.assessment?.passed).length,
    assessmentRequirements: progress.filter((row) => row.assessment).length };
}
module.exports = { curriculumProgress, summarize, assessmentMatches };
