const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const { getMe, updateMe, finishOnboarding, searchTutors, getUserById, getUserReviews } = require('../controllers/userController');
const { validateBody, validateParams, validateQuery, schemas } = require('../middleware/validation');

router.use(authenticateToken);

router.get('/me', validateQuery(), getMe);
router.patch('/me', validateQuery(), validateBody(schemas.profile, { requireOne: true }), updateMe);
router.post('/me/onboarding', requireRole('student'), validateQuery(), validateBody({}), finishOnboarding);
router.get('/tutors', requireRole('student'), validateQuery(schemas.search), searchTutors);
router.get('/:id/reviews', requireRole('student'), validateQuery(), validateParams(schemas.userId), getUserReviews);
router.get('/:id', requireRole('student'), validateQuery(), validateParams(schemas.userId), getUserById);

module.exports = router;
