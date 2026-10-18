const { model, id, text, order } = require('../utils/academicSchema');
module.exports = model('ExaminationPeriod', { subjectId: id('PersonalSubject'), label: text(80), order }, [[{ owner: 1, subjectId: 1, order: 1 }]]);
