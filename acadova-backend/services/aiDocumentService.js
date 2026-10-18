const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { aiError } = require('../config/aiStudy');
const { createHash } = require('node:crypto');
let activeWorkers = 0;
function validateFile(file, config) {
  if (!file?.buffer?.length) throw aiError('Choose a nonempty PDF or PPTX document.');
  if (file.buffer.length > config.maxBytes) throw aiError('Document exceeds the upload limit (maximum 5 MB).', 413);
  const name = path.basename(String(file.originalname || '').replace(/\\/g, '/')).replace(/[\u0000-\u001f]/g, '').slice(0, 160);
  const ext = path.extname(name).toLowerCase();
  const pdf = file.buffer.subarray(0, 5).toString() === '%PDF-';
  const zip = file.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  if (!(ext === '.pdf' && pdf || ext === '.pptx' && zip)) throw aiError('File extension and contents must match a PDF or PPTX document.');
  return { name, format: ext.slice(1) };
}
async function extractDocument(file, config) {
  const { name, format } = validateFile(file, config);
  if (activeWorkers >= 2) throw aiError('Document processing is busy. Try a new generation request later.', 429);
  activeWorkers++;
  return new Promise((resolve, reject) => {
    let worker;
    try { worker = new Worker(path.join(__dirname, 'aiDocumentWorker.js'), {
      workerData: { buffer: file.buffer, format, config: { maxPages: config.maxPages, maxSlides: config.maxSlides, maxChars: config.maxChars } },
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32 },
    }); } catch { activeWorkers--; reject(aiError('Document parser is unavailable. Try later.', 503)); return; }
    let done = false;
    const finish = (error, result) => { if (done) return; done = true; activeWorkers--; clearTimeout(timer); worker.terminate(); if (error) reject(error); else resolve({ ...result, sourceId: createHash('sha256').update(file.buffer).digest('hex'), name, bytes: file.buffer.length, ...(format === 'pdf' ? { buffer: file.buffer } : {}) }); };
    const timer = setTimeout(() => finish(aiError('Document processing timed out. Use a smaller document.', 400)), config.parserTimeoutMs);
    worker.once('message', message => finish(message.error ? aiError(message.error.message, 400, message.error.code) : null, message.result));
    worker.once('error', () => finish(aiError('Document exceeds safe parser limits or is unreadable.')));
    worker.once('exit', () => { if (!done) finish(aiError('Document parser stopped before processing finished.')); });
  });
}
module.exports = { validateFile, extractDocument };
