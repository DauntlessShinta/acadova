const mongoose = require('mongoose');
const id = ref => ({ type: mongoose.Schema.Types.ObjectId, ref, required: true });
const text = max => ({ type: String, trim: true, maxlength: max, required: true });
const order = { type: Number, default: 0, min: 0, max: 10000, validate: Number.isSafeInteger };
function model(name, fields, indexes) {
  const schema = new mongoose.Schema({ owner: id('User'), ...fields }, { timestamps: true, autoIndex: process.env.NODE_ENV !== 'production' });
  for (const [keys, options] of indexes) schema.index(keys, options || {});
  return mongoose.model(name, schema);
}
module.exports = { mongoose, id, text, order, model };
