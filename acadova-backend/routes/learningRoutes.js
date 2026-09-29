const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const { validateBody, validateParams, validateQuery, schemas } = require('../middleware/validation');
const { staffActionLimiter } = require('../middleware/writeLimiters');
const controller = require('../controllers/learningController');

router.use(authenticateToken, requireRole('student'), validateQuery());
router.get('/topics', controller.listTopics);
router.get('/topics/:id', validateParams(schemas.learningId), controller.getTopic);
router.get('/resources/:id', validateParams(schemas.learningId), controller.getResource);
router.get('/modules/:id', validateParams(schemas.learningId), controller.getModule);
router.post('/resources/submit', staffActionLimiter, validateBody(schemas.learningResource), controller.submitResource);

module.exports = router;
