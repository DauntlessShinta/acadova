const LearningTopic = require('../models/LearningTopic');
const LearningResource = require('../models/LearningResource');
const LearningModule = require('../models/LearningModule');
const Assessment = require('../models/Assessment');
const LearningUnlock = require('../models/LearningUnlock');
const { logSecurityEvent } = require('../utils/securityLogger');
const { ACTIONS, auditedContentChange } = require('../services/auditService');
const notifications = require('../services/notificationService');

const id = (value) => String(value);
const topicView = (row) => ({ id: id(row._id), name: row.name, slug: row.slug,
  description: row.description, status: row.status, createdAt: row.createdAt });
const resourceView = (row, staff = false, entitled = false) => ({
  id: id(row._id), topic: id(row.topic), title: row.title, description: row.description,
  createdAt: row.createdAt,
  resourceType: row.resourceType, creditCost: row.creditCost, locked: row.creditCost > 0 && !entitled,
  ...(entitled ? { unlocked: true } : {}),
  ...(staff ? { reviewStatus: row.reviewStatus, submittedBy: id(row.submittedBy),
    reviewedBy: row.reviewedBy ? id(row.reviewedBy) : null, reviewNote: row.reviewNote || null } : {}),
  ...(staff || row.creditCost === 0 || entitled ? {
    ...(row.resourceType === 'text' ? { textContent: row.textContent } : { externalUrl: row.externalUrl }),
  } : {}),
});
const resourcePreview = (row, entitled = false) => {
  const view = resourceView(row, false, entitled);
  delete view.textContent;
  delete view.externalUrl;
  return view;
};
const moduleView = (row, staff = false, entitled = false) => ({
  id: id(row._id), topic: id(row.topic), title: row.title, description: row.description,
  createdAt: row.createdAt,
  creditCost: row.creditCost, locked: row.creditCost > 0 && !entitled,
  ...(entitled ? { unlocked: true } : {}),
  ...(staff ? { status: row.status, resources: row.resources.map(id),
    assessment: row.assessment ? id(row.assessment) : null }
    : row.creditCost === 0 || entitled ? { resources: row.resources.map(id),
      assessment: row.assessment ? id(row.assessment) : null } : {}),
});
const unavailable = (res) => res.status(404).json({ success: false, message: 'Learning content not available.' });
const failure = (res) => res.status(500).json({ success: false, message: 'Learning content could not be processed.' });
const slugOf = (name) => name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

exports.listTopics = async (req, res) => {
  try {
    const rows = await LearningTopic.find({ status: 'published' }).sort({ name: 1 }).limit(100).lean();
    return res.json({ success: true, data: rows.map(topicView) });
  } catch { return failure(res); }
};

exports.getTopic = async (req, res) => {
  try {
    const topic = await LearningTopic.findOne({ _id: req.params.id, status: 'published' }).lean();
    if (!topic) return unavailable(res);
    const [resources, modules, assessments] = await Promise.all([
      LearningResource.find({ topic: topic._id, reviewStatus: 'published' }).sort({ createdAt: -1 }).limit(100).lean(),
      LearningModule.find({ topic: topic._id, status: 'published' }).sort({ createdAt: -1 }).limit(100).lean(),
      Assessment.find({ status: 'published', $or: [{ learningTopic: topic._id },
        { learningTopic: { $exists: false }, topic: topic.name }] })
        .select('_id title topic questions').limit(100).lean(),
    ]);
    const owned = await LearningUnlock.find({ student: req.user.id,
      $or: [{ resource: { $in: resources.map((row) => row._id) } },
        { module: { $in: modules.map((row) => row._id) } }] })
      .select('resource module').lean();
    const ownedResources = new Set(owned.map((row) => row.resource && id(row.resource)).filter(Boolean));
    const ownedModules = new Set(owned.map((row) => row.module && id(row.module)).filter(Boolean));
    return res.json({ success: true, data: { ...topicView(topic),
      resources: resources.map((row) => resourcePreview(row, ownedResources.has(id(row._id)))),
      modules: modules.map((row) => moduleView(row, false, ownedModules.has(id(row._id)))),
      assessments: assessments.map((row) => ({ id: id(row._id), title: row.title,
        questionCount: row.questions.length })) } });
  } catch { return failure(res); }
};

exports.getResource = async (req, res) => {
  try {
    const resource = await LearningResource.findOne({ _id: req.params.id, reviewStatus: 'published' }).lean();
    if (!resource || !await LearningTopic.exists({ _id: resource.topic, status: 'published' })) return unavailable(res);
    const owned = resource.creditCost > 0 && await LearningUnlock.exists({ student: req.user.id, resource: resource._id });
    return res.json({ success: true, data: resourceView(resource, false, Boolean(owned)) });
  } catch { return failure(res); }
};

exports.getModule = async (req, res) => {
  try {
    const module = await LearningModule.findOne({ _id: req.params.id, status: 'published' }).lean();
    if (!module || !await LearningTopic.exists({ _id: module.topic, status: 'published' })) return unavailable(res);
    // Keep an existing module entitlement effective even if staff later lowers its price to zero.
    const owned = await LearningUnlock.exists({ student: req.user.id, module: module._id });
    // An unlocked paid module grants in-module viewing, not standalone Resource entitlements.
    const resources = module.creditCost === 0 || owned
      ? await LearningResource.find({ _id: { $in: module.resources }, topic: module.topic,
        reviewStatus: 'published' }).lean() : [];
    const byId = new Map(resources.map((row) => [id(row._id), row]));
    return res.json({ success: true, data: { ...moduleView(module, false, Boolean(owned)),
      ...(module.creditCost === 0 || owned ? { resources: module.resources.map((resourceId) => byId.get(id(resourceId)))
        .filter(Boolean).map((row) => resourceView(row, false, Boolean(owned))) } : {}) } });
  } catch { return failure(res); }
};

exports.submitResource = async (req, res) => {
  try {
    const body = req.body;
    if (!await LearningTopic.exists({ _id: body.topic, status: 'published' })) return unavailable(res);
    if ((body.resourceType === 'text' && (!body.textContent || body.externalUrl))
      || (body.resourceType === 'url' && (!body.externalUrl || body.textContent))) {
      return res.status(400).json({ success: false, message: 'Provide only the selected resource content.' });
    }
    const row = await LearningResource.create({ ...body, submittedBy: req.user.id,
      reviewStatus: 'submitted', creditCost: 0 });
    return res.status(201).json({ success: true, data: { id: id(row._id), reviewStatus: 'submitted' } });
  } catch { return failure(res); }
};

exports.listStaffTopics = async (req, res) => {
  try {
    const rows = await LearningTopic.find().sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ success: true, data: rows.map(topicView) });
  } catch { return failure(res); }
};
exports.createTopic = async (req, res) => {
  try {
    const slug = slugOf(req.body.name);
    if (!slug) return res.status(400).json({ success: false, message: 'Topic name needs letters or numbers.' });
    if (process.env.NODE_ENV === 'production') {
      const indexes = await LearningTopic.collection.indexes();
      if (!indexes.some((index) => index.name === 'uniq_learning_topic_slug'
        && index.unique === true && index.key?.slug === 1)) {
        return res.status(503).json({ success: false, message: 'Topic creation is temporarily unavailable.' });
      }
    }
    if (await LearningTopic.exists({ slug })) {
      return res.status(409).json({ success: false, message: 'Topic already exists.' });
    }
    const row = await auditedContentChange(req, ACTIONS.topicCreated, 'LearningTopic', 'Learning topic created',
      async (session) => (await LearningTopic.create([{ ...req.body, slug, createdBy: req.user.id,
        status: 'draft' }], { session }))[0]);
    logSecurityEvent('moderation.topic_created', req, { topicId: id(row._id) });
    return res.status(201).json({ success: true, data: topicView(row) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Topic already exists.' });
    return failure(res);
  }
};
exports.updateTopic = async (req, res) => {
  try {
    const slug = slugOf(req.body.name);
    if (!slug) return res.status(400).json({ success: false, message: 'Topic name needs letters or numbers.' });
    const row = await auditedContentChange(req, ACTIONS.topicUpdated, 'LearningTopic', 'Learning topic draft updated',
      (session) => LearningTopic.findOneAndUpdate({ _id: req.params.id, status: 'draft' },
        { $set: { ...req.body, slug } }, { new: true, runValidators: true, session }));
    return row ? res.json({ success: true, data: topicView(row) }) : unavailable(res);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Topic already exists.' });
    return failure(res);
  }
};
exports.publishTopic = async (req, res) => {
  try {
    const row = await auditedContentChange(req, ACTIONS.topicPublished, 'LearningTopic', 'Learning topic published',
      (session) => LearningTopic.findOneAndUpdate({ _id: req.params.id, status: 'draft' },
        { $set: { status: 'published', publishedBy: req.user.id, publishedAt: new Date() } }, { new: true, session }));
    if (!row) return unavailable(res);
    logSecurityEvent('moderation.topic_published', req, { topicId: id(row._id) });
    return res.json({ success: true, data: topicView(row) });
  } catch { return failure(res); }
};
exports.archiveTopic = async (req, res) => {
  try {
    const row = await auditedContentChange(req, ACTIONS.topicArchived, 'LearningTopic', 'Learning topic archived',
      (session) => LearningTopic.findOneAndUpdate({ _id: req.params.id, status: 'published' },
        { $set: { status: 'archived', archivedAt: new Date() } }, { new: true, session }));
    if (!row) return unavailable(res);
    logSecurityEvent('moderation.topic_archived', req, { topicId: id(row._id) });
    return res.json({ success: true, data: topicView(row) });
  } catch { return failure(res); }
};

exports.listStaffResources = async (req, res) => {
  try {
    const rows = await LearningResource.find().sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ success: true, data: rows.map((row) => resourceView(row, true)) });
  } catch { return failure(res); }
};
exports.getStaffResource = async (req, res) => {
  try {
    const row = await LearningResource.findById(req.params.id).lean();
    return row ? res.json({ success: true, data: resourceView(row, true) }) : unavailable(res);
  } catch { return failure(res); }
};
exports.createStaffResource = async (req, res) => {
  try {
    const body = req.body;
    if (!await LearningTopic.exists({ _id: body.topic, status: 'published' })) return unavailable(res);
    if ((body.resourceType === 'text' && (!body.textContent || body.externalUrl))
      || (body.resourceType === 'url' && (!body.externalUrl || body.textContent))) {
      return res.status(400).json({ success: false, message: 'Provide only the selected resource content.' });
    }
    const row = await auditedContentChange(req, ACTIONS.resourceCreated, 'LearningResource',
      'Learning resource draft created', async (session) => (await LearningResource.create([{
        ...body, submittedBy: req.user.id, reviewStatus: 'submitted', creditCost: 0,
      }], { session }))[0]);
    return res.status(201).json({ success: true, data: resourceView(row, true) });
  } catch { return failure(res); }
};
exports.updateStaffResource = async (req, res) => {
  try {
    const body = req.body;
    if (!await LearningTopic.exists({ _id: body.topic, status: 'published' })) return unavailable(res);
    if ((body.resourceType === 'text' && (!body.textContent || body.externalUrl))
      || (body.resourceType === 'url' && (!body.externalUrl || body.textContent))) {
      return res.status(400).json({ success: false, message: 'Provide only the selected resource content.' });
    }
    const row = await auditedContentChange(req, ACTIONS.resourceUpdated, 'LearningResource',
      'Learning resource submission updated',
      (session) => LearningResource.findOneAndUpdate({ _id: req.params.id, reviewStatus: 'submitted' },
        { $set: body, $unset: body.resourceType === 'text'
          ? { externalUrl: 1 } : { textContent: 1 } },
        { new: true, runValidators: true, session }));
    return row ? res.json({ success: true, data: resourceView(row, true) }) : unavailable(res);
  } catch { return failure(res); }
};
exports.publishResource = async (req, res) => {
  try {
    const existing = await LearningResource.findOne({ _id: req.params.id, reviewStatus: 'submitted' }).lean();
    if (!existing || !await LearningTopic.exists({ _id: existing.topic, status: 'published' })) return unavailable(res);
    const row = await auditedContentChange(req, ACTIONS.resourcePublished, 'LearningResource', 'Learning resource approved',
      (session) => LearningResource.findOneAndUpdate({ _id: existing._id, reviewStatus: 'submitted' },
      { $set: { reviewStatus: 'published', reviewedBy: req.user.id, publishedAt: new Date(),
        creditCost: req.body.creditCost } }, { new: true, session }), { creditCost: req.body.creditCost });
    if (!row) return unavailable(res);
    logSecurityEvent('moderation.resource_published', req, { resourceId: id(row._id) });
    await notifications.notifySafely({ recipient: row.submittedBy, type: 'learning.content_status',
      relatedType: 'LearningResource', relatedId: row._id,
      eventKey: `learning.content_status:${id(row._id)}:published` });
    return res.json({ success: true, data: resourceView(row, true) });
  } catch { return failure(res); }
};
exports.rejectResource = async (req, res) => {
  try {
    const row = await auditedContentChange(req, ACTIONS.resourceRejected, 'LearningResource', 'Learning resource rejected',
      (session) => LearningResource.findOneAndUpdate({ _id: req.params.id, reviewStatus: 'submitted' },
        { $set: { reviewStatus: 'rejected', reviewedBy: req.user.id, reviewNote: req.body.reason } }, { new: true, session }));
    if (!row) return unavailable(res);
    logSecurityEvent('moderation.resource_rejected', req, { resourceId: id(row._id) });
    await notifications.notifySafely({ recipient: row.submittedBy, type: 'learning.content_status',
      relatedType: 'LearningResource', relatedId: row._id,
      eventKey: `learning.content_status:${id(row._id)}:rejected` });
    return res.json({ success: true, data: resourceView(row, true) });
  } catch { return failure(res); }
};
exports.archiveResource = async (req, res) => {
  try {
    const row = await auditedContentChange(req, ACTIONS.resourceArchived, 'LearningResource', 'Learning resource archived',
      (session) => LearningResource.findOneAndUpdate({ _id: req.params.id, reviewStatus: 'published' },
        { $set: { reviewStatus: 'archived', reviewedBy: req.user.id } }, { new: true, session }));
    if (!row) return unavailable(res);
    logSecurityEvent('moderation.resource_archived', req, { resourceId: id(row._id) });
    await notifications.notifySafely({ recipient: row.submittedBy, type: 'learning.content_status',
      relatedType: 'LearningResource', relatedId: row._id,
      eventKey: `learning.content_status:${id(row._id)}:archived` });
    return res.json({ success: true, data: resourceView(row, true) });
  } catch { return failure(res); }
};

exports.listStaffModules = async (req, res) => {
  try {
    const rows = await LearningModule.find().sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ success: true, data: rows.map((row) => moduleView(row, true)) });
  } catch { return failure(res); }
};
const moduleReferencesValid = async (body) => {
  const topic = await LearningTopic.findOne({ _id: body.topic, status: 'published' }).lean();
  if (!topic) return false;
  const resources = await LearningResource.find({ _id: { $in: body.resources }, topic: body.topic,
    reviewStatus: 'published' }).select('_id').lean();
  if (resources.length !== body.resources.length) return false;
  if (!body.assessment) return true;
  return Boolean(await Assessment.exists({ _id: body.assessment, status: 'published',
    $or: [{ learningTopic: topic._id }, { learningTopic: { $exists: false }, topic: topic.name }] }));
};
exports.createModule = async (req, res) => {
  try {
    if (!await moduleReferencesValid(req.body)) return res.status(400).json({ success: false,
      message: 'Module resources and assessment must be published within the same topic.' });
    const row = await auditedContentChange(req, ACTIONS.moduleCreated, 'LearningModule', 'Learning module created',
      async (session) => (await LearningModule.create([{ ...req.body, status: 'draft', creditCost: 0,
        createdBy: req.user.id }], { session }))[0]);
    logSecurityEvent('moderation.module_created', req, { moduleId: id(row._id) });
    return res.status(201).json({ success: true, data: moduleView(row, true) });
  } catch { return failure(res); }
};
exports.updateModule = async (req, res) => {
  try {
    if (!await moduleReferencesValid(req.body)) return res.status(400).json({ success: false,
      message: 'Module resources and assessment must be published within the same topic.' });
    const row = await auditedContentChange(req, ACTIONS.moduleUpdated, 'LearningModule',
      'Learning module draft updated',
      (session) => LearningModule.findOneAndUpdate({ _id: req.params.id, status: 'draft' },
        { $set: { topic: req.body.topic, title: req.body.title, description: req.body.description,
          resources: req.body.resources, ...(req.body.assessment ? { assessment: req.body.assessment } : {}) },
        ...(req.body.assessment ? {} : { $unset: { assessment: 1 } }) },
        { new: true, runValidators: true, session }));
    return row ? res.json({ success: true, data: moduleView(row, true) }) : unavailable(res);
  } catch { return failure(res); }
};
exports.publishModule = async (req, res) => {
  try {
    const existing = await LearningModule.findOne({ _id: req.params.id, status: 'draft' }).lean();
    if (!existing) return unavailable(res);
    if (!await moduleReferencesValid(existing)) return res.status(409).json({ success: false,
      message: 'Module content is no longer published in this topic.' });
    const row = await auditedContentChange(req, ACTIONS.modulePublished, 'LearningModule', 'Learning module published',
      (session) => LearningModule.findOneAndUpdate({ _id: existing._id, status: 'draft' },
      { $set: { status: 'published', publishedBy: req.user.id, publishedAt: new Date(),
        creditCost: req.body.creditCost } }, { new: true, session }), { creditCost: req.body.creditCost });
    if (!row) return unavailable(res);
    logSecurityEvent('moderation.module_published', req, { moduleId: id(row._id) });
    return res.json({ success: true, data: moduleView(row, true) });
  } catch { return failure(res); }
};
exports.archiveModule = async (req, res) => {
  try {
    const row = await auditedContentChange(req, ACTIONS.moduleArchived, 'LearningModule', 'Learning module archived',
      (session) => LearningModule.findOneAndUpdate({ _id: req.params.id, status: 'published' },
        { $set: { status: 'archived', archivedAt: new Date() } }, { new: true, session }));
    if (!row) return unavailable(res);
    logSecurityEvent('moderation.module_archived', req, { moduleId: id(row._id) });
    return res.json({ success: true, data: moduleView(row, true) });
  } catch { return failure(res); }
};
