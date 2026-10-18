const { model, mongoose, id, text } = require('../utils/academicSchema');
module.exports = model('StudyPlanItem', {
  subjectId: id('PersonalSubject'), moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'PersonalModule', default: null },
  kind: { type: String, required: true, enum: ['exam', 'goal', 'task'] }, title: text(120), notes: { type: String, maxlength: 1000, default: '' },
  dueAt: { type: Date, default: null }, timezone: { type: String, maxlength: 80, required: true },
  completed: { type: Boolean, default: false }, completedAt: { type: Date, default: null }, version: { type: Number, min: 1, default: 1 },
}, [[{ owner: 1, subjectId: 1, dueAt: 1 }], [{ owner: 1, moduleId: 1 }]]);
