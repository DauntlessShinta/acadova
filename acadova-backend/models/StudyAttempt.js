const mongoose = require('mongoose');
const schema = new mongoose.Schema({ student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studySet: { type: mongoose.Schema.Types.ObjectId, ref: 'StudySet', required: true }, revision: { type: Number, required: true },
  access: { type: String, enum: ['owner', 'public'], required: true }, publicationId: String,
  snapshot: { type: new mongoose.Schema({ title: String, subject: String, description: String, questions: [new mongoose.Schema({ prompt: String, options: [String], correctIndex: Number, explanation: String }, { _id: false })] }, { _id: false }), required: true },
  answers: { type: [Number], default: undefined }, score: Number, correct: Number, total: Number,
  startedAt: { type: Date, default: Date.now }, submittedAt: Date,
}, { autoIndex: process.env.NODE_ENV !== 'production' });
schema.index({ student: 1, startedAt: -1 });
module.exports = mongoose.model('StudyAttempt', schema);
