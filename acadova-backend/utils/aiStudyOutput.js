const { aiError } = require('../config/aiStudy');
function keys(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw aiError('Gemini returned an invalid study format. Nothing was saved.', 502, 'AI_STUDY_BAD_OUTPUT');
}
function text(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw aiError('Gemini returned incomplete or excessive study content. Nothing was saved.', 502, 'AI_STUDY_BAD_OUTPUT');
  return value.trim();
}
function validateOutput(raw, type, source, config) {
  if (!['flashcards', 'quiz', 'both'].includes(type)) throw aiError('Choose flashcards, quiz, or both.');
  let value;
  try { value = typeof raw === 'string' && Buffer.byteLength(raw) <= 60000 ? JSON.parse(raw) : raw; }
  catch { throw aiError('Gemini returned invalid JSON. Nothing was saved.', 502, 'AI_STUDY_BAD_OUTPUT'); }
  keys(value, ['title', 'flashcards', 'questions']);
  const reference = ref => {
    // A missing reference is explicit; never invent a page outside the source.
    if (ref === null) return null;
    if (!Number.isSafeInteger(ref) || ref < 1 || ref > source.units) throw aiError('Gemini returned an invalid source reference.', 502, 'AI_STUDY_BAD_OUTPUT');
    return ref;
  };
  const array = (items, maximum, needed) => {
    if (!Array.isArray(items) || items.length > maximum || (needed ? items.length < 1 : items.length !== 0)) throw aiError('Gemini returned incomplete study content. Nothing was saved.', 502, 'AI_STUDY_BAD_OUTPUT');
    return items;
  };
  return { title: text(value.title, 120),
    flashcards: array(value.flashcards, config.maxCards, type !== 'quiz').map(card => {
      keys(card, ['front', 'back', 'sourceRef']); return { front: text(card.front, 300), back: text(card.back, 1000), sourceRef: reference(card.sourceRef) };
    }),
    questions: array(value.questions, config.maxQuestions, type !== 'flashcards').map(q => {
      keys(q, ['prompt', 'options', 'correctIndex', 'explanation', 'sourceRef']);
      if (!Array.isArray(q.options) || q.options.length !== 4 || !Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) throw aiError('Each AI quiz question needs four options and one correct answer.', 502, 'AI_STUDY_BAD_OUTPUT');
      const options = q.options.map(option => text(option, 300));
      if (new Set(options.map(option => option.normalize('NFKC').toLowerCase())).size !== 4) throw aiError('AI quiz options must be distinct.', 502, 'AI_STUDY_BAD_OUTPUT');
      return { prompt: text(q.prompt, 300), options, correctIndex: q.correctIndex, explanation: text(q.explanation, 1000), sourceRef: reference(q.sourceRef) };
    }) };
}
const string = maxLength => ({ type: 'string', minLength: 1, maxLength });
const reference = { type: ['integer', 'null'] };
const outputSchema = {
  type: 'object', additionalProperties: false, required: ['title', 'flashcards', 'questions'], properties: {
    title: string(120), flashcards: { type: 'array', maxItems: 10, items: { type: 'object', additionalProperties: false, required: ['front', 'back', 'sourceRef'], properties: { front: string(300), back: string(1000), sourceRef: reference } } },
    questions: { type: 'array', maxItems: 5, items: { type: 'object', additionalProperties: false, required: ['prompt', 'options', 'correctIndex', 'explanation', 'sourceRef'], properties: { prompt: string(300), options: { type: 'array', minItems: 4, maxItems: 4, items: string(300) }, correctIndex: { type: 'integer', minimum: 0, maximum: 3 }, explanation: string(1000), sourceRef: reference } } },
  },
};
module.exports = { validateOutput, outputSchema };
