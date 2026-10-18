const mongoose = require('mongoose');

// Completion is module-scoped: studying a shared resource in another module is a separate requirement.
const schema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  module: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningModule', required: true },
  resource: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningResource', required: true },
  completedAt: { type: Date, required: true, default: Date.now, immutable: true },
}, { autoIndex: process.env.NODE_ENV !== 'production' });
schema.index({ student: 1, module: 1, resource: 1 }, { unique: true, name: 'uniq_student_module_lesson' });
module.exports = mongoose.model('LessonCompletion', schema);
