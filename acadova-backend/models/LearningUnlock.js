const mongoose = require('mongoose');

const LearningUnlockSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  resource: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningResource' },
  module: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningModule' },
  pricePaid: { type: Number, required: true, min: 1,
    validate: { validator: Number.isSafeInteger, message: 'Price must be a positive whole number' } },
  unlockedAt: { type: Date, default: Date.now },
}, { timestamps: true, autoIndex: process.env.NODE_ENV !== 'production' });

LearningUnlockSchema.pre('validate', function validateTarget() {
  if (Boolean(this.resource) === Boolean(this.module)) {
    this.invalidate('resource', 'An unlock must identify exactly one resource or module');
  }
});

LearningUnlockSchema.index({ student: 1, resource: 1 }, {
  name: 'uniq_learning_unlock_student_resource', unique: true,
  partialFilterExpression: { resource: { $exists: true } },
});
LearningUnlockSchema.index({ student: 1, module: 1 }, {
  name: 'uniq_learning_unlock_student_module', unique: true,
  partialFilterExpression: { module: { $exists: true } },
});

module.exports = mongoose.model('LearningUnlock', LearningUnlockSchema);
