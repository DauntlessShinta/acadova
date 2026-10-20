const express = require('express');
const multer = require('multer');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const { validateBody, validateParams, validateQuery, schemas, InvalidInput } = require('../middleware/validation');
const { createRateLimiter } = require('../middleware/rateLimiter');
const progressLimiter = createRateLimiter({windowMs:60000,max:60,keyForRequest:req=>String(req.user.id),message:'Generation status checks are temporarily limited. The original request is still processing.'});
const { sessionActionLimiter } = require('../middleware/writeLimiters');
const { aiStudyConfig } = require('../config/aiStudy');
const { createAiStudyController } = require('../controllers/aiStudyController');
const { associations } = require('../utils/academicValidation');
const { objectId } = require('../utils/academicValidation');
const sourceId = value => { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new InvalidInput('Select the current source file again.'); return value; };
const content = value => { if (value === undefined) return undefined; if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 2 || !Array.isArray(value.flashcards) || !Array.isArray(value.questions) || value.flashcards.length > 10 || value.questions.length > 5 || JSON.stringify(value).length > 60000) throw new InvalidInput('Use bounded flashcards and questions from the current preview.'); return value; };
const title = value => { if (typeof value !== 'string' || !value.trim() || value.length > 120 || /[\u0000-\u001f]/.test(value)) throw new InvalidInput('Use a title of 1–120 characters without control characters.'); return value.trim(); };
const version = value => { if (!Number.isSafeInteger(value) || value < 1) throw new InvalidInput('Reload the saved version first.'); return value; };
function createAiStudyRouter(options) {
  const router = express.Router(); const controller = createAiStudyController(options);
  router.use(authenticateToken, requireRole('student'), validateQuery(), (req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.get('/status', controller.status);
  router.get('/requests/:key', progressLimiter, validateParams({ key: value => { if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(value)) throw new InvalidInput('Use a valid generation request key.'); return value; } }), controller.progress);
  router.get('/sources/:id', validateParams(schemas.assessmentId), controller.source);
  router.post('/generate-resource', sessionActionLimiter, controller.configured, validateBody({ resourceId: objectId, sourceId,
    type: value => { if (!['flashcards', 'quiz', 'both'].includes(value)) throw new InvalidInput('Choose a study format.'); return value; },
    mode: value => { if (value !== 'strict_source') throw new InvalidInput('Stored files require Strict Source mode.'); return value; },
    syntheticConsent: value => { if (value === undefined) return undefined; if (value !== true) throw new InvalidInput('Confirm synthetic QA consent.'); return value; },
    providerConsent: value => { if (value === undefined) return undefined; if (value !== true) throw new InvalidInput('Consent to processing your authorized material.'); return value; },
    autoSave: value => { if (value === undefined) return undefined; if (value !== true) throw new InvalidInput('Use module autosave explicitly.'); return value; },
    restartInterrupted: value => { if (value === undefined) return undefined; if (value !== true) throw new InvalidInput('Confirm an interrupted request retry.'); return value; },
    regenerateOf: value => value === undefined ? undefined : objectId(value), regenerateVersion: value => value === undefined ? undefined : version(value),
    count: value => { if (value === undefined) return undefined; if (!Number.isSafeInteger(value) || value < 1 || value > 10) throw new InvalidInput('Choose a bounded item count.'); return value; },
  }), (req, res, next) => { req.sourceRequest = true; next(); }, controller.generate);
  router.post('/generate', sessionActionLimiter, controller.configured, (req, res, next) => {
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: aiStudyConfig().maxBytes, files: 1, fields: 5, parts: 6, fieldSize: 32, fieldNameSize: 32 } }).single('document');
    upload(req, res, error => {
      if (!error) return next();
      if (req.file?.buffer) req.file.buffer.fill(0);
      res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ success: false, message: error.code === 'LIMIT_FILE_SIZE' ? `Document exceeds the upload limit (maximum ${Math.round(aiStudyConfig().maxBytes / 1048576)} MiB).` : 'Upload one PDF/PPTX with the generation type and synthetic-document confirmation.' });
    });
  }, controller.generate);
  router.get('/sets', controller.mine);
  router.post('/sets', sessionActionLimiter, validateBody({ previewId: value => { if (typeof value !== 'string' || !/^[a-f\d-]{36}$/.test(value)) throw new InvalidInput('Use a current generation preview.'); return value; }, title, content, ...associations }), controller.save);
  router.get('/sets/:id', validateParams(schemas.assessmentId), controller.get);
  router.patch('/sets/:id', sessionActionLimiter, validateParams(schemas.assessmentId), validateBody({ title, version }), controller.rename);
  router.post('/sets/:id/archive', sessionActionLimiter, validateParams(schemas.assessmentId), validateBody({ version, archived: value => { if (typeof value !== 'boolean') throw new InvalidInput('Choose archive or restore.'); return value; } }), controller.archive);
  router.post('/sets/:id/delete', sessionActionLimiter, validateParams(schemas.assessmentId), validateBody({ version }), controller.remove);
  router.post('/sets/:id/practice', sessionActionLimiter, validateParams(schemas.assessmentId), validateBody({ answers: value => {
    if (!Array.isArray(value) || !value.length || value.length > 5 || value.some(item => !Number.isInteger(item) || item < 0 || item > 3)) throw new InvalidInput('Answer every AI practice question.'); return value;
  } }), controller.practice);
  return router;
}
module.exports = createAiStudyRouter();
module.exports.createAiStudyRouter = createAiStudyRouter;
