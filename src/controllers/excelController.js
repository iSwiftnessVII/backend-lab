const ExcelJS = require('exceljs');
const PizZip = require('pizzip');
const path = require('path');

const SHEET_PATH_RE = /^xl\/worksheets\/sheet\d+\.xml$/;

function hasCellValue(cell) {
  if (!cell) return false;
  const text = typeof cell.text === 'string' ? cell.text.trim() : '';
  if (text) return true;

  const val = cell.value;
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (typeof val === 'number' || typeof val === 'boolean') return true;
  if (val instanceof Date) return true;

  if (typeof val === 'object') {
    if (Object.prototype.hasOwnProperty.call(val, 'richText')) {
      const pieces = Array.isArray(val.richText) ? val.richText : [];
      const joined = pieces.map((p) => (p?.text || '')).join('').trim();
      return joined.length > 0;
    }
    if (Object.prototype.hasOwnProperty.call(val, 'formula')) {
      const res = val.result;
      if (res === null || res === undefined) return false;
      if (typeof res === 'string') return res.trim().length > 0;
      return true;
    }
    if (Object.prototype.hasOwnProperty.call(val, 'sharedFormula')) {
      const res = val.result;
      if (res === null || res === undefined) return false;
      if (typeof res === 'string') return res.trim().length > 0;
      return true;
    }
    if (Object.prototype.hasOwnProperty.call(val, 'hyperlink')) {
      const t = (val.text || '').toString().trim();
      return t.length > 0;
    }
    if (Object.prototype.hasOwnProperty.call(val, 'error')) return true;
  }

  return false;
}

function parseFileName(original, suffix) {
  const info = path.parse(original || 'archivo.xlsx');
  const ext = info.ext || '.xlsx';
  const base = info.name || 'archivo';
  return `${base}-${suffix}${ext}`;
}

function removeSheetProtection(xml) {
  let next = xml;
  next = next.replace(/<sheetProtection[^>]*\/>/g, '');
  next = next.replace(/<sheetProtection[\s\S]*?<\/sheetProtection>/g, '');
  return next;
}

function removeWorkbookProtection(xml) {
  let next = xml;
  next = next.replace(/<workbookProtection[^>]*\/>/g, '');
  next = next.replace(/<workbookProtection[\s\S]*?<\/workbookProtection>/g, '');
  return next;
}

const excelController = {
  unlockExcel: async (req, res) => {
    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ message: 'Debe adjuntar un archivo Excel.' });
    }

    try {
      const zip = new PizZip(file.buffer);
      const files = Object.keys(zip.files || {});

      for (const name of files) {
        if (SHEET_PATH_RE.test(name)) {
          const xml = zip.file(name).asText();
          zip.file(name, removeSheetProtection(xml));
        } else if (name === 'xl/workbook.xml') {
          const xml = zip.file(name).asText();
          zip.file(name, removeWorkbookProtection(xml));
        }
      }

      const out = zip.generate({ type: 'nodebuffer' });
      const filename = parseFileName(file.originalname, 'unlocked');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', file.mimetype || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(out);
    } catch (err) {
      console.error('Error desbloqueando Excel:', err);
      res.status(500).json({ message: 'No se pudo desbloquear el archivo. Puede estar encriptado.' });
    }
  },

  lockExcel: async (req, res) => {
    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ message: 'Debe adjuntar un archivo Excel.' });
    }

    const rawPassword = req.body && Object.prototype.hasOwnProperty.call(req.body, 'password') ? req.body.password : '';
    const password = String(rawPassword || '').trim();

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer);

      for (const sheet of workbook.worksheets) {
        const rowCount = Math.max(sheet.actualRowCount || 0, sheet.rowCount || 0);
        const colCount = Math.max(sheet.actualColumnCount || 0, sheet.columnCount || 0);

        if (!rowCount || !colCount) {
          continue;
        }

        const maxRow = rowCount + 200;
        const maxCol = Math.max(colCount, 50);

        for (let r = 1; r <= maxRow; r += 1) {
          const row = sheet.getRow(r);
          for (let c = 1; c <= maxCol; c += 1) {
            const cell = row.getCell(c);
            const locked = hasCellValue(cell);
            cell.protection = { locked };
          }
          if (typeof row.commit === 'function') row.commit();
        }

        await sheet.protect(password, {
          selectLockedCells: true,
          selectUnlockedCells: true
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = parseFileName(file.originalname, 'locked');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', file.mimetype || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(Buffer.from(buffer));
    } catch (err) {
      console.error('Error bloqueando Excel:', err);
      res.status(500).json({ message: 'No se pudo bloquear el archivo. Verifique el formato.' });
    }
  }
};

module.exports = excelController;
