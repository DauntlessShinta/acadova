const { createHash, randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const StudySet = require('../models/StudySet');
const Quota = require('../models/AiStudyQuota');
const Preview = require('../models/AiStudyPreview');
const { aiStudyConfig, aiError, requireConfigured } = require('../config/aiStudy');
const { validateFile, extractDocument } = require('../services/aiDocumentService');
const { createGeminiStudyService } = require('../services/geminiStudyService');
const { validateOutput } = require('../utils/aiStudyOutput');
const { gradeStudy } = require('../utils/studyQuiz');
const { transaction } = require('./studyController').helpers;
const { lockOwner, validateAssociations } = require('../services/academicWorkspaceService');
const { validateStrictOutput } = require('../utils/strictStudyOutput');
const { resourceFile, sourceMetadata } = require('../services/strictStudySource');
const view = row => ({ id: String(row._id), title: row.title, origin: 'ai', state: 'private', version: row.version,
  subjectId: row.subjectId, moduleId: row.moduleId, sourceResourceIds: row.sourceResourceIds,
  flashcards: row.flashcards, questions: row.questions, ai: row.ai, practiceHistory: row.practiceHistory,
  createdAt: row.createdAt, updatedAt: row.updatedAt, creditsAwarded: 0 });
const handle = action => async (req, res) => { try { await action(req, res); }
  catch (error) { res.status(error.status || 503).json({ success: false, message: error.status ? error.message : 'AI study action is temporarily unavailable. Retry later.', code: error.code || 'AI_STUDY_UNAVAILABLE', ...(error.details ? { details: error.details } : {}) }); }
  finally { if (req.file?.buffer) { req.file.buffer.fill(0); delete req.file; } }
};
async function ensureQuota(owner) {
  try { await Quota.updateOne({ _id: owner }, { $setOnInsert: { day: '', used: 0, activeUntil: new Date(0), requests: [] } }, { upsert: true }); }
  catch (error) { if (error.code !== 11000) throw error; }
}
async function lockQuota(owner, session) {
  return Quota.findOneAndUpdate({ _id: owner }, { $inc: { guard: 1 } }, { session, returnDocument: 'after' });
}
async function reserve(owner, key, fingerprint, config) {
  await ensureQuota(owner);
  return transaction(async session => {
    const row = await lockQuota(owner, session); const now = new Date(); const day = now.toISOString().slice(0, 10);
    if (row.day === day) {
      const previous = row.requests.find(item => item.key === key);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw aiError('This request key was used for different content. Start a new generation.', 409);
        if (previous.state === 'pending') throw aiError('This generation is already processing. Wait before retrying.', 409, 'AI_STUDY_IN_PROGRESS');
        if (previous.state === 'failed') throw aiError('This generation failed. Start a new request to retry; failed provider requests count toward the daily limit.', 409, 'AI_STUDY_PREVIOUS_FAILURE');
        return { replay: previous.toObject() };
      }
    }
    if (row.activeUntil > now) throw aiError('Only one generation can run at a time. Wait for the current request.', 409, 'AI_STUDY_IN_PROGRESS');
    if (row.day !== day) { row.day = day; row.used = 0; row.requests = []; }
    if (row.used >= config.dailyLimit) throw aiError(`Daily generation limit reached (${config.dailyLimit} requests, resets at 00:00 UTC). Saved study sets remain available.`, 429, 'AI_STUDY_QUOTA');
    row.used++; row.activeUntil = new Date(now.getTime() + 120000); row.activeKey = key;
    const previewId = randomUUID(); row.requests.push({ key, fingerprint, previewId, state: 'pending' });
    await row.save({ session }); return { previewId };
  });
}
function createAiStudyController({ provider = createGeminiStudyService(), extract = extractDocument, configFor = aiStudyConfig } = {}) {
  async function stage(owner, key, value) {
    await Quota.updateOne({ _id: owner, activeKey: key, 'requests.key': key }, { $set: { 'requests.$.stage': value } });
  }
  async function owned(req, session = null) {
    const row = await StudySet.findOne({ _id: req.params.id, owner: req.user.id, origin: 'ai', state: 'private', deletedAt: null }).session(session);
    if (!row) throw aiError('Private AI study set not found.', 404); return row;
  }
  async function replay(owner, request) {
    if (request.state === 'saved') {
      const row = await StudySet.findOne({ _id: request.savedSetId, owner, origin: 'ai', deletedAt: null });
      if (!row) throw aiError('The saved set was deleted. Start a new generation.', 409);
      return { savedSet: view(row), previewId: request.previewId };
    }
    const row = await Preview.findOne({ _id: request.previewId, owner, expiresAt: { $gt: new Date() } });
    if (!row) throw aiError('The preview expired. Generate again with a new request key.', 410, 'AI_STUDY_EXPIRED');
    return { previewId: row._id, ...row.data, expiresAt: row.expiresAt };
  }
  return {
    progress: handle(async (req, res) => {
      const quota = await Quota.findById(req.user.id).lean();
      const request = quota?.requests.find(item => item.key === req.params.key);
      if (!request) throw aiError('Generation request not found for this account.', 404);
      const state = request.state;
      res.json({ success: true, data: { state, stage: state === 'saved' ? 'saved' : state === 'complete' ? 'ready' : state === 'failed' ? 'failed' : request.stage || 'processing' } });
    }),
    source: handle(async (req, res) => { const source = await resourceFile(req.user.id, req.params.id); try { res.json({ success: true, data: sourceMetadata(source.resource, source.identity) }); } finally { source.file.buffer.fill(0); } }),
    status: handle(async (req, res) => {
      const config = configFor(); const local = ['127.0.0.1', 'localhost', '::1'].includes(mongoose.connection.host);
      const quota = await Quota.findById(req.user.id).lean(); const day = new Date().toISOString().slice(0, 10);
      const available = config.enabled && Boolean(config.apiKey) && (!config.syntheticOnly || local);
      res.json({ success: true, data: { enabled: available, syntheticOnly: config.syntheticOnly,
        message: !config.enabled ? 'Generation is disabled by the server administrator.' : config.syntheticOnly && !local ? 'Synthetic QA requires an isolated local MongoDB database.' : !config.apiKey ? 'Gemini is not configured on the backend.' : config.syntheticOnly ? 'Synthetic-document QA only.' : 'Authorized learning materials only. Google Gemini processes document contents after your consent.',
        maxBytes: config.maxBytes, maxPages: config.maxPages, maxSlides: config.maxSlides,
        maxCards: config.maxCards, maxQuestions: config.maxQuestions, dailyLimit: config.dailyLimit,
        remaining: Math.max(0, config.dailyLimit - (quota?.day === day ? quota.used : 0)), maxSets: config.maxSets } });
    }),
    configured: (req, res, next) => { try {
      const config = configFor(); requireConfigured(config);
      if (config.syntheticOnly && !['127.0.0.1', 'localhost', '::1'].includes(mongoose.connection.host)) throw aiError('Synthetic QA requires an isolated local MongoDB database.', 503, 'AI_STUDY_LOCAL_ONLY');
      next();
    } catch (error) { res.status(error.status).json({ success: false, message: error.message, code: error.code }); } },
    generate: handle(async (req, res) => {
      const config = configFor(); const { type, syntheticConsent, providerConsent, count, resourceId, sourceId } = req.body || {}; const mode = req.body?.mode || 'standard';
      if (!req.sourceRequest && (resourceId !== undefined || sourceId !== undefined)) throw aiError('Use the authenticated stored-source route.');
      const consented = config.syntheticOnly ? syntheticConsent === (resourceId ? true : 'true') : providerConsent === (resourceId ? true : 'true');
      if (Object.keys(req.body || {}).some(key => !['type', 'syntheticConsent', 'providerConsent', 'mode', 'count', 'resourceId', 'sourceId'].includes(key)) || !['flashcards', 'quiz', 'both'].includes(type) || !['standard', 'strict_source'].includes(mode) || !consented) throw aiError('Choose a study format and consent to Google Gemini processing authorized, non-sensitive material.');
      if (resourceId && mode !== 'strict_source') throw aiError('Stored resources support Strict Source mode only.');
      const maximum = type === 'flashcards' ? config.maxCards : type === 'quiz' ? config.maxQuestions : Math.min(config.maxCards, config.maxQuestions);
      if (count !== undefined && (!/^[1-9]\d?$/.test(String(count)) || Number(count) > maximum)) throw aiError(`Request 1–${maximum} items per selected format.`);
      const requested = { ...config, ...(count !== undefined ? { maxCards: Number(count), maxQuestions: Number(count) } : {}) };
      const key = req.get('Idempotency-Key');
      if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(key)) throw aiError('Supply a valid generation request key.');
      let stored;
      if (resourceId) { stored = await resourceFile(req.user.id, resourceId, sourceId); req.file = stored.file; }
      const source = validateFile(req.file, config);
      const digest = createHash('sha256').update(req.file.buffer).update('\0' + type + '\0' + source.name);
      if (mode !== 'standard' || count !== undefined || resourceId) digest.update('\0' + mode + '\0' + (count || '') + '\0' + (resourceId || ''));
      const fingerprint = digest.digest('hex');
      const reservation = await reserve(req.user.id, key, fingerprint, config);
      if (reservation.replay) return res.json({ success: true, data: await replay(req.user.id, reservation.replay) });
      try {
        await stage(req.user.id, key, 'extracting');
        const document = await extract(req.file, config);
        await stage(req.user.id, key, 'preparing');
        const strictSource = mode === 'strict_source' ? { sourceId: document.sourceId, format: document.format, units: document.units, segments: document.segments, ...(stored ? { resourceId, subjectId: String(stored.resource.subjectId), moduleId: stored.resource.moduleId ? String(stored.resource.moduleId) : null } : {}) } : null;
        await stage(req.user.id, key, 'generating');
        const generated = await provider.generate({ document: strictSource || document, type, config: requested, mode });
        await stage(req.user.id, key, 'validating');
        const { modelVersion, ...generatedContent } = generated;
        const content = mode === 'strict_source' ? validateStrictOutput(generatedContent, type, strictSource, requested) : validateOutput({ title: generated.title, flashcards: generated.flashcards, questions: generated.questions }, type, document, requested);
        const { validation, ...items } = content;
        const ai = { generationType: type, sourceName: document.name, sourceFormat: document.format, sourceUnits: document.units, sourceBytes: document.bytes,
          model: config.model, modelVersion: String(modelVersion || config.model).slice(0, 120), limitation: document.limitation,
          generationMode: mode, ...(validation ? { sourceId: document.sourceId, sourceResourceId: resourceId, validationVersion: validation.version, validationNote: validation.note, coverage: validation.coverage, rejectionReasons: validation.reasons, requestedCards: requested.maxCards, requestedQuestions: requested.maxQuestions } : {}) };
        const expiresAt = new Date(Date.now() + config.previewMinutes * 60000);
        await transaction(async session => {
          const quota = await lockQuota(req.user.id, session);
          const request = quota.requests.find(item => item.key === key && item.previewId === reservation.previewId && item.state === 'pending');
          if (!request || quota.activeKey !== key) throw aiError('Generation reservation expired. Nothing was saved.', 409);
          if (stored) { await lockOwner(req.user.id, session); const fresh = await resourceFile(req.user.id, resourceId, document.sourceId, session); fresh.file.buffer.fill(0); }
          await Preview.create([{ _id: reservation.previewId, owner: req.user.id, data: { ...items, ai }, ...(strictSource ? { strictSource } : {}), expiresAt }], { session });
          request.state = 'complete'; request.stage = 'ready'; quota.activeUntil = new Date(0); quota.activeKey = undefined; await quota.save({ session });
        });
        res.json({ success: true, data: { previewId: reservation.previewId, ...items, ai, expiresAt } });
      } catch (error) {
        await Quota.updateOne({ _id: req.user.id, activeKey: key, 'requests.previewId': reservation.previewId }, { $set: { activeUntil: new Date(0), 'requests.$.state': 'failed' }, $unset: { activeKey: 1 } }).catch(() => {});
        throw error;
      }
    }),
    save: handle(async (req, res) => {
      const row = await transaction(async session => {
        const quota = await lockQuota(req.user.id, session);
        const receipt = quota?.requests.find(item => item.previewId === req.body.previewId);
        if (receipt?.state === 'saved') {
          const existing = await StudySet.findOne({ _id: receipt.savedSetId, owner: req.user.id, origin: 'ai', deletedAt: null }).session(session);
          if (!existing) throw aiError('This saved study set was deleted.', 410); return existing;
        }
        const preview = await Preview.findOne({ _id: req.body.previewId, owner: req.user.id, expiresAt: { $gt: new Date() } }).select('+strictSource').session(session);
        if (!preview || receipt?.state !== 'complete') throw aiError('Preview not found or expired. Generate again before saving.', 410);
        const config = configFor();
        await lockOwner(req.user.id, session);
        const strict = preview.data.ai.generationMode === 'strict_source'; const source = preview.strictSource;
        let associationInput = req.body;
        if (strict && source?.resourceId) {
          const original = await resourceFile(req.user.id, source.resourceId, source.sourceId, session); original.file.buffer.fill(0);
          if (req.body.subjectId && String(req.body.subjectId) !== source.subjectId || req.body.moduleId && source.moduleId && String(req.body.moduleId) !== source.moduleId) throw aiError('Save this set in its source subject/module.', 400);
          associationInput = { subjectId: source.subjectId, moduleId: req.body.moduleId || source.moduleId, sourceResourceIds: [...new Set([...(req.body.sourceResourceIds || []), source.resourceId])] };
          if (associationInput.sourceResourceIds.length > 20) throw aiError('Choose at most 20 source resources, including the original source.');
        }
        const associations = await validateAssociations(req.user.id, associationInput, session);
        if (await StudySet.countDocuments({ owner: req.user.id, origin: 'ai' }).session(session) >= config.maxSets) throw aiError(`You can save up to ${config.maxSets} AI study sets. Delete an old set first.`, 429);
        const draft = { title: req.body.title, ...(req.body.content || { flashcards: preview.data.flashcards, questions: preview.data.questions }) };
        const content = strict ? validateStrictOutput(draft, preview.data.ai.generationType, source, { ...config, maxCards: preview.data.ai.requestedCards, maxQuestions: preview.data.ai.requestedQuestions }, { requireAll: true }) : validateOutput(draft, preview.data.ai.generationType, { units: preview.data.ai.sourceUnits }, config);
        const { validation, ...items } = content;
        const created = (await StudySet.create([{ ...items, ...associations, owner: req.user.id, origin: 'ai', state: 'private', ai: { ...preview.data.ai, ...(validation ? { coverage: validation.coverage } : {}) } }], { session }))[0];
        receipt.state = 'saved'; receipt.savedSetId = created._id; await quota.save({ session });
        await Preview.deleteOne({ _id: preview._id, owner: req.user.id }, { session }); return created;
      });
      res.status(201).json({ success: true, data: view(row) });
    }),
    mine: handle(async (req, res) => { const rows = await StudySet.find({ owner: req.user.id, origin: 'ai', deletedAt: null, state: 'private' }).sort({ createdAt: -1 }).limit(configFor().maxSets); res.json({ success: true, data: rows.map(view) }); }),
    get: handle(async (req, res) => res.json({ success: true, data: view(await owned(req)) })),
    rename: handle(async (req, res) => {
      const row = await StudySet.findOneAndUpdate({ _id: req.params.id, owner: req.user.id, origin: 'ai', state: 'private', deletedAt: null, version: req.body.version }, { $set: { title: req.body.title }, $inc: { version: 1 } }, { returnDocument: 'after', runValidators: true });
      if (!row) throw aiError('Study set changed or is unavailable. Reload before renaming.', 409); res.json({ success: true, data: view(row) });
    }),
    remove: handle(async (req, res) => {
      await transaction(async session => {
        await lockQuota(req.user.id, session);
        const result = await StudySet.deleteOne({ _id: req.params.id, owner: req.user.id, origin: 'ai', state: 'private', version: req.body.version }, { session });
        if (!result.deletedCount) throw aiError('Study set changed or is unavailable. Reload before deleting.', 409);
      }); res.json({ success: true, message: 'Private AI set and its practice history deleted.' });
    }),
    practice: handle(async (req, res) => {
      const row = await owned(req); if (!row.questions.length) throw aiError('This set contains flashcards only.');
      const grade = gradeStudy(row, req.body.answers);
      const updated = await StudySet.findOneAndUpdate({ _id: row._id, owner: req.user.id, origin: 'ai', state: 'private', version: row.version, deletedAt: null },
        { $push: { practiceHistory: { $each: [{ ...grade, at: new Date() }], $slice: -configFor().historyLimit } } }, { returnDocument: 'after' });
      if (!updated) throw aiError('Study set changed or was deleted. Reopen before practicing.', 409);
      res.json({ success: true, data: { ...grade, creditsAwarded: 0, practiceHistory: updated.practiceHistory } });
    }),
  };
}
module.exports = { createAiStudyController, reserve };
