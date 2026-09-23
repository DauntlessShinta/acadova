const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { submitRating } = require('../controllers/ratingController');

router.use(authenticateToken);

router.post('/', submitRating);

module.exports = router;
