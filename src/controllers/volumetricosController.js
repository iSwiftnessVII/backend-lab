const pool = require('../config/db');
const fs = require('fs').promises;
const path = require('path');
const ExcelJS = require('exceljs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

function templateHasVolumetricosLoop(templateBuffer) {
  try {
    const zip = new PizZip(templateBuffer);
    const re = /{{\s*#(volumetricos|materiales)\s*}}/i;
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

const UPLOADS_BASE = path.join(__dirname, '..', '..', 'uploads', 'volumetricos');

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    // ignore
  }
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

function validateVolumetricosTags(tags) {
  const invalid = [];
  for (const tag of tags) {
    const t = String(tag ?? '').trim();
    if (
      t === '#historial' || t === '/historial' ||
      t === '#intervalos' || t === '/intervalos' ||
      t === '#volumetricos' || t === '/volumetricos' ||
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

async function fetchVolumetricoDocumentoDTO({ codigo }) {
  const codigoNorm = String(codigo ?? '').trim();
  if (!codigoNorm) return null;

  const [materialRows] = await pool.execute('SELECT * FROM material_volumetrico WHERE codigo_id = ? LIMIT 1', [codigoNorm]);
  if (!materialRows || !materialRows.length) return null;
  const material = toSafeRecord(materialRows[0] || {});

  const [histRows] = await pool.execute(
    'SELECT * FROM historial_volumetrico WHERE codigo_material = ? ORDER BY consecutivo DESC LIMIT 500',
    [codigoNorm]
  );
  const historial = Array.isArray(histRows) ? histRows.map(toSafeRecord) : [];

  const [intRows] = await pool.execute(
    'SELECT * FROM intervalo_volumetrico WHERE codigo_material = ? ORDER BY consecutivo DESC LIMIT 500',
    [codigoNorm]
  );
  const intervalos = Array.isArray(intRows) ? intRows.map(toSafeRecord) : [];

  const historial_ultimo = historial.length ? historial[0] : Object.create(null);
  const intervalo_ultimo = intervalos.length ? intervalos[0] : Object.create(null);

  return { material, historial, intervalos, historial_ultimo, intervalo_ultimo };
}

async function fetchVolumetricosLoopDTO({ limit } = {}) {
  const lim = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.min(5000, Number(limit)) : 5000;
  const [rows] = await pool.execute(
    'SELECT * FROM material_volumetrico ORDER BY codigo_id LIMIT ?',
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

  const invalid = validateVolumetricosTags(tags);
  if (invalid.length) {
    const err = new Error('Plantilla contiene llaves no permitidas: ' + invalid.slice(0, 20).join(', '));
    err.status = 400;
    throw err;
  }

  workbook.eachSheet((sheet) => {
    if (Array.isArray(dto?.volumetricos)) {
      applyExcelDtoLoop(sheet, 'volumetricos', dto.volumetricos);
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

// ==================== MATERIAL VOLUMÉTRICO ====================

// Crear material volumétrico
exports.crearMaterial = async (req, res) => {
  try {
    const {
      codigo_id,
      nombre_material,
      volumen_nominal,
      rango_volumen,
      marca,
      resolucion,
      error_max_permitido,
      modelo
    } = req.body;

    const sql = `INSERT INTO material_volumetrico (
      codigo_id, nombre_material, volumen_nominal, rango_volumen, marca, resolucion, error_max_permitido, modelo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    await pool.execute(sql, [
      codigo_id,
      nombre_material,
      volumen_nominal,
      rango_volumen || null,
      marca || null,
      resolucion || null,
      error_max_permitido || null,
      modelo || null
    ]);

    if (req.user && req.user.id) {
      const fecha = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion, detalle) VALUES (?, ?, ?, ?, ?, ?)',
        ['MAT_VOLUMETRICOS', 'CREAR', req.user.id, fecha, `Creación de material volumétrico: ${codigo_id}`, JSON.stringify(req.body)]
      );
    }

    res.status(201).json({ message: 'Material volumétrico registrado correctamente' });
  } catch (error) {
    console.error('Error al registrar material volumétrico:', error);
    res.status(500).json({ message: 'Error al registrar material volumétrico', error: error.message });
  }
};

// Listar todos los materiales volumétricos
exports.listarMateriales = async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM material_volumetrico ORDER BY codigo_id');
    res.json(rows);
  } catch (error) {
    console.error('Error al listar materiales volumétricos:', error);
    res.status(500).json({ message: 'Error al listar materiales volumétricos', error: error.message });
  }
};

// Obtener material completo por código
exports.obtenerMaterialCompleto = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.execute('SELECT * FROM material_volumetrico WHERE codigo_id = ?', [codigo]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Material no encontrado' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener material volumétrico:', error);
    res.status(500).json({ message: 'Error al obtener material volumétrico', error: error.message });
  }
};

// Actualizar material volumétrico
exports.actualizarMaterial = async (req, res) => {
  try {
    const { codigo } = req.params;
    const {
      nombre_material,
      volumen_nominal,
      rango_volumen,
      marca,
      resolucion,
      error_max_permitido,
      modelo
    } = req.body;

    // 1. Obtener datos actuales
    const [rowsCurrent] = await pool.execute('SELECT * FROM material_volumetrico WHERE codigo_id = ?', [codigo]);
    if (rowsCurrent.length === 0) {
      return res.status(404).json({ message: 'Material no encontrado' });
    }
    const datosActuales = rowsCurrent[0];

    const datosNuevos = {
      nombre_material,
      volumen_nominal,
      rango_volumen: rango_volumen || null,
      marca: marca || null,
      resolucion: resolucion || null,
      error_max_permitido: error_max_permitido || null,
      modelo: modelo || null
    };

    const sql = `UPDATE material_volumetrico SET 
      nombre_material = ?, 
      volumen_nominal = ?, 
      rango_volumen = ?, 
      marca = ?, 
      resolucion = ?, 
      error_max_permitido = ?, 
      modelo = ?
    WHERE codigo_id = ?`;

    await pool.execute(sql, [
      datosNuevos.nombre_material,
      datosNuevos.volumen_nominal,
      datosNuevos.rango_volumen,
      datosNuevos.marca,
      datosNuevos.resolucion,
      datosNuevos.error_max_permitido,
      datosNuevos.modelo,
      codigo
    ]);

    // Calcular diferencias y registrar log
    if (req.user && req.user.id) {
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

      const detallesCambios = Object.keys(cambios).length > 0 ? JSON.stringify(cambios) : null;

      const fecha = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion, detalle) VALUES (?, ?, ?, ?, ?, ?)',
        ['MAT_VOLUMETRICOS', 'ACTUALIZAR', req.user.id, fecha, `Actualización de material volumétrico: ${codigo}`, detallesCambios]
      );
    }

    const [updated] = await pool.execute('SELECT * FROM material_volumetrico WHERE codigo_id = ?', [codigo]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Error al actualizar material volumétrico:', error);
    res.status(500).json({ message: 'Error al actualizar material volumétrico', error: error.message });
  }
};

// Eliminar material volumétrico
exports.eliminarMaterial = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [result] = await pool.execute('DELETE FROM material_volumetrico WHERE codigo_id = ?', [codigo]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Material no encontrado' });
    }
    
    if (req.user && req.user.id) {
      const fecha = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion, detalle) VALUES (?, ?, ?, ?, ?, ?)',
        ['MAT_VOLUMETRICOS', 'ELIMINAR', req.user.id, fecha, `Eliminación de material volumétrico: ${codigo}`, null]
      );
    }
    
    res.json({ message: 'Material volumétrico eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar material volumétrico:', error);
    res.status(500).json({ message: 'Error al eliminar material volumétrico', error: error.message });
  }
};

// ==================== HISTORIAL VOLUMÉTRICO ====================

// Crear historial volumétrico
exports.crearHistorial = async (req, res) => {
  try {
    const {
      consecutivo,
      codigo_material,
      fecha,
      tipo_historial_instrumento,
      codigo_registro,
      realizo,
      superviso
    } = req.body;

    const sql = `INSERT INTO historial_volumetrico (
      consecutivo, codigo_material, fecha, tipo_historial_instrumento, codigo_registro, realizo, superviso
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`;

    await pool.execute(sql, [
      consecutivo,
      codigo_material,
      fecha,
      tipo_historial_instrumento || null,
      codigo_registro || null,
      realizo || null,
      superviso || null
    ]);

    if (req.user && req.user.id) {
      const fechaLog = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion, detalle) VALUES (?, ?, ?, ?, ?, ?)',
        ['MAT_VOLUMETRICOS', 'CREAR', req.user.id, fechaLog, `Creación de historial para volumétrico: ${codigo_material}`, JSON.stringify(req.body)]
      );
    }

    res.status(201).json({ message: 'Historial registrado correctamente' });
  } catch (error) {
    console.error('Error al registrar historial:', error);
    res.status(500).json({ message: 'Error al registrar historial', error: error.message });
  }
};

// Listar historial por material
exports.listarHistorialPorMaterial = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.execute(
      'SELECT * FROM historial_volumetrico WHERE codigo_material = ? ORDER BY consecutivo',
      [codigo]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al listar historial:', error);
    res.status(500).json({ message: 'Error al listar historial', error: error.message });
  }
};

// Obtener siguiente consecutivo de historial
exports.obtenerNextHistorial = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.execute(
      'SELECT MAX(consecutivo) as maxConsecutivo FROM historial_volumetrico WHERE codigo_material = ?',
      [codigo]
    );
    const maxConsecutivo = rows[0]?.maxConsecutivo || 0;
    res.json({ nextConsecutivo: maxConsecutivo + 1 });
  } catch (error) {
    console.error('Error al obtener siguiente consecutivo:', error);
    res.status(500).json({ message: 'Error al obtener siguiente consecutivo', error: error.message });
  }
};

// Actualizar historial
exports.actualizarHistorial = async (req, res) => {
  try {
    const { codigo, consecutivo } = req.params;

    // 1. Obtener datos actuales
    const [rowsCurrent] = await pool.execute(
      'SELECT * FROM historial_volumetrico WHERE codigo_material = ? AND consecutivo = ?',
      [codigo, consecutivo]
    );
    if (rowsCurrent.length === 0) {
      return res.status(404).json({ message: 'Registro de historial no encontrado' });
    }
    const datosActuales = rowsCurrent[0];

    const allowedFields = ['fecha', 'tipo_historial_instrumento', 'codigo_registro', 'realizo', 'superviso'];
    
    const updates = [];
    const values = [];
    const datosNuevos = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
        datosNuevos[field] = req.body[field];
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No hay campos para actualizar' });
    }

    values.push(codigo, consecutivo);
    const sql = `UPDATE historial_volumetrico SET ${updates.join(', ')} WHERE codigo_material = ? AND consecutivo = ?`;
    
    await pool.execute(sql, values);

    // 2. Calcular diferencias y registrar log
    if (req.user && req.user.id) {
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

      const detallesCambios = Object.keys(cambios).length > 0 ? JSON.stringify(cambios) : null;
      
      const fechaLog = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion, detalle) VALUES (?, ?, ?, ?, ?, ?)',
        ['MAT_VOLUMETRICOS', 'ACTUALIZAR', req.user.id, fechaLog, `Actualización de historial para volumétrico: ${codigo}`, detallesCambios]
      );
    }

    const [updated] = await pool.execute(
      'SELECT * FROM historial_volumetrico WHERE codigo_material = ? AND consecutivo = ?',
      [codigo, consecutivo]
    );

    res.json(updated[0]);
  } catch (error) {
    console.error('Error al actualizar historial:', error);
    res.status(500).json({ message: 'Error al actualizar historial', error: error.message });
  }
};

// ==================== INTERVALO VOLUMÉTRICO ====================

// Crear intervalo volumétrico
exports.crearIntervalo = async (req, res) => {
  try {
    const {
      consecutivo,
      codigo_material,
      valor_nominal,
      fecha_c1,
      error_c1,
      fecha_c2,
      error_c2,
      diferencia_tiempo_dias,
      desviacion_abs,
      deriva,
      tolerancia,
      intervalo_calibracion_dias,
      intervalo_calibracion_anos,
      incertidumbre_exp
    } = req.body;

    const sql = `INSERT INTO intervalo_volumetrico (
      consecutivo, codigo_material, valor_nominal, fecha_c1, error_c1, fecha_c2, error_c2,
      diferencia_tiempo_dias, desviacion_abs, deriva, tolerancia, intervalo_calibracion_dias,
      intervalo_calibracion_anos, incertidumbre_exp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await pool.execute(sql, [
      consecutivo,
      codigo_material,
      valor_nominal,
      fecha_c1,
      error_c1,
      fecha_c2,
      error_c2,
      diferencia_tiempo_dias || null,
      desviacion_abs || null,
      deriva || null,
      tolerancia || null,
      intervalo_calibracion_dias || null,
      intervalo_calibracion_anos || null,
      incertidumbre_exp || null
    ]);

    if (req.user && req.user.id) {
      const fechaLog = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion, detalle) VALUES (?, ?, ?, ?, ?, ?)',
        ['MAT_VOLUMETRICOS', 'CREAR', req.user.id, fechaLog, `Creación de intervalo para volumétrico: ${codigo_material}`, JSON.stringify(req.body)]
      );
    }

    res.status(201).json({ message: 'Intervalo registrado correctamente' });
  } catch (error) {
    console.error('Error al registrar intervalo:', error);
    res.status(500).json({ message: 'Error al registrar intervalo', error: error.message });
  }
};

// Listar intervalo por material
exports.listarIntervaloPorMaterial = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.execute(
      'SELECT * FROM intervalo_volumetrico WHERE codigo_material = ? ORDER BY consecutivo',
      [codigo]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al listar intervalo:', error);
    res.status(500).json({ message: 'Error al listar intervalo', error: error.message });
  }
};

// Obtener siguiente consecutivo de intervalo
exports.obtenerNextIntervalo = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.execute(
      'SELECT MAX(consecutivo) as maxConsecutivo FROM intervalo_volumetrico WHERE codigo_material = ?',
      [codigo]
    );
    const maxConsecutivo = rows[0]?.maxConsecutivo || 0;
    res.json({ nextConsecutivo: maxConsecutivo + 1 });
  } catch (error) {
    console.error('Error al obtener siguiente consecutivo:', error);
    res.status(500).json({ message: 'Error al obtener siguiente consecutivo', error: error.message });
  }
};

// Actualizar intervalo
exports.actualizarIntervalo = async (req, res) => {
  try {
    const { codigo, consecutivo } = req.params;

    // 1. Obtener datos actuales
    const [rowsCurrent] = await pool.execute(
      'SELECT * FROM intervalo_volumetrico WHERE codigo_material = ? AND consecutivo = ?',
      [codigo, consecutivo]
    );
    if (rowsCurrent.length === 0) {
      return res.status(404).json({ message: 'Registro de intervalo no encontrado' });
    }
    const datosActuales = rowsCurrent[0];

    const allowedFields = [
      'valor_nominal', 'fecha_c1', 'error_c1', 'fecha_c2', 'error_c2',
      'diferencia_tiempo_dias', 'desviacion_abs', 'deriva', 'tolerancia',
      'intervalo_calibracion_dias', 'intervalo_calibracion_anos', 'incertidumbre_exp'
    ];
    
    const updates = [];
    const values = [];
    const datosNuevos = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
        datosNuevos[field] = req.body[field];
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No hay campos para actualizar' });
    }

    values.push(codigo, consecutivo);
    const sql = `UPDATE intervalo_volumetrico SET ${updates.join(', ')} WHERE codigo_material = ? AND consecutivo = ?`;
    
    await pool.execute(sql, values);

    // 2. Calcular diferencias y registrar log
    if (req.user && req.user.id) {
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

      const detallesCambios = Object.keys(cambios).length > 0 ? JSON.stringify(cambios) : null;
      
      const fechaLog = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion, detalle) VALUES (?, ?, ?, ?, ?, ?)',
        ['MAT_VOLUMETRICOS', 'ACTUALIZAR', req.user.id, fechaLog, `Actualización de intervalo para volumétrico: ${codigo}`, detallesCambios]
      );
    }

    const [updated] = await pool.execute(
      'SELECT * FROM intervalo_volumetrico WHERE codigo_material = ? AND consecutivo = ?',
      [codigo, consecutivo]
    );
    res.json(updated[0]);
  } catch (error) {
    console.error('Error al actualizar intervalo:', error);
    res.status(500).json({ message: 'Error al actualizar intervalo', error: error.message });
  }
};

// ==================== PDFs ====================

// Listar PDFs por material
exports.listarPdfsPorMaterial = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.execute(
      'SELECT id, material_id, categoria, nombre_archivo, fecha_subida FROM pdfs_material WHERE material_id = ? ORDER BY fecha_subida ASC',
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
    console.error('Error listar PDFs:', error);
    res.status(500).json({ message: 'Error listando PDFs', error: error.message });
  }
};

// Subir PDF para material
exports.subirPdfMaterial = async (req, res) => {
  try {
    const { codigo } = req.params;
    const categoria = req.body.categoria || null;
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'No se recibió archivo' });
    }
    const originalName = req.file.originalname || 'archivo.pdf';
    const buffer = req.file.buffer;
    const [result] = await pool.execute(
      'INSERT INTO pdfs_material (material_id, categoria, nombre_archivo, archivo, fecha_subida) VALUES (?, ?, ?, ?, NOW())',
      [codigo, categoria, originalName, buffer]
    );
    const insertedId = result.insertId;
    res.status(201).json({ id: insertedId, nombre_archivo: originalName, categoria });
  } catch (error) {
    console.error('Error subir PDF:', error);
    res.status(500).json({ message: 'Error subiendo PDF', error: error.message });
  }
};

// Descargar PDF por id
exports.descargarPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      'SELECT nombre_archivo, archivo FROM pdfs_material WHERE id = ? LIMIT 1',
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Archivo no encontrado' });
    const r = rows[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${r.nombre_archivo || 'archivo.pdf'}"`);
    res.send(r.archivo);
  } catch (error) {
    console.error('Error descargar PDF:', error);
    res.status(500).json({ message: 'Error descargando PDF', error: error.message });
  }
};

// Eliminar PDF por id
exports.eliminarPdf = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener info antes de eliminar para el log
    const [rows] = await pool.execute('SELECT material_id, nombre_archivo FROM pdfs_material WHERE id = ?', [id]);
    
    const [result] = await pool.execute('DELETE FROM pdfs_material WHERE id = ?', [id]);
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
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion, detalle) VALUES (?, ?, ?, ?, ?, ?)',
        ['MAT_VOLUMETRICOS', 'ELIMINAR', req.user.id, fechaLog, `Eliminación de PDF para volumétrico: ${pdfInfo.material_id}`, JSON.stringify({ id, ...pdfInfo })]
      );
    }

    res.json({ message: 'Archivo eliminado' });
  } catch (error) {
    console.error('Error eliminar PDF:', error);
    res.status(500).json({ message: 'Error eliminando PDF', error: error.message });
  }
};

exports.generarDocumentoVolumetrico = async (req, res) => {
  try {
    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ message: 'Plantilla requerida' });
    }

    const body = req.body || {};
    const codigo = String(body.codigo ?? body.codigo_id ?? body.codigo_material ?? '').trim();
    const todos = templateHasVolumetricosLoop(file.buffer);
    if (!todos && !codigo) {
      return res.status(400).json({ message: 'Debe enviar codigo' });
    }

    let dto = null;
    if (todos) {
      const materiales = await fetchVolumetricosLoopDTO();
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
        volumetricos: items,
        materiales: items
      };
    } else {
      dto = await fetchVolumetricoDocumentoDTO({ codigo });
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
      ? `volumetricos.${ext}`
      : `volumetrico_${safeFileComponent(code)}.${ext}`;

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

async function ensurePlantillasDocumentoVolumetricosTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plantillas_documento_volumetricos (
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

function getExtLower(filename) {
  const name = String(filename || '').toLowerCase();
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx) : '';
}

exports.listarPlantillasDocumentoVolumetrico = async (req, res) => {
  try {
    await ensurePlantillasDocumentoVolumetricosTable();
    const [rows] = await pool.query(
      `SELECT id, nombre, nombre_archivo, mime, size_bytes, usuario_id, fecha_subida
       FROM plantillas_documento_volumetricos
       ORDER BY fecha_subida DESC, id DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('Error GET /volumetricos/documentos/plantillas:', err);
    return res.status(500).json({ message: 'Error listando plantillas' });
  }
};

exports.subirPlantillaDocumentoVolumetrico = async (req, res) => {
  try {
    await ensurePlantillasDocumentoVolumetricosTable();
    const file = req.file;
    if (!file || !file.buffer) return res.status(400).json({ message: 'Debe enviar el archivo template' });

    const ext = getExtLower(file.originalname);
    if (ext !== '.docx' && ext !== '.xlsx') {
      return res.status(400).json({ message: 'Solo se permiten plantillas .xlsx o .docx' });
    }

    const nombreRaw = typeof (req.body || {}).nombre === 'string' ? String(req.body.nombre).trim() : '';
    const nombre = nombreRaw ? nombreRaw : null;
    const usuarioId = req.user && req.user.id ? Number(req.user.id) : null;
    const sizeBytes = Number.isFinite(file.size) ? file.size : (file.buffer ? file.buffer.length : null);

    const [result] = await pool.query(
      `INSERT INTO plantillas_documento_volumetricos (nombre, nombre_archivo, mime, size_bytes, archivo, usuario_id)
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
    console.error('Error POST /volumetricos/documentos/plantillas:', err);
    return res.status(500).json({ message: 'Error subiendo plantilla' });
  }
};

exports.eliminarPlantillaDocumentoVolumetrico = async (req, res) => {
  try {
    await ensurePlantillasDocumentoVolumetricosTable();
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: 'ID inválido' });

    const [result] = await pool.query('DELETE FROM plantillas_documento_volumetricos WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Plantilla no encontrada' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error DELETE /volumetricos/documentos/plantillas/:id:', err);
    return res.status(500).json({ message: 'Error eliminando plantilla' });
  }
};

exports.generarDocumentoVolumetricoDesdePlantilla = async (req, res) => {
  try {
    await ensurePlantillasDocumentoVolumetricosTable();
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: 'ID inválido' });

    const codigo = String((req.body || {}).codigo || '').trim();
    const todos = !!(req.body || {}).todos;
    if (!todos && !codigo) return res.status(400).json({ message: 'Debe enviar codigo' });

    const [rows] = await pool.query(
      'SELECT nombre_archivo, mime, archivo FROM plantillas_documento_volumetricos WHERE id = ? LIMIT 1',
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

    return exports.generarDocumentoVolumetrico(req, res);
  } catch (err) {
    console.error('Error POST /volumetricos/documentos/plantillas/:id/generar:', err);
    return res.status(500).json({ message: 'Error generando documento desde plantilla' });
  }
};
