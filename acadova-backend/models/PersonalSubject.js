const { model, id, text, order } = require('../utils/academicSchema');
module.exports = model('PersonalSubject', {
  termId: id('AcademicTerm'), name: text(120), courseCode: { type: String, trim: true, maxlength: 40, default: '' },
  instructor: { type: String, trim: true, maxlength: 120, default: '' }, section: { type: String, trim: true, maxlength: 60, default: '' },
  order, archived: { type: Boolean, default: false },
}, [[{ owner: 1, termId: 1, order: 1 }]]);
