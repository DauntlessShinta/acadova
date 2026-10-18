const { model, mongoose, id, text, order } = require('../utils/academicSchema');
module.exports = model('PersonalModule', {
  subjectId: id('PersonalSubject'), periodId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExaminationPeriod', default: null },
  title: text(120), order, status: { type: String, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started' }, lastReviewedAt: Date,
}, [[{ owner: 1, subjectId: 1, order: 1 }], [{ owner: 1, periodId: 1, order: 1 }]]);
