const { aiError } = require('../config/aiStudy');
// Only whitespace is normalized for evidence/answer matching. No case folding,
// punctuation removal, Unicode normalization or semantic similarity is used there.
const whitespace = value => value.replace(/\s+/gu, ' ').trim();
const invalid = reason => { throw aiError(reason, 502, 'AI_STUDY_BAD_OUTPUT'); };
const text = (value, max) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) invalid('Invalid or excessive strict-source text.');
  return whitespace(value);
};
function shape(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key)) || fields.some(key => !Object.hasOwn(value, key))) invalid('Malformed strict-source output.');
}
function parseStrict(raw) {
  let value = raw;
  if (typeof raw === 'string') { if (Buffer.byteLength(raw) > 60000) invalid('Strict-source response exceeds the output limit.'); try { value = JSON.parse(raw); } catch { invalid('Malformed strict-source JSON.'); } }
  shape(value, ['title', 'flashcards', 'questions']);
  return value;
}
function occurrences(haystack, needle) { let count = 0; let index = -1; while ((index = haystack.indexOf(needle, index + 1)) !== -1) count++; return count; }
function wordSpan(quote, answer) {
  const index = quote.indexOf(answer); const word = value => /[\p{L}\p{N}_]/u.test(value || '');
  return index >= 0 && occurrences(quote, answer) === 1 && !(word(answer[0]) && word(quote[index - 1])) && !(word(answer.at(-1)) && word(quote[index + answer.length]));
}
function cloze(quote, answer) { return `Complete the source quotation: ${whitespace(quote).replace(whitespace(answer), '____')}`; }
function boundedSource(source) {
  if (!/^[a-f0-9]{64}$/.test(source?.sourceId || '') || !['pdf', 'pptx'].includes(source.format) || !Number.isSafeInteger(source.units) || source.units < 1 || source.units > 60 || !Array.isArray(source.segments) || source.segments.length !== source.units) invalid('Missing or mismatched extracted source identity.');
  let chars = 0;
  for (let i = 0; i < source.segments.length; i++) {
    const segment = source.segments[i]; if (segment.number !== i + 1 || typeof segment.text !== 'string') invalid('Invalid page/slide sequence.'); chars += segment.text.length;
  }
  if (chars < 30 || chars > 60000) invalid('Insufficient or excessive extracted source.');
}
function evidence(item, source) {
  if (item.sourceId !== source.sourceId) invalid('Source identity does not match this document.');
  if (!Number.isSafeInteger(item.sourceRef) || item.sourceRef < 1 || item.sourceRef > source.units) invalid('Missing or invalid source page/slide.');
  const quote = text(item.sourceQuote, 240); if (quote.length < 20) invalid('Evidence is too short to support a meaningful quotation.');
  if (occurrences(whitespace(source.segments[item.sourceRef - 1].text), quote) !== 1) invalid('Quote is absent or ambiguous on the cited page/slide.');
  return { sourceId: source.sourceId, sourceRef: item.sourceRef, sourceQuote: quote };
}
// Near-duplicate detection is conservative and separate from exact source matching.
const duplicateKey = value => whitespace(value).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '');
function similar(a, b) {
  const x = duplicateKey(a); const y = duplicateKey(b); if (x === y || x.includes(y) || y.includes(x)) return true;
  const left = new Set(x.split(' ')); const right = new Set(y.split(' '));
  const common = [...left].filter(token => right.has(token)).length; return common / new Set([...left, ...right]).size >= 0.85;
}
function validateStrictOutput(raw, type, source, config, { requireAll = false } = {}) {
  if (!['flashcards', 'quiz', 'both'].includes(type)) invalid('Choose a supported generation format.');
  boundedSource(source); const value = parseStrict(raw); const reasons = []; const seen = { flashcards: [], questions: [] };
  const result = { title: text(value.title, 120), flashcards: [], questions: [] };
  for (const kind of ['flashcards', 'questions']) {
    const maximum = kind === 'flashcards' ? config.maxCards : config.maxQuestions;
    const needed = kind === 'flashcards' ? type !== 'quiz' : type !== 'flashcards';
    if (!Array.isArray(value[kind]) || value[kind].length > maximum || !needed && value[kind].length) invalid('Invalid strict-source item count or generation type.');
    for (let index = 0; index < value[kind].length; index++) {
      try {
        const item = value[kind][index]; const card = kind === 'flashcards';
        shape(item, card ? ['front', 'back', 'sourceId', 'sourceRef', 'sourceQuote'] : ['prompt', 'options', 'correctIndex', 'explanation', 'sourceId', 'sourceRef', 'sourceQuote', 'optionEvidence']);
        const proof = evidence(item, source); const quote = proof.sourceQuote;
        if (!card && (!Array.isArray(item.options) || item.options.length !== 4 || !Number.isSafeInteger(item.correctIndex) || item.correctIndex < 0 || item.correctIndex > 3)) invalid('Four choices and a valid answer key are required.');
        const answer = text(card ? item.back : item.options[item.correctIndex], 300);
        if (answer.length < 3 || !/[\p{L}\p{N}]/u.test(answer) || !wordSpan(quote, answer) || answer === quote || quote.includes('____')) invalid('Answer must be a single distinct source-exact span inside the quote.');
        const prompt = text(card ? item.front : item.prompt, 300);
        if (prompt !== cloze(quote, answer)) invalid('Only the supported quotation-completion template can be labeled Strict Source.');
        if (seen[kind].some(previous => similar(previous, quote))) invalid('Duplicate or near-duplicate source question.');
        let verified;
        if (card) verified = { front: prompt, back: answer, ...proof };
        else {
          const options = item.options.map(option => text(option, 300));
          if (options.some((option, i) => options.some((other, j) => i !== j && similar(option, other)))) invalid('Answer choices are duplicate, overlapping or near-duplicate.');
          if (!Array.isArray(item.optionEvidence) || item.optionEvidence.length !== 4) invalid('Every choice needs its own source evidence.');
          const optionEvidence = item.optionEvidence.map((entry, i) => {
            shape(entry, ['sourceId', 'sourceRef', 'sourceQuote']); const supporting = evidence(entry, source);
            if (!wordSpan(supporting.sourceQuote, options[i])) invalid('Choice is not copied from its cited evidence.');
            if (i !== item.correctIndex && quote.includes(options[i])) invalid('Distractor also occurs in the answer quote; support is ambiguous.');
            return supporting;
          });
          const explanation = text(item.explanation, 1000); if (explanation !== quote) invalid('Explanation must repeat the exact source evidence.');
          verified = { prompt, options, correctIndex: item.correctIndex, explanation, ...proof, optionEvidence };
        }
        seen[kind].push(quote); result[kind].push(verified);
      } catch (error) { if (error.code !== 'AI_STUDY_BAD_OUTPUT') throw error; reasons.push(`${kind} ${index + 1}: ${error.message}`); }
    }
  }
  if (requireAll && reasons.length) throw aiError('Your edits no longer match the strict-source evidence. Restore exact source wording or discard the item.', 400, 'AI_STUDY_EDIT_UNSUPPORTED');
  const missing = [];
  if (type !== 'quiz' && result.flashcards.length < config.maxCards) missing.push(`${result.flashcards.length}/${config.maxCards} source-supported flashcards`);
  if (type !== 'flashcards' && result.questions.length < config.maxQuestions) missing.push(`${result.questions.length}/${config.maxQuestions} source-supported questions`);
  const validation = { version: 'exact_cloze_v1', reasons, coverage: missing.join('; '), note: 'Exact extracted-text matches for quotation completion. This does not establish conceptual mastery or general semantic correctness.' };
  if (!result.flashcards.length && !result.questions.length) {
    const error = aiError('Insufficient source-supported items. No study content was saved. Use a clearer text-based document or fewer items.', 422, 'AI_STUDY_INSUFFICIENT_SOURCE'); error.details = validation; throw error;
  }
  return { ...result, validation };
}
const string = maxLength => ({ type: 'string', minLength: 1, maxLength });
const proofFields = { sourceId: string(64), sourceRef: { type: 'integer', minimum: 1, maximum: 60 }, sourceQuote: string(240) };
const proofSchema = { type: 'object', additionalProperties: false, required: Object.keys(proofFields), properties: proofFields };
const object = properties => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const strictOutputSchema = object({ title: string(120),
  flashcards: { type: 'array', maxItems: 10, items: object({ front: string(300), back: string(300), ...proofFields }) },
  questions: { type: 'array', maxItems: 5, items: object({ prompt: string(300), options: { type: 'array', minItems: 4, maxItems: 4, items: string(300) }, correctIndex: { type: 'integer', minimum: 0, maximum: 3 }, explanation: string(240), ...proofFields, optionEvidence: { type: 'array', minItems: 4, maxItems: 4, items: proofSchema } }) },
});
module.exports = { whitespace, cloze, parseStrict, validateStrictOutput, strictOutputSchema, boundedSource };
