const mongoose = require('mongoose');

const LearningModuleSchema = new mongoose.Schema({
  topic: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningTopic', required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 500 },
  // Array order is the lesson order; references are checked at creation and publication.
  resources: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LearningResource' }],
    validate: { validator: (items) => items.length >= 1 && items.length <= 20 } },
  assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment' },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  publishedAt: Date,
  archivedAt: Date,
  creditCost: { type: Number, default: 0, min: 0, max: 1000,
    validate: { validator: Number.isSafeInteger, message: 'Credit cost must be a whole number' } },
}, { timestamps: true, autoIndex: process.env.NODE_ENV !== 'production' });

LearningModuleSchema.index({ topic: 1, status: 1, createdAt: -1 });
module.exports = mongoose.model('LearningModule', LearningModuleSchema);
