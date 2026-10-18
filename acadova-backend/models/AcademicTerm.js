const { model, text } = require('../utils/academicSchema');
module.exports = model('AcademicTerm', {
  startYear: { type: Number, required: true, min: 1900, max: 2200, validate: Number.isSafeInteger },
  endYear: { type: Number, required: true, validate: function (value) { return Number.isSafeInteger(value) && value === this.startYear + 1; } },
  semester: text(80),
}, [[{ owner: 1, startYear: 1, semester: 1 }, { unique: true }]]);
