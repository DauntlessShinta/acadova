const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const { submitRating } = require('../controllers/ratingController');
const { validateBody, validateQuery, schemas } = require('../middleware/validation');
const { ratingLimiter } = require('../middleware/writeLimiters');

router.use(authenticateToken, requireRole('student'));

router.use(validateQuery());
router.post('/', ratingLimiter, validateBody(schemas.rating), submitRating);

module.exports = router;
