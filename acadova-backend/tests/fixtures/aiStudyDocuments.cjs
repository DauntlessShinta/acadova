// Small synthetic fixtures built without Office, provider calls, or personal material.
const { deflateRawSync } = require('node:zlib');
function pdf(text = 'A binary search repeatedly halves a sorted search space. Sorted input is required.', encrypted = false, pages = 1) {
  const escaped = text.replace(/([\\()])/g, '\\$1'); const stream = `BT /F1 12 Tf 50 750 Td (${escaped}) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  objects[1] = `<< /Type /Pages /Kids [${Array(pages).fill('3 0 R').join(' ')}] /Count ${pages} >>`;
  if (encrypted) objects.push(`<< /Filter /Standard /V 1 /R 2 /Length 40 /O <${'00'.repeat(32)}> /U <${'00'.repeat(32)}> /P -4 >>`);
  let result = '%PDF-1.4\n'; const offsets = [0]; objects.forEach((value, i) => { offsets.push(Buffer.byteLength(result)); result += `${i + 1} 0 obj\n${value}\nendobj\n`; });
  const at = Buffer.byteLength(result); result += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  result += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R ${encrypted ? `/Encrypt 6 0 R /ID [<${'11'.repeat(16)}><${'11'.repeat(16)}>]` : ''} >>\nstartxref\n${at}\n%%EOF\n`; return Buffer.from(result);
}
function crc32(buffer) { let crc = -1; for (const byte of buffer) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } return (crc ^ -1) >>> 0; }
function zip(files) {
  const locals = []; const entries = []; let offset = 0;
  for (const [name, value] of Object.entries(files)) {
    const filename = Buffer.from(name); const data = Buffer.from(value); const compressed = deflateRawSync(data); const crc = crc32(data);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8); local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(filename.length, 26);
    locals.push(local, filename, compressed);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10); central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
    entries.push(central, filename); offset += local.length + filename.length + compressed.length;
  }
  const central = Buffer.concat(entries); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}
function pptx(texts = ['A binary search halves a sorted search space.', 'Sorted input is required for binary search.'], additions = {}) {
  const files = {
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>',
    'ppt/presentation.xml': `<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst>${texts.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join('')}</p:sldIdLst></p:presentation>`,
    'ppt/_rels/presentation.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${texts.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('')}</Relationships>`,
  };
  texts.forEach((text, i) => { files[`ppt/slides/slide${i + 1}.xml`] = `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`; });
  return zip({ ...files, ...additions });
}
const output = () => ({ title: 'Binary search practice', flashcards: [{ front: 'What does binary search require?', back: 'Sorted input.', sourceRef: 1 }, { front: 'How does it reduce the search space?', back: 'By halving it repeatedly.', sourceRef: 1 }], questions: [{ prompt: 'Which input is required?', options: ['Sorted input', 'Unsorted input', 'No input', 'An image'], correctIndex: 0, explanation: 'The material states that binary search requires sorted input.', sourceRef: 1 }] });
module.exports = { pdf, pptx, zip, output };
