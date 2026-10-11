const mongoose = require('mongoose');
const question = new mongoose.Schema({ prompt: { type: String, maxlength: 300, default: '' }, options: { type: [String], default: [] },
  correctIndex: { type: Number, default: null }, explanation: { type: String, maxlength: 1000, default: '' } }, { _id: false });
const schema = new mongoose.Schema({ owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, maxlength: 120, default: '' }, subject: { type: String, maxlength: 80, default: '' }, description: { type: String, maxlength: 1000, default: '' },
  questions: { type: [question], default: [] }, revision: { type: Number, default: 1, min: 1 }, version: { type: Number, default: 1, min: 1 },
  state: { type: String, enum: ['private', 'pending', 'published', 'rejected', 'removed'], default: 'private' },
  approvedRevision: Number, publicationId: String, submittedAt: Date, publishedAt: Date,
  decision: { type: new mongoose.Schema({ actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, reason: { type: String, maxlength: 500 }, at: Date, outcome: String }, { _id: false }) },
  deletedAt: { type: Date, default: null }, attemptGuard: { type: Number, default: 0 },
}, { timestamps: true, autoIndex: process.env.NODE_ENV !== 'production' });
schema.index({ owner: 1, deletedAt: 1, updatedAt: -1 });
schema.index({ state: 1, deletedAt: 1, publishedAt: -1 });
module.exports = mongoose.model('StudySet', schema);
