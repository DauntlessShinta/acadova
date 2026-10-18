const test = require('node:test'); const assert = require('node:assert/strict');
const { validateStrictOutput, cloze, whitespace } = require('../utils/strictStudyOutput');
const { extractDocument } = require('../services/aiDocumentService');
const { createGeminiStudyService } = require('../services/geminiStudyService');
const { aiStudyConfig } = require('../config/aiStudy');
const { passages, source, output } = require('./fixtures/strictStudyDocuments.cjs');
const { pdf } = require('./fixtures/aiStudyDocuments.cjs');
const config = aiStudyConfig({ NODE_ENV: 'test', AI_STUDY_ENABLED: 'true', AI_STUDY_LOCAL_QA: 'true', GEMINI_API_KEY: 'mock-only' });
const copy = value => JSON.parse(JSON.stringify(value));
test('PDF pages and PPTX slides carry stable raw-document identities and extracted text', async () => {
  for (const format of ['pdf', 'pptx']) {
    const fixture = source(format); const doc = await extractDocument({ buffer: fixture.buffer, originalname: 'synthetic.' + format }, config);
    assert.equal(doc.sourceId, fixture.sourceId); assert.equal(doc.segments.length, fixture.units);
    assert.ok(whitespace(doc.segments[0].text).includes(passages[0]));
    const result = validateStrictOutput(output(doc), 'both', doc, config);
    assert.equal(result.questions[0].sourceId, fixture.sourceId); assert.equal(result.flashcards[0].back, 'Binary search');
  }
});
test('correct quotes, literal answers, whitespace-only matching and explicit fewer-item coverage', () => {
  const doc = source(); doc.segments[0].text = passages[0].replaceAll(' ', '\n  ');
  const result = validateStrictOutput(output(doc), 'both', doc, config);
  assert.equal(result.questions.length, 1); assert.match(result.validation.coverage, /1\/5/); assert.equal(result.validation.version, 'exact_cloze_v1');
  assert.match(result.validation.note, /does not establish/);
});
test('wrong page, invented page/identity, subtle paraphrase, fabricated definitions and answer-key changes are refused', () => {
  const changes = [
    q => { q.sourceRef = 2; }, q => { q.sourceRef = 99; }, q => { q.sourceRef = null; }, q => { q.sourceId = 'a'.repeat(64); },
    q => { q.sourceQuote = q.sourceQuote.replace('requires', 'needs'); }, q => { q.explanation = 'A fabricated explanation.'; },
    q => { q.correctIndex = 1; }, q => { q.options[0] = 'binary search'; }, q => { q.prompt = 'Which algorithm is fastest?'; },
    q => { q.options[2] = 'Quantum search'; }, q => { q.optionEvidence[1].sourceRef = 4; }, q => { delete q.sourceQuote; },
  ];
  for (const change of changes) { const value = output(); change(value.questions[0]); value.flashcards = [];
    assert.throws(() => validateStrictOutput(value, 'quiz', source(), config), { code: 'AI_STUDY_INSUFFICIENT_SOURCE' }); }
  const value = output(); value.flashcards[0].back = 'Binary searching'; value.questions = [];
  assert.throws(() => validateStrictOutput(value, 'flashcards', source(), config), { code: 'AI_STUDY_INSUFFICIENT_SOURCE' });
});
test('unsupported and duplicate items are omitted; malformed root/arrays never silently pass', () => {
  const value = output(); value.questions.push(copy(value.questions[0])); value.questions.push({ ...copy(value.questions[0]), sourceQuote: 'This quote is fabricated.' });
  const result = validateStrictOutput(value, 'both', source(), config); assert.equal(result.questions.length, 1); assert.equal(result.validation.reasons.length, 2);
  for (const raw of ['bad JSON', { ...output(), extra: true }, { ...output(), questions: {} }, { ...output(), questions: Array(6).fill(output().questions[0]) }]) assert.throws(() => validateStrictOutput(raw, 'both', source(), config), { code: 'AI_STUDY_BAD_OUTPUT' });
});
test('ambiguity, repeated evidence, unsupported distractors and near-duplicate choices are refused', () => {
  const doc = source(); doc.segments[0].text += ' ' + passages[0];
  assert.throws(() => validateStrictOutput(output(doc), 'both', doc, config), { code: 'AI_STUDY_INSUFFICIENT_SOURCE' });
  const value = output(); value.flashcards = []; value.questions[0].options[1] = 'sorted input'; value.questions[0].optionEvidence[1] = { ...value.questions[0].optionEvidence[0] };
  assert.throws(() => validateStrictOutput(value, 'quiz', source(), config), { code: 'AI_STUDY_INSUFFICIENT_SOURCE' });
  value.questions[0].options[1] = 'Binary Search'; assert.throws(() => validateStrictOutput(value, 'quiz', source(), config));
});
test('edited cards/questions are revalidated, never silently relabeled as source-matched', () => {
  const value = output(); value.flashcards[0].back = 'Outside knowledge';
  assert.throws(() => validateStrictOutput(value, 'both', source(), config, { requireAll: true }), { code: 'AI_STUDY_EDIT_UNSUPPORTED' });
  const valid = output(); valid.flashcards[0].back = 'sorted input'; valid.flashcards[0].front = cloze(passages[0], 'sorted input');
  assert.equal(validateStrictOutput(valid, 'both', source(), config, { requireAll: true }).flashcards[0].back, 'sorted input');
});
test('scanned/empty, text limits and worker timeout still fail helpfully', async () => {
  await assert.rejects(extractDocument({ buffer: pdf(''), originalname: 'scan.pdf' }, config), /insufficient extractable text/);
  await assert.rejects(extractDocument({ buffer: source('pdf').buffer, originalname: 'limited.pdf' }, { ...config, maxChars: 10 }), /too much/);
  await assert.rejects(extractDocument({ buffer: source('pdf').buffer, originalname: 'timeout.pdf' }, { ...config, parserTimeoutMs: 1 }), /timed out/);
});
test('strict Gemini contract uses extracted segments only, no PDF bytes, tools, fallback or relaxed provider gates', async () => {
  let request;
  const service = createGeminiStudyService({ clientFactory: () => ({ models: {
    countTokens: async () => ({ totalTokens: 300 }), generateContent: async value => { request = value; return { text: JSON.stringify(output(source('pdf'))), candidates: [{ finishReason: 'STOP' }] }; },
  } }) });
  await service.generate({ document: source('pdf'), type: 'both', mode: 'strict_source', config });
  assert.ok(request.contents[0].parts.every(part => !part.inlineData)); assert.match(request.contents[0].parts[1].text, /EXTRACTED SOURCE/); assert.match(request.config.systemInstruction, /quotation-completion/); assert.equal(request.config.tools, undefined);
  await assert.rejects(service.generate({ document: source(), type: 'both', mode: 'strict_source', config: { ...config, enabled: false } }), /disabled/);
});
