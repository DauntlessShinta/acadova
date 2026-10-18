const mongoose = require('mongoose');
const request = new mongoose.Schema({ key: String, fingerprint: String, previewId: String,
  stage: { type: String, enum: ['extracting', 'preparing', 'generating', 'validating', 'ready'] },
  state: { type: String, enum: ['pending', 'complete', 'failed', 'saved'] }, savedSetId: mongoose.Schema.Types.ObjectId }, { _id: false });
const schema = new mongoose.Schema({
  // MongoDB's built-in unique _id provides the per-Student serialization boundary.
  _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, day: String, used: { type: Number, default: 0 },
  activeUntil: { type: Date, default: new Date(0) }, activeKey: String,
  requests: { type: [request], default: [], validate: value => value.length <= 3 }, guard: { type: Number, default: 0 },
}, { timestamps: true, autoIndex: process.env.NODE_ENV !== 'production' });
module.exports = mongoose.model('AiStudyQuota', schema);
