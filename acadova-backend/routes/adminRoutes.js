const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const { listUsers, listSessions, updateUserRole } = require('../controllers/adminController');
const { validateBody, validateParams, validateQuery, schemas } = require('../middleware/validation');
const { staffActionLimiter } = require('../middleware/writeLimiters');
const { getCreditRules, updateCreditRules, adjustCredits, getRecentCreditActivity } = require('../controllers/adminCreditController');

router.use(authenticateToken, requireRole('admin'));
router.use(validateQuery());

router.get('/users', listUsers);
router.get('/sessions', listSessions);
router.get('/credits/rules', getCreditRules);
router.patch('/credits/rules', staffActionLimiter, validateBody(schemas.creditRules), updateCreditRules);
router.post('/credits/adjustments', staffActionLimiter, validateBody(schemas.adminCreditAdjustment), adjustCredits);
router.get('/credits/activity', getRecentCreditActivity);
router.patch('/users/:id/role', staffActionLimiter, validateParams(schemas.userId), validateBody(schemas.role), updateUserRole);

module.exports = router;
