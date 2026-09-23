const Rating = require('../models/Rating');
const User = require('../models/User');

// Public reputation excludes reviews hidden by a moderator. Existing ratings
// without the field are visible for backward compatibility.
async function recalculateAverageRating(userId) {
  const stats = await Rating.aggregate([
    { $match: { toUser: userId, isHidden: { $ne: true } } },
    { $group: { _id: '$toUser', average: { $avg: '$rating' } } },
  ]);
  const average = stats.length ? stats[0].average : 5.0;
  await User.findByIdAndUpdate(userId, { rating: average });
  return average;
}

module.exports = { recalculateAverageRating };
