const { createHash } = require('node:crypto');
const Resource = require('../models/AcademicResource');
const { aiError } = require('../config/aiStudy');
const sourceId = buffer => createHash('sha256').update(buffer).digest('hex');
async function resourceFile(owner, id, expected, session = null) {
  const resource = await Resource.findOne({ _id: id, owner, kind: { $in: ['pdf', 'pptx'] } }).select('+content').session(session);
  if (!resource?.content?.length) throw aiError('Private PDF/PPTX source not found.', 404, 'AI_STUDY_SOURCE_NOT_FOUND');
  const buffer = Buffer.from(resource.content); const identity = sourceId(buffer);
  if (expected && expected !== identity) { buffer.fill(0); throw aiError('Source document changed. Select the source again before generating or saving.', 409, 'AI_STUDY_STALE_SOURCE'); }
  return { resource, file: { buffer, originalname: resource.fileName }, identity };
}
const sourceMetadata = (resource, identity) => ({ resourceId: String(resource._id), sourceId: identity, subjectId: String(resource.subjectId), moduleId: resource.moduleId ? String(resource.moduleId) : null, name: resource.fileName, format: resource.kind, bytes: resource.bytes });
module.exports = { sourceId, resourceFile, sourceMetadata };
