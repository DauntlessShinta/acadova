// Parsing runs off the HTTP event loop with a memory limit and hard termination deadline.
const { parentPort, workerData } = require('node:worker_threads');
const yauzl = require('yauzl');
const { XMLParser, XMLValidator } = require('fast-xml-parser');
const { crc32 } = require('node:zlib');
const { aiError } = require('../config/aiStudy');
const config = workerData.config;
const buffer = Buffer.from(workerData.buffer);
const invalid = message => { throw aiError(message); };
async function pdf() {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, stopAtErrors: true, verbosity: 0 });
  let doc;
  try {
    doc = await task.promise;
    if (!doc.numPages || doc.numPages > config.maxPages) invalid(`Use a PDF with 1–${config.maxPages} pages.`);
    let chars = 0; const segments = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map(item => (item.str || '') + (item.hasEOL ? '\n' : ' ')).join('').trim();
      chars += text.length; segments.push({ number: pageNumber, text });
      if (chars > config.maxChars) invalid('The PDF contains too much text. Upload a shorter document.');
      page.cleanup();
    }
    if (chars < 30) invalid('This PDF has insufficient extractable text. Use a text-based learning PDF; scanned-only PDFs are not supported in this MVP.');
    return { format: 'pdf', units: doc.numPages, chars, segments, limitation: 'Strict Source uses extracted page text only. Images, diagrams and scans are not interpreted; standard mode may interpret PDF pages.' };
  } catch (error) {
    if (error.status) throw error;
    invalid(error.name === 'PasswordException' ? 'Encrypted PDFs are not supported. Upload an unencrypted synthetic PDF.' : 'The PDF is corrupted or cannot be read. Export a new PDF and try again.');
  } finally { await task.destroy(); }
}
function xml(value) {
  if (!value || /<!DOCTYPE|<!ENTITY/i.test(value) || XMLValidator.validate(value) !== true) invalid('The PowerPoint contains invalid or unsafe XML.');
  return new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: false, processEntities: true }).parse(value);
}
const list = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
async function pptx() {
  const files = await new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
      if (error) return reject(aiError('The PPTX is corrupted or encrypted. Export a new presentation.'));
      const selected = new Map(); const names = new Set(); let total = 0; let count = 0; let finished = false;
      const fail = message => { if (finished) return; finished = true; zip.close(); reject(aiError(message)); };
      zip.on('error', () => fail('The PPTX archive is corrupted.'));
      zip.on('end', () => { if (!finished) { finished = true; resolve(selected); } });
      zip.on('entry', entry => {
        total += entry.uncompressedSize; count++;
        if (count > 500 || total > 20 * 1024 * 1024 || entry.uncompressedSize > 5 * 1024 * 1024
          || entry.uncompressedSize / Math.max(1, entry.compressedSize) > 100 || (entry.generalPurposeBitFlag & 1)
          || names.has(entry.fileName) || /(^|\/)\.\.?(\/|$)|^\/|\\/.test(entry.fileName)
          || /vbaProject|embeddings\//i.test(entry.fileName)) return fail('The PPTX is encrypted, unsafe, or exceeds archive processing limits.');
        names.add(entry.fileName);
        if (!(/^(\[Content_Types\]\.xml|ppt\/presentation\.xml|ppt\/_rels\/presentation\.xml\.rels|ppt\/slides\/slide\d+\.xml)$/.test(entry.fileName))) { zip.readEntry(); return; }
        if (entry.uncompressedSize > 512 * 1024) return fail('A PowerPoint slide exceeds the text processing limit.');
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError) return fail('The PPTX could not be read.');
          const chunks = []; let size = 0;
          stream.on('data', chunk => { size += chunk.length; if (size > 512 * 1024) { stream.destroy(); fail('A PowerPoint slide exceeds the processing limit.'); } else chunks.push(chunk); });
          stream.on('error', () => fail('The PPTX contains a damaged slide.'));
          stream.on('end', () => { if (!finished) { const data = Buffer.concat(chunks); if (crc32(data) !== entry.crc32) return fail('The PPTX contains a corrupted XML part.'); selected.set(entry.fileName, data.toString('utf8')); zip.readEntry(); } });
        });
      });
      zip.readEntry();
    });
  });
  const types = xml(files.get('[Content_Types].xml'));
  if (!list(types.Types?.Override).some(item => item['@_ContentType'] === 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml')) invalid('This archive is not a supported PPTX presentation.');
  const presentation = xml(files.get('ppt/presentation.xml'));
  const relationships = xml(files.get('ppt/_rels/presentation.xml.rels'));
  const refs = list(relationships.Relationships?.Relationship);
  const ids = list(presentation['p:presentation']?.['p:sldIdLst']?.['p:sldId']);
  if (!ids.length || ids.length > config.maxSlides) invalid(`Use a presentation with 1–${config.maxSlides} slides.`);
  let chars = 0;
  const slides = ids.map((id, index) => {
    const rel = refs.find(ref => ref['@_Id'] === id['@_r:id']);
    if (!rel || rel['@_TargetMode'] === 'External' || !/^slides\/slide\d+\.xml$/.test(rel['@_Target'] || '') || !rel['@_Type']?.endsWith('/slide')) invalid('The PPTX has invalid slide relationships.');
    const raw = files.get('ppt/' + rel['@_Target']); xml(raw);
    // Only a:t slide text, in document order. No notes, external media, or diagrams.
    const tree = new XMLParser({ preserveOrder: true, ignoreAttributes: false, parseTagValue: false }).parse(raw);
    const parts = [];
    const walk = nodes => { for (const node of nodes) for (const [key, value] of Object.entries(node)) {
      if (key === 'a:t' && Array.isArray(value)) parts.push(value.map(part => part['#text'] ?? '').join(''));
      else if (Array.isArray(value)) walk(value);
    } };
    walk(tree); const text = parts.join('\n').trim(); chars += text.length;
    if (chars > config.maxChars) invalid('The presentation contains too much text. Upload fewer slides.');
    return { number: index + 1, text };
  });
  if (chars < 30) invalid('The presentation has insufficient slide text. Images, diagrams, and speaker notes are not interpreted; export a text-based PDF instead.');
  return { format: 'pptx', units: slides.length, chars, slides, segments: slides, limitation: 'Only slide text is used. Images, diagrams, charts, speaker notes, and animations are not interpreted.' };
}
(workerData.format === 'pdf' ? pdf() : pptx()).then(result => parentPort.postMessage({ result }), error => parentPort.postMessage({ error: { message: error.status ? error.message : 'The document could not be parsed safely.', code: error.code || 'AI_STUDY_INVALID' } }));
