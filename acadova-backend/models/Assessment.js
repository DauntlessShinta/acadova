const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  prompt: { type: String, required: true, trim: true, maxlength: 300 },
  options: { type: [String], validate: { validator: (items) => items.length >= 2 && items.length <= 5 } },
  correctIndex: { type: Number, required: true, min: 0 },
}, { _id: false });
QuestionSchema.path('correctIndex').validate(function validAnswer(index) {
  return Number.isInteger(index) && index < this.options.length;
});

const AssessmentSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  topic: { type: String, required: true, trim: true, maxlength: 80 },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  passingScore: { type: Number, required: true, min: 1, max: 100 },
  questions: { type: [QuestionSchema], validate: { validator: (items) => items.length >= 3 && items.length <= 10 } },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  publishedAt: { type: Date },
}, { timestamps: true, autoIndex: process.env.NODE_ENV !== 'production' });

module.exports = mongoose.model('Assessment', AssessmentSchema);
