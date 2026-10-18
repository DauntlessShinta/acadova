const mongoose = require('mongoose');
const schema = new mongoose.Schema({ _id: String, owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Internal-only validated data. Strict-source extracted spans are private and
  // TTL bounded, selected only during save revalidation; binaries are never kept.
  strictSource: { type: mongoose.Schema.Types.Mixed, select: false },
  data: { type: mongoose.Schema.Types.Mixed, required: true }, expiresAt: { type: Date, required: true },
}, { autoIndex: process.env.NODE_ENV !== 'production' });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('AiStudyPreview', schema);
