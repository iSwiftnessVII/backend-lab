const pool = require('../config/db');
const ExcelJS = require('exceljs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { generateXlsxByXmlPreservingTemplate } = require('./xlsxTemplatePreserve');

function templateHasReferenciaLoop(templateBuffer) {
  try {
    const zip = new PizZip(templateBuffer);
    const re = /{{\s*#(referencias|materiales)\s*}}/i;
    for (const name of Object.keys(zip.files || {})) {
      const entry = zip.files[name];
      if (!entry || entry.dir) continue;
      let text = '';
      try {
        text = zip.file(name)?.asText() || '';
      } catch {
        text = '';
      }
      if (text && re.test(text)) return true;
    }
  } catch {
    // ignore; treat as no-loop
  }
  return false;
}

function formatDateYMD(value) {
  if (!value) return '';
  try {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    const s = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch {}
  return '';
}

function safeFileComponent(value) {
  return String(value ?? '')
    .trim()
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'archivo';
}

function isForbiddenKey(key) {
  return key === '__proto__' || key === 'prototype' || key === 'constructor';
}

function valueToText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return formatDateYMD(v);
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  return String(v);
}

async function fetchReferenciaIdentidad(codigo) {
  const codigoNorm = String(codigo ?? '').trim();
  if (!codigoNorm) return { codigo: '', nombre: '' };
  const [rows] = await pool.query(
    'SELECT codigo_id, nombre_material FROM material_referencia WHERE codigo_id = ? LIMIT 1',
    [codigoNorm]
  );
  const row = rows && rows[0] ? rows[0] : {};
  return {
    codigo: valueToText(row.codigo_id || codigoNorm).trim(),
    nombre: valueToText(row.nombre_material).trim()
  };
}

function buildPdfReferenciaDescripcion({ accion, codigo, nombre }) {
  const accionTxt = String(accion || '').trim();
  const codigoTxt = String(codigo || '').trim() || 'sin código';
  const nombreTxt = String(nombre || '').trim() || 'sin nombre';
  return `${accionTxt} PDF del material de referencia - código: ${codigoTxt}, nombre: ${nombreTxt}`;
}

function collectTagsFromText(text) {
  const s = String(text ?? '');
  const tags = new Set();
  const re = /{{\s*([^{}]+?)\s*}}/g;
  let m;
  while ((m = re.exec(s))) {
    const inner = String(m[1] ?? '').trim();
    if (inner) tags.add(inner);
  }
  return tags;
}

function validateReferenciaTags(tags) {
  const invalid = [];
  for (const tag of tags) {
    const t = String(tag ?? '').trim();
    if (
      t === '#historial' || t === '/historial' ||
      t === '#intervalos' || t === '/intervalos' ||
      t === '#referencias' || t === '/referencias' ||
      t === '#materiales' || t === '/materiales'
    ) continue;
    const m = /^(material|historial_ultimo|intervalo_ultimo|historial|intervalos)\.([A-Za-z0-9_]+)$/.exec(t);
    if (!m) {
      invalid.push(t);
      continue;
    }
    const field = m[2];
    if (isForbiddenKey(field)) invalid.push(t);
  }
  return invalid;
}

function toSafeRecord(row) {
  const out = Object.create(null);
  const r = row || {};
  for (const k of Object.keys(r)) {
    if (!k || isForbiddenKey(k)) continue;
    const v = r[k];
    if (Buffer.isBuffer(v)) continue;
    out[k] = v;
  }
  return out;
}

async function fetchReferenciaDocumentoDTO({ codigo }) {
  const codigoNorm = String(codigo ?? '').trim();
  if (!codigoNorm) return null;

  const [materialRows] = await pool.query('SELECT * FROM material_referencia WHERE codigo_id = ? LIMIT 1', [codigoNorm]);
  if (!materialRows || !materialRows.length) return null;
  const material = toSafeRecord(materialRows[0] || {});

  const [histRows] = await pool.query(
    'SELECT * FROM historial_referencia WHERE codigo_material = ? ORDER BY consecutivo DESC LIMIT 500',
    [codigoNorm]
  );
  const historial = Array.isArray(histRows) ? histRows.map(toSafeRecord) : [];

  const [intRows] = await pool.query(
    'SELECT * FROM intervalo_referencia WHERE codigo_material = ? ORDER BY consecutivo DESC LIMIT 500',
    [codigoNorm]
  );
  const intervalos = Array.isArray(intRows) ? intRows.map(toSafeRecord) : [];

  const historial_ultimo = historial.length ? historial[0] : Object.create(null);
  const intervalo_ultimo = intervalos.length ? intervalos[0] : Object.create(null);

  return { material, historial, intervalos, historial_ultimo, intervalo_ultimo };
}

async function fetchReferenciaLoopDTO({ limit } = {}) {
  const lim = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.min(5000, Number(limit)) : 5000;
  const [rows] = await pool.query(
    'SELECT * FROM material_referencia ORDER BY codigo_id LIMIT ?',
    [lim]
  );
  return Array.isArray(rows) ? rows.map(toSafeRecord) : [];
}

function replaceExcelText(text, dto, ctx) {
  return String(text ?? '').replace(
    /{{\s*(material|historial_ultimo|intervalo_ultimo|historial|intervalos)\.([A-Za-z0-9_]+)\s*}}/g,
    (_, root, field) => {
      if (isForbiddenKey(field)) return '';
      const obj = (root === 'historial' || root === 'intervalos')
        ? (ctx && typeof ctx === 'object' ? ctx[root] : null)
        : (dto ? dto[root] : null);
      if (!obj || typeof obj !== 'object') return '';
      if (!Object.prototype.hasOwnProperty.call(obj, field)) return '';
      return valueToText(obj[field]);
    }
  );
}

function clonePlain(value) {
  if (!value || typeof value !== 'object') return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function snapshotRowForTemplate(row, maxCol) {
  const snap = {
    height: row.height,
    hidden: row.hidden,
    outlineLevel: row.outlineLevel,
    style: clonePlain(row.style),
    cells: new Array((maxCol || 0) + 1)
  };
  for (let col = 1; col <= (maxCol || 0); col++) {
    const cell = row.getCell(col);
    snap.cells[col] = {
      value: clonePlain(cell.value),
      style: clonePlain(cell.style)
    };
  }
  return snap;
}

function replaceCellValue(value, dto, ctx) {
  if (typeof value === 'string') return replaceExcelText(value, dto, ctx);
  if (value && typeof value === 'object' && Array.isArray(value.richText)) {
    const cloned = clonePlain(value) || {};
    if (cloned && Array.isArray(cloned.richText)) {
      cloned.richText = cloned.richText.map((part) => ({
        ...part,
        text: replaceExcelText(part?.text, dto, ctx)
      }));
    }
    return cloned;
  }
  return value;
}

function rowHasMarker(row, marker, maxCol) {
  const m = String(marker || '');
  if (!m) return false;
  for (let col = 1; col <= (maxCol || 0); col++) {
    const v = row.getCell(col).value;
    if (typeof v === 'string' && v.includes(m)) return true;
    if (v && typeof v === 'object' && Array.isArray(v.richText)) {
      for (const part of v.richText) {
        if (typeof part?.text === 'string' && part.text.includes(m)) return true;
      }
    }
  }
  return false;
}

function applyExcelLoop(sheet, loopName, items, dto) {
  const startMarker = `{{#${loopName}}}`;
  const endMarker = `{{/${loopName}}}`;
  const maxCol = Math.max(1, sheet.columnCount || 1);

  while (true) {
    let startRow = null;
    let endRow = null;
    for (let i = 1; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      if (startRow === null) {
        if (rowHasMarker(row, startMarker, maxCol)) startRow = i;
      } else {
        if (rowHasMarker(row, endMarker, maxCol)) { endRow = i; break; }
      }
    }
    if (startRow === null || endRow === null || endRow <= startRow) break;

    const templateStart = startRow + 1;
    const templateEnd = endRow - 1;
    const templateCount = templateEnd >= templateStart ? (templateEnd - templateStart + 1) : 0;
    const templateSnaps = [];
    for (let r = 0; r < templateCount; r++) {
      const rowNum = templateStart + r;
      templateSnaps.push(snapshotRowForTemplate(sheet.getRow(rowNum), maxCol));
    }

    if (!Array.isArray(items) || items.length === 0) {
      if (templateCount > 0) sheet.spliceRows(templateStart, templateCount);
      const endRowNow = endRow - templateCount;
      sheet.spliceRows(endRowNow, 1);
      sheet.spliceRows(startRow, 1);
      continue;
    }

    for (let r = 0; r < templateCount; r++) {
      const rowNum = templateStart + r;
      const row = sheet.getRow(rowNum);
      const snap = templateSnaps[r];
      for (let col = 1; col <= maxCol; col++) {
        row.getCell(col).value = replaceCellValue(snap.cells[col]?.value, dto, { [loopName]: items[0] });
      }
    }

    let endMarkerRow = endRow;
    for (let i = 1; i < items.length; i++) {
      for (let r = 0; r < templateCount; r++) {
        const snap = templateSnaps[r];
        const values = new Array(maxCol + 1);
        for (let col = 1; col <= maxCol; col++) values[col] = clonePlain(snap.cells[col]?.value);
        const newRow = sheet.insertRow(endMarkerRow, values);
        newRow.height = snap.height;
        newRow.hidden = snap.hidden;
        newRow.outlineLevel = snap.outlineLevel;
        newRow.style = clonePlain(snap.style);
        for (let col = 1; col <= maxCol; col++) {
          const newCell = newRow.getCell(col);
          newCell.style = clonePlain(snap.cells[col]?.style);
          newCell.value = replaceCellValue(snap.cells[col]?.value, dto, { [loopName]: items[i] });
        }
        endMarkerRow++;
      }
    }

    sheet.spliceRows(endMarkerRow, 1);
    sheet.spliceRows(startRow, 1);
  }
}

function applyExcelDtoLoop(sheet, loopName, items) {
  const startMarker = `{{#${loopName}}}`;
  const endMarker = `{{/${loopName}}}`;
  const maxCol = Math.max(1, sheet.columnCount || 1);

  while (true) {
    let startRow = null;
    let endRow = null;
    for (let i = 1; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      if (startRow === null) {
        if (rowHasMarker(row, startMarker, maxCol)) startRow = i;
      } else {
        if (rowHasMarker(row, endMarker, maxCol)) { endRow = i; break; }
      }
    }
    if (startRow === null || endRow === null || endRow <= startRow) break;

    const templateStart = startRow + 1;
    const templateEnd = endRow - 1;
    const templateCount = templateEnd >= templateStart ? (templateEnd - templateStart + 1) : 0;
    const templateSnaps = [];
    for (let r = 0; r < templateCount; r++) {
      const rowNum = templateStart + r;
      templateSnaps.push(snapshotRowForTemplate(sheet.getRow(rowNum), maxCol));
    }

    if (!Array.isArray(items) || items.length === 0) {
      if (templateCount > 0) sheet.spliceRows(templateStart, templateCount);
      const endRowNow = endRow - templateCount;
      sheet.spliceRows(endRowNow, 1);
      sheet.spliceRows(startRow, 1);
      continue;
    }

    for (let r = 0; r < templateCount; r++) {
      const rowNum = templateStart + r;
      const row = sheet.getRow(rowNum);
      const snap = templateSnaps[r];
      for (let col = 1; col <= maxCol; col++) {
        row.getCell(col).value = replaceCellValue(snap.cells[col]?.value, items[0], null);
      }
    }

    let endMarkerRow = endRow;
    for (let i = 1; i < items.length; i++) {
      for (let r = 0; r < templateCount; r++) {
        const snap = templateSnaps[r];
        const values = new Array(maxCol + 1);
        for (let col = 1; col <= maxCol; col++) values[col] = clonePlain(snap.cells[col]?.value);
        const newRow = sheet.insertRow(endMarkerRow, values);
        newRow.height = snap.height;
        newRow.hidden = snap.hidden;
        newRow.outlineLevel = snap.outlineLevel;
        newRow.style = clonePlain(snap.style);
        for (let col = 1; col <= maxCol; col++) {
          const newCell = newRow.getCell(col);
          newCell.style = clonePlain(snap.cells[col]?.style);
          newCell.value = replaceCellValue(snap.cells[col]?.value, items[i], null);
        }
        endMarkerRow++;
      }
    }

    sheet.spliceRows(endMarkerRow, 1);
    sheet.spliceRows(startRow, 1);
  }
}

async function generateXlsxFromTemplate(templateBuffer, dto) {
  const preserved = generateXlsxByXmlPreservingTemplate({
    templateBuffer,
    dto,
    collectTagsFromText,
    validateTags: validateReferenciaTags,
    replaceText: replaceExcelText,
    hasLoopMarkers: templateHasReferenciaLoop
  });
  if (preserved) return preserved;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);

  const tags = new Set();
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        const v = cell.value;
        if (typeof v === 'string') {
          for (const t of collectTagsFromText(v)) tags.add(t);
        } else if (v && typeof v === 'object' && Array.isArray(v.richText)) {
          for (const part of v.richText) {
            for (const t of collectTagsFromText(part?.text)) tags.add(t);
          }
        }
      });
    });
  });

  const invalid = validateReferenciaTags(tags);
  if (invalid.length) {
    const err = new Error('Plantilla contiene llaves no permitidas: ' + invalid.slice(0, 20).join(', '));
    err.status = 400;
    throw err;
  }

  workbook.eachSheet((sheet) => {
    if (Array.isArray(dto?.referencias)) {
      applyExcelDtoLoop(sheet, 'referencias', dto.referencias);
    }
    if (Array.isArray(dto?.materiales)) {
      applyExcelDtoLoop(sheet, 'materiales', dto.materiales);
    }
    applyExcelLoop(sheet, 'historial', dto?.historial, dto);
    applyExcelLoop(sheet, 'intervalos', dto?.intervalos, dto);
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        const v = cell.value;
        if (typeof v === 'string') {
          cell.value = replaceExcelText(v, dto, null);
        } else if (v && typeof v === 'object' && Array.isArray(v.richText)) {
          cell.value = {
            ...v,
            richText: v.richText.map((part) => ({
              ...part,
              text: replaceExcelText(part?.text, dto, null)
            }))
          };
        }
      });
    });
  });

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}

function docxSafeParser(tag) {
  const raw0 = String(tag ?? '').trim();
  if (!raw0) return { get: () => '' };

  const raw = raw0.replace(/^[#/^]+/, '').trim();
  if (!/^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)?$/.test(raw)) {
    const e = new Error('Llave no permitida: ' + raw0);
    e.status = 400;
    throw e;
  }

  const parts = raw.split('.');
  const key = parts[0];
  const field = parts[1];
  if (isForbiddenKey(key) || (field && isForbiddenKey(field))) {
    const e = new Error('Llave no permitida: ' + raw0);
    e.status = 400;
    throw e;
  }

  return {
    get: (scope) => {
      if (!scope || typeof scope !== 'object') return '';
      if (!field) {
        if (!Object.prototype.hasOwnProperty.call(scope, key)) return '';
        return scope[key];
      }
      const obj = Object.prototype.hasOwnProperty.call(scope, key) ? scope[key] : null;
      if (!obj || typeof obj !== 'object') return '';
      if (!Object.prototype.hasOwnProperty.call(obj, field)) return '';
      return obj[field];
    }
  };
}

async function generateDocxFromTemplate(templateBuffer, dto) {
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    parser: docxSafeParser,
    nullGetter: () => ''
  });

  doc.setData(dto);
  try {
    doc.render();
  } catch (err) {
    const msg = (err && err.message) ? String(err.message) : 'Error generando documento Word';
    const e = new Error(msg);
    e.status = err?.status || 400;
    throw e;
  }

  const out = doc.getZip().generate({ type: 'nodebuffer' });
  return Buffer.from(out);
}

// Material Referencia
const listarMateriales = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM material_referencia ORDER BY codigo_id');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const crearMaterial = async (req, res) => {
  const { codigo_id, nombre_material, rango_medicion, marca, serie, error_max_permitido, modelo } = req.body;
  
  try {
    const [result] = await pool.query(
      'INSERT INTO material_referencia (codigo_id, nombre_material, rango_medicion, marca, serie, error_max_permitido, modelo) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [codigo_id, nombre_material, rango_medicion, marca, serie, error_max_permitido, modelo]
    );

    if (req.user && req.user.id) {
      const fecha = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
        ['MAT_REFERENCIA', 'CREAR', req.user.id, fecha, `Creación de material referencia: ${codigo_id}`]
      );
    }

    res.json({ id: result.insertId, message: 'Material creado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const actualizarMaterial = async (req, res) => {
  const { codigo_id } = req.params;
  const { nombre_material, rango_medicion, marca, serie, error_max_permitido, modelo } = req.body;
  
  try {
    // 1. Obtener datos actuales
    const [rows] = await pool.query('SELECT * FROM material_referencia WHERE codigo_id = ?', [codigo_id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'No encontrado' });
    }
    const datosActuales = rows[0];

    // 2. Preparar nuevos datos
    const datosNuevos = {
      nombre_material,
      rango_medicion,
      marca,
      serie,
      error_max_permitido,
      modelo
    };

    // 3. Ejecutar Update
    await pool.query(
      'UPDATE material_referencia SET nombre_material = ?, rango_medicion = ?, marca = ?, serie = ?, error_max_permitido = ?, modelo = ? WHERE codigo_id = ?',
      [nombre_material, rango_medicion, marca, serie, error_max_permitido, modelo, codigo_id]
    );

    // 4. Calcular diferencias
    const cambios = {};
    
    const normalize = (val) => {
      if (val instanceof Date) return val.toISOString().split('T')[0];
      if (val === null || val === undefined) return '';
      return String(val).trim();
    };

    for (const key in datosNuevos) {
      if (Object.prototype.hasOwnProperty.call(datosNuevos, key)) {
        const valAnt = normalize(datosActuales[key]);
        const valNuevo = normalize(datosNuevos[key]);
        
        if (valAnt !== valNuevo) {
          cambios[key] = {
            anterior: valAnt || '(vacío)',
            nuevo: valNuevo || '(vacío)'
          };
        }
      }
    }

    if (req.user && req.user.id) {
      const fecha = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
        ['MAT_REFERENCIA', 'ACTUALIZAR', req.user.id, fecha, `Actualización de material referencia: ${codigo_id}`]
      );
    }

    res.json({ message: 'Material actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const eliminarMaterial = async (req, res) => {
  const { codigo_id } = req.params;
  
  try {
    await pool.query('DELETE FROM material_referencia WHERE codigo_id = ?', [codigo_id]);

    if (req.user && req.user.id) {
      const fecha = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
        ['MAT_REFERENCIA', 'ELIMINAR', req.user.id, fecha, `Eliminación de material referencia: ${codigo_id}`]
      );
    }

    res.json({ message: 'Material eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const listarPdfsPorReferencia = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.query(
      'SELECT id, referencia_id, categoria, nombre_archivo, fecha_subida FROM pdfs_referencia WHERE referencia_id = ? ORDER BY fecha_subida ASC',
      [codigo]
    );
    const items = rows.map(r => ({
      id: r.id,
      nombre_archivo: r.nombre_archivo,
      categoria: r.categoria,
      fecha_subida: r.fecha_subida
    }));
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const subirPdfReferencia = async (req, res) => {
  try {
    const codigo = req.params.codigo || req.body.codigo_material;
    const categoria = req.body.categoria || null;
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'No se recibió archivo' });
    }
    const originalName = req.file.originalname || 'archivo.pdf';
    const buffer = req.file.buffer;
    const [result] = await pool.query(
      'INSERT INTO pdfs_referencia (referencia_id, categoria, nombre_archivo, archivo, fecha_subida) VALUES (?, ?, ?, ?, NOW())',
      [codigo, categoria, originalName, buffer]
    );
    const insertedId = result.insertId;

    if (req.user && req.user.id) {
      const fecha = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      const identidad = await fetchReferenciaIdentidad(codigo);
      const descripcion = buildPdfReferenciaDescripcion({
        accion: 'Subida de',
        codigo: identidad.codigo || codigo,
        nombre: identidad.nombre
      });
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
        ['MAT_REFERENCIA', 'SUBIR_PDF', req.user.id, fecha, descripcion]
      );
    }

    res.status(201).json({ id: insertedId, nombre_archivo: originalName, categoria });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const descargarPdfReferencia = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      'SELECT nombre_archivo, archivo FROM pdfs_referencia WHERE id = ? LIMIT 1',
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Archivo no encontrado' });
    const r = rows[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${r.nombre_archivo || 'archivo.pdf'}"`);
    res.send(r.archivo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const eliminarPdfReferencia = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener info antes de eliminar
    const [rows] = await pool.query('SELECT referencia_id, nombre_archivo FROM pdfs_referencia WHERE id = ?', [id]);
    
    const [result] = await pool.query('DELETE FROM pdfs_referencia WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    if (req.user && req.user.id && rows.length > 0) {
      const pdfInfo = rows[0];
      const fechaLog = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      const identidad = await fetchReferenciaIdentidad(pdfInfo.referencia_id);
      const descripcion = buildPdfReferenciaDescripcion({
        accion: 'Eliminación de',
        codigo: identidad.codigo || pdfInfo.referencia_id,
        nombre: identidad.nombre
      });
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
        ['MAT_REFERENCIA', 'ELIMINAR_PDF', req.user.id, fechaLog, descripcion]
      );
    }

    res.json({ message: 'Archivo eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Historial Referencia
const listarHistorialPorMaterial = async (req, res) => {
  const { codigo_material } = req.params;
  
  try {
    const [rows] = await pool.query(
      'SELECT * FROM historial_referencia WHERE codigo_material = ? ORDER BY consecutivo DESC',
      [codigo_material]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const crearHistorial = async (req, res) => {
  const { consecutivo, codigo_material, fecha, tipo_historial_instrumento, codigo_registro, realizo, superviso } = req.body;
  
  try {
    const [result] = await pool.query(
      'INSERT INTO historial_referencia (consecutivo, codigo_material, fecha, tipo_historial_instrumento, codigo_registro, realizo, superviso) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [consecutivo, codigo_material, fecha, tipo_historial_instrumento, codigo_registro, realizo, superviso]
    );

    if (req.user && req.user.id) {
      const fechaLog = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
        ['MAT_REFERENCIA', 'CREAR', req.user.id, fechaLog, `Creación de historial para referencia: ${codigo_material}`]
      );
    }

    res.json({ id: result.insertId, message: 'Historial creado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const actualizarHistorial = async (req, res) => {
  const { codigo_material, consecutivo } = req.params;
  const { tipo_historial_instrumento, codigo_registro, realizo, superviso } = req.body;
  
  try {
    // 1. Obtener datos actuales
    const [rows] = await pool.query('SELECT * FROM historial_referencia WHERE codigo_material = ? AND consecutivo = ?', [codigo_material, consecutivo]);
    if (rows.length === 0) return res.status(404).json({ message: 'No encontrado' });
    const datosActuales = rows[0];

    // 2. Preparar nuevos datos
    const datosNuevos = { tipo_historial_instrumento, codigo_registro, realizo, superviso };

    // 3. Update
    await pool.query(
      'UPDATE historial_referencia SET tipo_historial_instrumento = ?, codigo_registro = ?, realizo = ?, superviso = ? WHERE codigo_material = ? AND consecutivo = ?',
      [tipo_historial_instrumento, codigo_registro, realizo, superviso, codigo_material, consecutivo]
    );

    // 4. Calcular diferencias
    const cambios = {};
    
    const normalize = (val) => {
      if (val instanceof Date) return val.toISOString().split('T')[0];
      if (val === null || val === undefined) return '';
      return String(val).trim();
    };

    for (const key in datosNuevos) {
      if (Object.prototype.hasOwnProperty.call(datosNuevos, key)) {
        const valAnt = normalize(datosActuales[key]);
        const valNuevo = normalize(datosNuevos[key]);
        
        if (valAnt !== valNuevo) {
          cambios[key] = {
            anterior: valAnt || '(vacío)',
            nuevo: valNuevo || '(vacío)'
          };
        }
      }
    }

    if (req.user && req.user.id) {
      const fechaLog = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
        ['MAT_REFERENCIA', 'ACTUALIZAR', req.user.id, fechaLog, `Actualización de historial para referencia: ${codigo_material}`]
      );
    }

    res.json({ message: 'Historial actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const obtenerNextHistorial = async (req, res) => {
  const { codigo_material } = req.params;
  
  try {
    const [rows] = await pool.query(
      'SELECT MAX(consecutivo) as max FROM historial_referencia WHERE codigo_material = ?',
      [codigo_material]
    );
    const next = (rows[0].max || 0) + 1;
    res.json({ next });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Intervalo Referencia
const listarIntervaloPorMaterial = async (req, res) => {
  const { codigo_material } = req.params;
  
  try {
    const [rows] = await pool.query(
      'SELECT * FROM intervalo_referencia WHERE codigo_material = ? ORDER BY consecutivo DESC',
      [codigo_material]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const crearIntervalo = async (req, res) => {
  const {
    consecutivo, codigo_material, valor_nominal,
    fecha_c1, error_c1, fecha_c2, error_c2,
    diferencia_tiempo_dias, desviacion_abs, deriva, tolerancia,
    intervalo_calibracion_dias, intervalo_calibracion_anos, incertidumbre_exp
  } = req.body;
  
  try {
    const [result] = await pool.query(
      `INSERT INTO intervalo_referencia 
       (consecutivo, codigo_material, valor_nominal, fecha_c1, error_c1, fecha_c2, error_c2, 
        diferencia_tiempo_dias, desviacion_abs, deriva, tolerancia, intervalo_calibracion_dias, 
        intervalo_calibracion_anos, incertidumbre_exp) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        consecutivo, codigo_material, valor_nominal,
        fecha_c1, error_c1, fecha_c2, error_c2,
        diferencia_tiempo_dias, desviacion_abs, deriva, tolerancia,
        intervalo_calibracion_dias, intervalo_calibracion_anos, incertidumbre_exp
      ]
    );

    if (req.user && req.user.id) {
      const fechaLog = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
        ['MAT_REFERENCIA', 'CREAR', req.user.id, fechaLog, `Creación de intervalo para referencia: ${codigo_material}`]
      );
    }

    res.json({ id: result.insertId, message: 'Intervalo creado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const actualizarIntervalo = async (req, res) => {
  const { codigo_material, consecutivo } = req.params;
  const {
    valor_nominal, fecha_c1, error_c1, fecha_c2, error_c2,
    diferencia_tiempo_dias, desviacion_abs, deriva, tolerancia,
    intervalo_calibracion_dias, intervalo_calibracion_anos, incertidumbre_exp
  } = req.body;
  
  try {
    // 1. Obtener datos actuales
    const [rows] = await pool.query('SELECT * FROM intervalo_referencia WHERE codigo_material = ? AND consecutivo = ?', [codigo_material, consecutivo]);
    if (rows.length === 0) return res.status(404).json({ message: 'No encontrado' });
    const datosActuales = rows[0];

    // 2. Preparar nuevos datos
    const datosNuevos = {
        valor_nominal, fecha_c1, error_c1, fecha_c2, error_c2,
        diferencia_tiempo_dias, desviacion_abs, deriva, tolerancia,
        intervalo_calibracion_dias, intervalo_calibracion_anos, incertidumbre_exp
    };

    // 3. Update
    await pool.query(
      `UPDATE intervalo_referencia 
       SET valor_nominal = ?, fecha_c1 = ?, error_c1 = ?, fecha_c2 = ?, error_c2 = ?,
           diferencia_tiempo_dias = ?, desviacion_abs = ?, deriva = ?, tolerancia = ?,
           intervalo_calibracion_dias = ?, intervalo_calibracion_anos = ?, incertidumbre_exp = ?
       WHERE codigo_material = ? AND consecutivo = ?`,
      [
        valor_nominal, fecha_c1, error_c1, fecha_c2, error_c2,
        diferencia_tiempo_dias, desviacion_abs, deriva, tolerancia,
        intervalo_calibracion_dias, intervalo_calibracion_anos, incertidumbre_exp,
        codigo_material, consecutivo
      ]
    );

    // 4. Calcular diferencias
    const cambios = {};
    
    const normalize = (val) => {
      if (val instanceof Date) return val.toISOString().split('T')[0];
      if (val === null || val === undefined) return '';
      return String(val).trim();
    };

    for (const key in datosNuevos) {
      if (Object.prototype.hasOwnProperty.call(datosNuevos, key)) {
        const valAnt = normalize(datosActuales[key]);
        const valNuevo = normalize(datosNuevos[key]);
        
        if (valAnt !== valNuevo) {
          cambios[key] = {
            anterior: valAnt || '(vacío)',
            nuevo: valNuevo || '(vacío)'
          };
        }
      }
    }

    if (req.user && req.user.id) {
      const fechaLog = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
        ['MAT_REFERENCIA', 'ACTUALIZAR', req.user.id, fechaLog, `Actualización de intervalo para referencia: ${codigo_material}`]
      );
    }

    res.json({ message: 'Intervalo actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const obtenerNextIntervalo = async (req, res) => {
  const { codigo_material } = req.params;
  
  try {
    const [rows] = await pool.query(
      'SELECT MAX(consecutivo) as max FROM intervalo_referencia WHERE codigo_material = ?',
      [codigo_material]
    );
    const next = (rows[0].max || 0) + 1;
    res.json({ next });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const generarDocumentoReferencia = async (req, res) => {
  try {
    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ message: 'Plantilla requerida' });
    }

    const body = req.body || {};
    const codigo = String(body.codigo ?? body.codigo_id ?? body.codigo_material ?? '').trim();
    const todos = templateHasReferenciaLoop(file.buffer);
    if (!todos && !codigo) {
      return res.status(400).json({ message: 'Debe enviar codigo' });
    }

    let dto = null;
    if (todos) {
      const materiales = await fetchReferenciaLoopDTO();
      const items = materiales.map((material) => ({
        material,
        historial: [],
        intervalos: [],
        historial_ultimo: Object.create(null),
        intervalo_ultimo: Object.create(null)
      }));
      dto = {
        material: Object.create(null),
        historial: [],
        intervalos: [],
        historial_ultimo: Object.create(null),
        intervalo_ultimo: Object.create(null),
        referencias: items,
        materiales: items
      };
    } else {
      dto = await fetchReferenciaDocumentoDTO({ codigo });
      if (!dto) {
        return res.status(404).json({ message: 'Material no encontrado' });
      }
    }

    const original = String(file.originalname || '').toLowerCase();
    const isXlsx = original.endsWith('.xlsx') || /spreadsheetml/.test(String(file.mimetype || '').toLowerCase());
    const isDocx = original.endsWith('.docx') || /wordprocessingml/.test(String(file.mimetype || '').toLowerCase());
    if (!isXlsx && !isDocx) {
      return res.status(400).json({ message: 'Formato de plantilla no soportado. Use .xlsx o .docx' });
    }

    const outBuffer = isXlsx
      ? await generateXlsxFromTemplate(file.buffer, dto)
      : await generateDocxFromTemplate(file.buffer, dto);

    const ext = isXlsx ? 'xlsx' : 'docx';
    const code = dto?.material?.codigo_id ?? codigo;
    const filename = todos
      ? `referencias.${ext}`
      : `referencia_${safeFileComponent(code)}.${ext}`;

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader(
      'Content-Type',
      isXlsx
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(outBuffer);
  } catch (err) {
    const status = err?.status ? Number(err.status) : 500;
    const message = err?.message || 'Error generando documento';
    return res.status(Number.isFinite(status) ? status : 500).json({ message });
  }
};

async function ensurePlantillasDocumentoReferenciaTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plantillas_documento_referencia (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      nombre VARCHAR(255) NULL,
      nombre_archivo VARCHAR(255) NOT NULL,
      mime VARCHAR(120) NULL,
      size_bytes INT NULL,
      archivo LONGBLOB NOT NULL,
      usuario_id BIGINT NULL,
      fecha_subida TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    )
  `);
}

exports.listarPlantillasDocumentoReferencia = async (req, res) => {
  try {
    await ensurePlantillasDocumentoReferenciaTable();
    const [rows] = await pool.query(
      `SELECT id, nombre, nombre_archivo, mime, size_bytes, usuario_id, fecha_subida
       FROM plantillas_documento_referencia
       ORDER BY fecha_subida DESC, id DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('Error GET /referencia/documentos/plantillas:', err);
    return res.status(500).json({ message: 'Error listando plantillas' });
  }
};

exports.subirPlantillaDocumentoReferencia = async (req, res) => {
  try {
    await ensurePlantillasDocumentoReferenciaTable();
    const file = req.file;
    if (!file || !file.buffer) return res.status(400).json({ message: 'Debe enviar el archivo template' });

    const original = String(file.originalname || '').toLowerCase();
    const isXlsx = original.endsWith('.xlsx') || /spreadsheetml/.test(String(file.mimetype || '').toLowerCase());
    const isDocx = original.endsWith('.docx') || /wordprocessingml/.test(String(file.mimetype || '').toLowerCase());
    if (!isXlsx && !isDocx) {
      return res.status(400).json({ message: 'Solo se permiten plantillas .xlsx o .docx' });
    }

    const nombreRaw = typeof (req.body || {}).nombre === 'string' ? String(req.body.nombre).trim() : '';
    const nombre = nombreRaw ? nombreRaw : null;
    const usuarioId = req.user && req.user.id ? Number(req.user.id) : null;
    const sizeBytes = Number.isFinite(file.size) ? file.size : (file.buffer ? file.buffer.length : null);

    const [result] = await pool.query(
      `INSERT INTO plantillas_documento_referencia (nombre, nombre_archivo, mime, size_bytes, archivo, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        String(file.originalname || 'template'),
        file.mimetype || null,
        sizeBytes,
        file.buffer,
        usuarioId
      ]
    );
    if (req.user && req.user.id) {
      const fecha = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      await pool.query(
        'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, 'SUBIR_PLANTILLA', 'REFERENCIA', fecha, `Subir plantilla de referencia: ${nombre}`]
      );
    }

    return res.status(201).json({
      id: result.insertId,
      nombre,
      nombre_archivo: String(file.originalname || 'template'),
      mime: file.mimetype || null,
      size_bytes: sizeBytes,
      usuario_id: usuarioId,
      fecha_subida: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error POST /referencia/documentos/plantillas:', err);
    return res.status(500).json({ message: 'Error subiendo plantilla' });
  }
};

exports.eliminarPlantillaDocumentoReferencia = async (req, res) => {
  try {
    await ensurePlantillasDocumentoReferenciaTable();
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: 'ID inválido' });

    const [result] = await pool.query('DELETE FROM plantillas_documento_referencia WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Plantilla no encontrada' });
    if (req.user && req.user.id) {
      const fecha = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      await pool.query(
        'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, 'ELIMINAR_PLANTILLA', 'REFERENCIA', fecha, `Eliminar plantilla de referencia: ${id}`]
      );
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error DELETE /referencia/documentos/plantillas/:id:', err);
    return res.status(500).json({ message: 'Error eliminando plantilla' });
  }
};

exports.generarDocumentoReferenciaDesdePlantilla = async (req, res) => {
  try {
    await ensurePlantillasDocumentoReferenciaTable();
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: 'ID inválido' });

    const codigo = String((req.body || {}).codigo || '').trim();
    const todos = !!(req.body || {}).todos;
    if (!todos && !codigo) return res.status(400).json({ message: 'Debe enviar codigo' });

    const [rows] = await pool.query(
      'SELECT nombre_archivo, mime, archivo FROM plantillas_documento_referencia WHERE id = ? LIMIT 1',
      [id]
    );
    if (!rows || !rows.length) return res.status(404).json({ message: 'Plantilla no encontrada' });

    const tpl = rows[0];
    req.body = { ...req.body, codigo: codigo || undefined, todos: todos || undefined };
    req.file = {
      buffer: tpl.archivo,
      originalname: tpl.nombre_archivo,
      mimetype: tpl.mime || 'application/octet-stream',
      size: tpl.archivo ? tpl.archivo.length : 0
    };

    return generarDocumentoReferencia(req, res);
  } catch (err) {
    console.error('Error POST /referencia/documentos/plantillas/:id/generar:', err);
    return res.status(500).json({ message: 'Error generando documento desde plantilla' });
  }
};

module.exports = {
  // Material Referencia
  listarMateriales,
  crearMaterial,
  actualizarMaterial,
  eliminarMaterial,
  
  // Historial Referencia
  listarHistorialPorMaterial,
  crearHistorial,
  actualizarHistorial,
  obtenerNextHistorial,
  
  // Intervalo Referencia
  listarIntervaloPorMaterial,
  crearIntervalo,
  actualizarIntervalo,
  obtenerNextIntervalo
  ,
  listarPdfsPorReferencia,
  subirPdfReferencia,
  descargarPdfReferencia,
  eliminarPdfReferencia,
  generarDocumentoReferencia,
  listarPlantillasDocumentoReferencia: exports.listarPlantillasDocumentoReferencia,
  subirPlantillaDocumentoReferencia: exports.subirPlantillaDocumentoReferencia,
  eliminarPlantillaDocumentoReferencia: exports.eliminarPlantillaDocumentoReferencia,
  generarDocumentoReferenciaDesdePlantilla: exports.generarDocumentoReferenciaDesdePlantilla
};
