const Rating = require('../models/Rating');
const User = require('../models/User');
const mongoose = require('mongoose');

const visibleRatingGroup = { $group: { _id: '$toUser', average: { $avg: '$rating' }, count: { $sum: 1 } } };
async function publicReputation(userId) {
  const stats = await Rating.aggregate([
    { $match: { toUser: new mongoose.Types.ObjectId(String(userId)), isHidden: { $ne: true } } },
    visibleRatingGroup,
  ]);
  return { rating: stats[0]?.average ?? null, ratingCount: stats[0]?.count ?? 0 };
}
// Calculate before sorting/limiting discovery; stored legacy defaults never rank peers.
function reputationStages() {
  return [
    { $lookup: { from: Rating.collection.name, let: { peerId: '$_id' },
      pipeline: [{ $match: { $expr: { $eq: ['$toUser', '$$peerId'] }, isHidden: { $ne: true } } }, visibleRatingGroup], as: 'reputation' } },
    { $set: { rating: { $ifNull: [{ $arrayElemAt: ['$reputation.average', 0] }, null] },
      ratingCount: { $ifNull: [{ $arrayElemAt: ['$reputation.count', 0] }, 0] } } },
  ];
}

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

module.exports = { recalculateAverageRating, publicReputation, reputationStages };
