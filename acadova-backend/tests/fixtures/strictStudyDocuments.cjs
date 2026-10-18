const { cloze } = require('../../utils/strictStudyOutput');
const { sourceId } = require('../../services/strictStudySource');
const { pdf, pptx } = require('./aiStudyDocuments.cjs');
const passages = [
  'Binary search requires sorted input to repeatedly halve the search space.',
  'Linear search checks every entry in the input sequence in order.',
  'Hash lookup uses a key to locate the associated stored value.',
  'Tree traversal visits connected nodes in a defined exploration order.',
];
function source(format = 'pptx') {
  const buffer = format === 'pptx' ? pptx(passages) : Buffer.from(pdf(passages.join(' ')).toString().replace('/F1 12 Tf', '/F1  3 Tf'));
  return { sourceId: sourceId(buffer), format, units: format === 'pptx' ? 4 : 1,
    segments: format === 'pptx' ? passages.map((text, i) => ({ number: i + 1, text })) : [{ number: 1, text: passages.join(' ') }], buffer };
}
function output(doc = source()) {
  const options = ['Binary search', 'Linear search', 'Hash lookup', 'Tree traversal'];
  const proof = index => ({ sourceId: doc.sourceId, sourceRef: doc.format === 'pptx' ? index + 1 : 1, sourceQuote: passages[index] });
  return { title: 'Synthetic source-exact practice',
    flashcards: [{ front: cloze(passages[0], 'Binary search'), back: 'Binary search', ...proof(0) }],
    questions: [{ prompt: cloze(passages[0], options[0]), options, correctIndex: 0, explanation: passages[0], ...proof(0), optionEvidence: options.map((_, index) => proof(index)) }],
  };
}
module.exports = { passages, source, output };
