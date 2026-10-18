const mongoose = require('mongoose');
// Private coordination record. No balance, credits, totals or currency operations.
const schema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  revision: { type: Number, default: 0, min: 0 },
}, { autoIndex: false, autoCreate: false, versionKey: false, strict: 'throw' });
module.exports = mongoose.model('ExpAccountLock', schema);
