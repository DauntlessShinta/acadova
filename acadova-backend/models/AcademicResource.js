const { model, mongoose, id, text } = require('../utils/academicSchema');
module.exports = model('AcademicResource', {
  subjectId: id('PersonalSubject'), moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'PersonalModule', default: null },
  title: text(120), kind: { type: String, required: true, enum: ['pdf', 'pptx', 'google_form_link', 'google_drive_link', 'external_link', 'note'] },
  url: { type: String, maxlength: 1000 }, note: { type: String, maxlength: 10000 }, visibility: { type: String, enum: ['private'], default: 'private' },
  fileName: { type: String, maxlength: 160 }, bytes: { type: Number, default: 0 },
  // Private, bounded source storage. Never selected by metadata APIs or served statically.
  content: { type: Buffer, select: false },
}, [[{ owner: 1, subjectId: 1, moduleId: 1 }]]);
