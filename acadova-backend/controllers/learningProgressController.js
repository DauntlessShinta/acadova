const LearningTopic = require('../models/LearningTopic');
const LearningModule = require('../models/LearningModule');
const LearningResource = require('../models/LearningResource');
const LearningUnlock = require('../models/LearningUnlock');
const LessonCompletion = require('../models/LessonCompletion');
const { curriculumProgress } = require('../services/learningProgressService');
const unavailable = (res) => res.status(404).json({ success: false, message: 'Learning content not available.' });
const failure = (res) => res.status(500).json({ success: false, message: 'Learning progress could not be processed.' });

exports.topicProgress = async (req, res) => {
  try {
    const topic = await LearningTopic.findOne({ _id: req.params.id, status: 'published' }).lean();
    if (!topic) return unavailable(res);
    const modules = await LearningModule.find({ topic: topic._id, status: 'published' }).lean();
    return res.json({ success: true, data: await curriculumProgress(req.user.id, topic, modules) });
  } catch { return failure(res); }
};
exports.moduleProgress = async (req, res) => {
  try {
    const module = await LearningModule.findOne({ _id: req.params.id, status: 'published' }).lean();
    if (!module) return unavailable(res);
    const topic = await LearningTopic.findOne({ _id: module.topic, status: 'published' }).lean();
    if (!topic) return unavailable(res);
    const progress = await curriculumProgress(req.user.id, topic, [module]);
    return res.json({ success: true, data: progress.modules[0] });
  } catch { return failure(res); }
};
exports.completeLesson = async (req, res) => {
  try {
    const module = await LearningModule.findOne({ _id: req.params.id, status: 'published',
      resources: req.params.resourceId }).lean();
    if (!module || !await LearningTopic.exists({ _id: module.topic, status: 'published' })) return unavailable(res);
    const resource = await LearningResource.findOne({ _id: req.params.resourceId, topic: module.topic,
      reviewStatus: 'published' }).lean();
    if (!resource) return unavailable(res);
    const moduleOwned = await LearningUnlock.exists({ student: req.user.id, module: module._id });
    if (module.creditCost !== 0 && !moduleOwned) return res.status(403).json({ success: false, message: 'Unlock this module before recording completion.' });
    if (resource.creditCost !== 0 && !moduleOwned
      && !await LearningUnlock.exists({ student: req.user.id, resource: resource._id })) {
      return res.status(403).json({ success: false, message: 'Unlock this resource before recording completion.' });
    }
    if (process.env.NODE_ENV === 'production') {
      let indexes = [];
      try { indexes = await LessonCompletion.collection.indexes(); } catch { /* Fail closed before rollout. */ }
      if (!indexes.some((index) => index.name === 'uniq_student_module_lesson' && index.unique === true
        && index.key?.student === 1 && index.key?.module === 1 && index.key?.resource === 1
        && Object.keys(index.key).length === 3 && !index.partialFilterExpression && !index.sparse)) {
        return res.status(503).json({ success: false, message: 'Lesson completion is temporarily unavailable.' });
      }
    }
    if (process.env.NODE_ENV !== 'production') await LessonCompletion.init();
    const filter = { student: req.user.id, module: module._id, resource: resource._id };
    let row;
    try {
      row = await LessonCompletion.findOneAndUpdate(filter, { $setOnInsert: { completedAt: new Date() } },
        { upsert: true, new: true, runValidators: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      row = await LessonCompletion.findOne(filter);
      if (!row) throw error;
    }
    return res.json({ success: true, data: { resource: String(row.resource), module: String(row.module),
      completed: true, completedAt: row.completedAt } });
  } catch { return failure(res); }
};
