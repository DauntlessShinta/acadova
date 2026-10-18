const mongoose = require('mongoose');
const schema = new mongoose.Schema({ owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, enabled: { type: Boolean, default: false },
  expertise: { type: String, maxlength: 300, default: '' }, interests: { type: String, maxlength: 300, default: '' },
}, { timestamps: true, autoIndex: process.env.NODE_ENV !== 'production' });
schema.index({ owner: 1 }, { unique: true });
module.exports = mongoose.model('VolunteerHost', schema);
