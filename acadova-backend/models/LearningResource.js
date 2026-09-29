const mongoose = require('mongoose');

const LearningResourceSchema = new mongoose.Schema({
  topic: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningTopic', required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 500 },
  resourceType: { type: String, enum: ['text', 'url'], required: true },
  textContent: { type: String, maxlength: 10000 },
  externalUrl: { type: String, maxlength: 1000 },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reviewStatus: { type: String, enum: ['submitted', 'published', 'rejected', 'archived'], default: 'submitted' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewNote: { type: String, maxlength: 300 },
  publishedAt: Date,
  creditCost: { type: Number, default: 0, min: 0, max: 1000,
    validate: { validator: Number.isSafeInteger, message: 'Credit cost must be a whole number' } },
}, { timestamps: true, autoIndex: process.env.NODE_ENV !== 'production' });

LearningResourceSchema.pre('validate', function validateContent() {
  if (this.resourceType === 'text' && (!this.textContent?.trim() || this.externalUrl)) {
    this.invalidate('textContent', 'Text resources require text only');
  }
  if (this.resourceType === 'url') {
    let valid = false;
    try { const url = new URL(this.externalUrl); valid = url.protocol === 'https:' && Boolean(url.hostname)
      && !url.username && !url.password && !this.textContent; } catch { /* Invalid URL. */ }
    if (!valid) this.invalidate('externalUrl', 'URL resources require a safe HTTPS link only');
  }
});
LearningResourceSchema.index({ topic: 1, reviewStatus: 1, createdAt: -1 });

module.exports = mongoose.model('LearningResource', LearningResourceSchema);
