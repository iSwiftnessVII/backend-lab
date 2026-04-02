const PizZip = require('pizzip');

function listXmlFiles(zip) {
  const files = [];
  for (const name of Object.keys(zip.files || {})) {
    const entry = zip.files[name];
    if (!entry || entry.dir) continue;
    if (!/\.xml$/i.test(name)) continue;
    files.push(name);
  }
  return files;
}

function readTextSafe(zip, name) {
  try {
    return zip.file(name)?.asText() || '';
  } catch {
    return '';
  }
}

function generateXlsxByXmlPreservingTemplate({
  templateBuffer,
  dto,
  collectTagsFromText,
  validateTags,
  replaceText,
  hasLoopMarkers
}) {
  if (!templateBuffer) return null;
  if (typeof hasLoopMarkers === 'function' && hasLoopMarkers(templateBuffer)) return null;

  const zip = new PizZip(templateBuffer);
  const xmlFiles = listXmlFiles(zip);
  const tags = new Set();

  for (const name of xmlFiles) {
    const text = readTextSafe(zip, name);
    if (!text || !text.includes('{{')) continue;
    for (const t of collectTagsFromText(text)) tags.add(t);
  }

  const invalid = validateTags(tags);
  if (invalid.length) {
    const err = new Error('Plantilla contiene llaves no permitidas: ' + invalid.slice(0, 20).join(', '));
    err.status = 400;
    throw err;
  }

  let changed = false;
  for (const name of xmlFiles) {
    const text = readTextSafe(zip, name);
    if (!text || !text.includes('{{')) continue;
    const next = replaceText(text, dto, null);
    if (next !== text) {
      zip.file(name, next);
      changed = true;
    }
  }

  if (!changed) return Buffer.from(templateBuffer);
  return Buffer.from(zip.generate({ type: 'nodebuffer' }));
}

module.exports = {
  generateXlsxByXmlPreservingTemplate
};
