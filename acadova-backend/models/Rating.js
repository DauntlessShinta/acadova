const mongoose = require('mongoose');

const RatingSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true, maxlength: 500 },
  isHidden: { type: Boolean, default: false, index: true },
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  moderatedAt: { type: Date, default: null },
}, { timestamps: true });

// One rating per rater per session (prevents duplicate/spam ratings).
RatingSchema.index({ session: 1, fromUser: 1 }, { unique: true });

module.exports = mongoose.model('Rating', RatingSchema);
