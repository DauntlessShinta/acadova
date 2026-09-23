const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');
const { createRateLimiter } = require('../middleware/rateLimiter');
const { validateBody, validateQuery, schemas } = require('../middleware/validation');

// Basic brute-force protection: 20 attempts per 15 minutes per IP.
// Loose enough to not get in the way of normal development/testing.
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many attempts, please try again later',
});

router.use(validateQuery());
router.post('/register', authLimiter, validateBody(schemas.register), register);
router.post('/login', authLimiter, validateBody(schemas.login), login);

module.exports = router;
