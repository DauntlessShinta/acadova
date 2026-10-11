const mongoose = require('mongoose');
const schema = new mongoose.Schema({ studySet: { type: mongoose.Schema.Types.ObjectId, ref: 'StudySet', required: true },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, reason: { type: String, required: true, maxlength: 500 },
  revision: { type: Number, required: true }, publicationId: String, cycle: { type: Number, default: 1 },
  state: { type: String, enum: ['open', 'closed'], default: 'open' },
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, closedAt: Date, closureReason: { type: String, maxlength: 500 },
}, { timestamps: true, autoIndex: process.env.NODE_ENV !== 'production' });
schema.index({ studySet: 1, reporter: 1 }, { unique: true, name: 'uniq_study_report_set_reporter' });
schema.index({ state: 1, updatedAt: 1 });
module.exports = mongoose.model('StudyReport', schema);
