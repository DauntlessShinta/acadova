const Rating = require('../models/Rating');
const User = require('../models/User');

// Public reputation excludes reviews hidden by a moderator. Existing ratings
// without the field are visible for backward compatibility.
async function recalculateAverageRating(userId, session) {
  const aggregation = Rating.aggregate([
    { $match: { toUser: userId, isHidden: { $ne: true } } },
    { $group: { _id: '$toUser', average: { $avg: '$rating' } } },
  ]);
  const stats = session ? await aggregation.session(session) : await aggregation;
  const average = stats.length ? stats[0].average : 5.0;
  await User.findByIdAndUpdate(userId, { rating: average }, session ? { session } : {});
  return average;
}

module.exports = { recalculateAverageRating };
