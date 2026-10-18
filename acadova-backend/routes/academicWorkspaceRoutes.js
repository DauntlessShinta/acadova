const express = require('express');
const multer = require('multer');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const { validateParams, validateBody, validateQuery } = require('../middleware/validation');
const { sessionActionLimiter } = require('../middleware/writeLimiters');
const { objectId } = require('../utils/academicValidation');
const controller = require('../controllers/academicWorkspaceController');
const { aiStudyConfig } = require('../config/aiStudy');
const router = express.Router();
router.use(authenticateToken, requireRole('student'), (req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.use('/plans', require('./studyPlanRoutes'));
router.use(validateQuery());
router.get('/state', controller.state);
router.patch('/current-term', sessionActionLimiter, validateBody({ currentTermId: value => value === null ? null : objectId(value) }), controller.selectTerm);
router.get('/subjects/:id', validateParams({ id: objectId }), controller.subject);
router.patch('/study-sets/:id/associations', sessionActionLimiter, validateParams({ id: objectId }), controller.associate);
router.post('/resources/upload', sessionActionLimiter, (req, res, next) => {
  multer({ storage: multer.memoryStorage(), limits: { fileSize: aiStudyConfig().maxBytes, files: 1, fields: 3, parts: 4, fieldSize: 500, fieldNameSize: 32 } }).single('document')(req, res, error => {
    if (!error) return next(); if (req.file?.buffer) req.file.buffer.fill(0);
    res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ success: false, message: 'Upload one PDF/PPTX up to the configured limit (maximum 5 MB).' });
  });
}, controller.upload);
router.get('/resources/:id/file', validateParams({ id: objectId }), controller.download);
for (const type of Object.keys(controller.types)) {
  router.post(`/${type}`, sessionActionLimiter, controller.create(type));
  router.patch(`/${type}/:id`, sessionActionLimiter, validateParams({ id: objectId }), controller.edit(type));
  router.delete(`/${type}/:id`, sessionActionLimiter, validateParams({ id: objectId }), validateBody({}), controller.remove(type));
}
module.exports = router;
