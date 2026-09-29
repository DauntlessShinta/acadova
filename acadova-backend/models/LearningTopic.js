const mongoose = require('mongoose');

const LearningTopicSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  slug: { type: String, required: true, lowercase: true, trim: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  description: { type: String, required: true, trim: true, maxlength: 500 },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  publishedAt: Date,
  archivedAt: Date,
}, { timestamps: true, autoIndex: process.env.NODE_ENV !== 'production' });

LearningTopicSchema.index({ slug: 1 }, { unique: true, name: 'uniq_learning_topic_slug' });
LearningTopicSchema.index({ status: 1, name: 1 });

module.exports = mongoose.model('LearningTopic', LearningTopicSchema);
