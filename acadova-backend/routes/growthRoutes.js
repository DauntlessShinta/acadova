const router = require('express').Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const { validateQuery } = require('../middleware/validation');
const { growthStatus } = require('../services/growthFoundation');
router.use(authenticateToken, requireRole('student'), validateQuery());
// No public award, conversion, purchase, spend or transfer endpoint exists.
// No ledger collection/index is created by this inactive status endpoint.
router.get('/', (req, res) => res.set('Cache-Control', 'private, no-store').json({ success: true, data: growthStatus() }));
module.exports = router;
