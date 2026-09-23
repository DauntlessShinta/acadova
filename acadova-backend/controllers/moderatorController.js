const Rating = require('../models/Rating');
const { isValidObjectId } = require('../middleware/validation');
const { recalculateAverageRating } = require('../utils/ratingReputation');

const populateModerationRating = (query) => query
  .populate('fromUser', 'name email')
  .populate('toUser', 'name email')
  .populate('session', 'subject completedAt')
  .populate('moderatedBy', 'name role');

// GET /api/moderator/ratings - includes visible and hidden reviews for review.
exports.listRatingsForModeration = async (req, res) => {
  try {
    const ratings = await populateModerationRating(
      Rating.find().sort({ createdAt: -1 }).limit(200)
    );

    return res.json({ success: true, message: 'Ratings retrieved for moderation', data: ratings });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error while retrieving moderation reviews' });
  }
};

// PATCH /api/moderator/ratings/:id/visibility
exports.updateRatingVisibility = async (req, res) => {
  try {
    const { id } = req.params;
    const { hidden } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid review id' });
    }
    if (typeof hidden !== 'boolean') {
      return res.status(400).json({ success: false, message: 'hidden must be a boolean' });
    }

    const rating = await Rating.findById(id);
    if (!rating) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    rating.isHidden = hidden;
    rating.moderatedBy = req.user.id;
    rating.moderatedAt = new Date();
    await rating.save();

    await recalculateAverageRating(rating.toUser);
    const populatedRating = await populateModerationRating(Rating.findById(rating._id));

    return res.json({
      success: true,
      message: hidden ? 'Review hidden' : 'Review restored',
      data: populatedRating,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error while updating review visibility' });
  }
};
