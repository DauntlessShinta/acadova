const mongoose = require('mongoose');
const id = mongoose.Schema.Types.ObjectId;
const schema = new mongoose.Schema({
  kind: { type: String, enum: ['free_study_circle'], default: 'free_study_circle', immutable: true },
  host: { type: id, ref: 'User', required: true },
  subjectId: { type: id, ref: 'PersonalSubject', default: null, select: false },
  title: { type: String, required: true, maxlength: 120 }, description: { type: String, maxlength: 600, default: '' },
  tags: { type: [String], default: [], validate: v => v.length <= 5 },
  startsAt: { type: Date, required: true }, endsAt: { type: Date, required: true }, timezone: { type: String, required: true },
  capacity: { type: Number, default: 12, min: 1, max: 50 },
  meetingUrl: { type: String, required: true, maxlength: 500, select: false },
  participants: { type: [{ type: id, ref: 'User' }], default: [], select: false, validate: v => v.length <= 50 && new Set(v.map(String)).size === v.length },
  status: { type: String, enum: ['scheduled', 'cancelled', 'completed'], default: 'scheduled' },
  version: { type: Number, default: 1 },
  reports: { type: [new mongoose.Schema({ reporter: { type: id, ref: 'User' }, reason: { type: String, maxlength: 500 }, at: Date, open: Boolean }, { _id: false })], default: [], select: false, validate: v => v.length <= 100 },
}, { timestamps: true, autoIndex: process.env.NODE_ENV !== 'production' });
schema.index({ status: 1, startsAt: 1 }); schema.index({ host: 1, startsAt: -1 }); schema.index({ participants: 1, startsAt: -1 });
module.exports = mongoose.model('StudyCircle', schema);
