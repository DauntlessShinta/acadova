const mongoose = require('mongoose');
const proofFields = { sourceId: { type: String, maxlength: 64, immutable: true }, sourceQuote: { type: String, maxlength: 240, immutable: true } };
const optionProof = new mongoose.Schema({ ...proofFields, sourceRef: Number }, { _id: false });
const question = new mongoose.Schema({ prompt: { type: String, maxlength: 300, default: '' }, options: { type: [String], default: [] },
  correctIndex: { type: Number, default: null }, explanation: { type: String, maxlength: 1000, default: '' }, sourceRef: Number, ...proofFields, optionEvidence: { type: [optionProof], default: undefined } }, { _id: false });
const schema = new mongoose.Schema({ owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'PersonalSubject', default: null },
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'PersonalModule', default: null },
  sourceResourceIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AcademicResource' }], default: [] },
  title: { type: String, maxlength: 120, default: '' }, subject: { type: String, maxlength: 80, default: '' }, description: { type: String, maxlength: 1000, default: '' },
  questions: { type: [question], default: [] }, revision: { type: Number, default: 1, min: 1 }, version: { type: Number, default: 1, min: 1 },
  state: { type: String, enum: ['private', 'pending', 'published', 'rejected', 'removed'], default: 'private' },
  unlistedRemoved: { type: Boolean, default: false },
  unlistedActive: { type: Boolean, default: false }, unlistedHash: { type: String, select: false, maxlength: 64 },
  approvedRevision: Number, publicationId: String, submittedAt: Date, publishedAt: Date,
  decision: { type: new mongoose.Schema({ actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, reason: { type: String, maxlength: 500 }, at: Date, outcome: String }, { _id: false }) },
  archivedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null }, attemptGuard: { type: Number, default: 0 },
  origin: { type: String, enum: ['manual', 'ai'], default: 'manual', immutable: true },
  flashcards: { type: [new mongoose.Schema({ front: { type: String, maxlength: 300 }, back: { type: String, maxlength: 1000 }, sourceRef: Number, ...proofFields }, { _id: false })], default: [], validate: value => value.length <= 10 },
  ai: { type: new mongoose.Schema({ generationType: { type: String, enum: ['flashcards', 'quiz', 'both'] }, sourceName: { type: String, maxlength: 160 },
    generationMode: { type: String, enum: ['standard', 'strict_source'], immutable: true },
    sourceId: { type: String, maxlength: 64, immutable: true }, sourceResourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicResource', immutable: true },
    validationVersion: { type: String, maxlength: 40, immutable: true }, validationNote: { type: String, maxlength: 500, immutable: true },
    coverage: { type: String, maxlength: 300 }, rejectionReasons: { type: [String], default: undefined }, requestedCards: Number, requestedQuestions: Number,
    sourceFormat: { type: String, enum: ['pdf', 'pptx'] }, sourceUnits: Number, sourceBytes: Number,
    recipeKey: { type: String, maxlength: 64, immutable: true }, regeneratedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'StudySet', immutable: true }, parentVersion: Number,
    model: { type: String, maxlength: 120 }, modelVersion: { type: String, maxlength: 120 }, limitation: { type: String, maxlength: 500 }, }, { _id: false }) },
  practiceHistory: { type: [new mongoose.Schema({ at: Date, correct: Number, total: Number, score: Number }, { _id: false })], default: [], validate: value => value.length <= 20 },
}, { timestamps: true, autoIndex: process.env.NODE_ENV !== 'production' });
schema.index({ owner: 1, deletedAt: 1, updatedAt: -1 });
schema.index({ owner: 1, subjectId: 1, moduleId: 1, deletedAt: 1 });
schema.index({ state: 1, deletedAt: 1, publishedAt: -1 });
module.exports = mongoose.model('StudySet', schema);
