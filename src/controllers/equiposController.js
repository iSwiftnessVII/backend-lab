const pool = require('../config/db');
const ExcelJS = require('exceljs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

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

function validateEquiposTags(tags) {
  const invalid = [];
  for (const tag of tags) {
    const t = String(tag ?? '').trim();
    if (t === '#historial' || t === '/historial' || t === '#intervalos' || t === '/intervalos') continue;
    const m = /^(equipo|ficha|historial_ultimo|intervalo_ultimo|historial|intervalos)\.([A-Za-z0-9_]+)$/.exec(t);
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

async function fetchEquipoDocumentoDTO({ codigo }) {
  const codigoNorm = String(codigo ?? '').trim();
  if (!codigoNorm) return null;

  const [equipoRows] = await pool.execute('SELECT * FROM hv_equipos WHERE codigo_identificacion = ? LIMIT 1', [codigoNorm]);
  if (!equipoRows || !equipoRows.length) return null;
  const equipo = toSafeRecord(equipoRows[0] || {});

  const [fichaRows] = await pool.execute(
    'SELECT * FROM ficha_tecnica_de_equipos WHERE codigo_identificador = ? ORDER BY fecha DESC LIMIT 1',
    [codigoNorm]
  );
  const ficha = toSafeRecord((fichaRows && fichaRows[0]) || {});

  const [histRows] = await pool.execute(
    'SELECT * FROM historial_hv WHERE equipo_id = ? ORDER BY consecutivo DESC LIMIT 500',
    [codigoNorm]
  );
  const historial = Array.isArray(histRows) ? histRows.map(toSafeRecord) : [];

  const [intRows] = await pool.execute(
    'SELECT * FROM intervalo_hv WHERE equipo_id = ? ORDER BY consecutivo DESC LIMIT 500',
    [codigoNorm]
  );
  const intervalos = Array.isArray(intRows) ? intRows.map(toSafeRecord) : [];

  const historial_ultimo = historial.length ? historial[0] : Object.create(null);
  const intervalo_ultimo = intervalos.length ? intervalos[0] : Object.create(null);

  return { equipo, ficha, historial, intervalos, historial_ultimo, intervalo_ultimo };
}

async function fetchTableColumns(tableName) {
  const t = String(tableName || '').trim();
  const allowed = new Set(['hv_equipos', 'ficha_tecnica_de_equipos', 'historial_hv', 'intervalo_hv']);
  if (!allowed.has(t)) {
    const e = new Error('Tabla no permitida');
    e.status = 400;
    throw e;
  }
  const [rows] = await pool.execute(`SHOW COLUMNS FROM ${t}`);
  const cols = Array.isArray(rows) ? rows.map((r) => String(r?.Field || '').trim()).filter(Boolean) : [];
  return cols.filter((c) => !isForbiddenKey(c));
}

function replaceExcelText(text, dto, ctx) {
  return String(text ?? '').replace(
    /{{\s*(equipo|ficha|historial_ultimo|intervalo_ultimo|historial|intervalos)\.([A-Za-z0-9_]+)\s*}}/g,
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

  const invalid = validateEquiposTags(tags);
  if (invalid.length) {
    const err = new Error('Plantilla contiene llaves no permitidas: ' + invalid.slice(0, 20).join(', '));
    err.status = 400;
    throw err;
  }

  workbook.eachSheet((sheet) => {
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

// Registrar intervalo de equipo
exports.crearIntervalo = async (req, res) => {
  try {
    const {
      consecutivo,
      equipo_id,
      unidad_nominal_g,
      calibracion_1,
      fecha_c1,
      error_c1_g,
      calibracion_2,
      fecha_c2,
      error_c2_g,
      diferencia_dias,
      desviacion,
      deriva,
      tolerancia_g,
      intervalo_calibraciones_dias,
      intervalo_calibraciones_anios
    } = req.body;

    const sql = `INSERT INTO intervalo_hv (
      consecutivo, equipo_id, unidad_nominal_g, calibracion_1, fecha_c1, error_c1_g, calibracion_2, fecha_c2, error_c2_g, diferencia_dias, desviacion, deriva, tolerancia_g, intervalo_calibraciones_dias, intervalo_calibraciones_anios
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await pool.execute(sql, [
      consecutivo,
      equipo_id,
      unidad_nominal_g,
      calibracion_1,
      fecha_c1,
      error_c1_g,
      calibracion_2,
      fecha_c2,
      error_c2_g,
      diferencia_dias,
      desviacion,
      deriva,
      tolerancia_g,
      intervalo_calibraciones_dias,
      intervalo_calibraciones_anios
    ]);

    res.status(201).json({ message: 'Intervalo registrado correctamente' });
  } catch (error) {
    console.error('Error al registrar intervalo:', error);
    res.status(500).json({ message: 'Error al registrar intervalo', error: error.message });
  }
};

// Registrar historial de equipo
exports.crearHistorial = async (req, res) => {
  try {
    const {
      consecutivo,
      equipo_id,
      fecha,
      tipo_historial,
      codigo_registro,
      tolerancia_g,
      tolerancia_error_g,
      incertidumbre_u,
      realizo,
      superviso,
      observaciones
    } = req.body;

    const sql = `INSERT INTO historial_hv (
      consecutivo, equipo_id, fecha, tipo_historial, codigo_registro, tolerancia_g, tolerancia_error_g, incertidumbre_u, realizo, superviso, observaciones
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await pool.execute(sql, [
      consecutivo,
      equipo_id,
      fecha,
      tipo_historial,
      codigo_registro,
      tolerancia_g,
      tolerancia_error_g,
      incertidumbre_u,
      realizo,
      superviso,
      observaciones
    ]);

    res.status(201).json({ message: 'Historial registrado correctamente' });
  } catch (error) {
    console.error('Error al registrar historial:', error);
    res.status(500).json({ message: 'Error al registrar historial', error: error.message });
  }
};

// Registrar un nuevo equipo
exports.crearEquipo = async (req, res) => {
  try {
    const {
      codigo_identificacion,
      nombre,
      modelo,
      marca,
      inventario_sena,
      ubicacion,
      acreditacion,
      tipo_manual,
      numero_serie,
      tipo,
      clasificacion,
      manual_usuario,
      puesta_en_servicio,
      fecha_adquisicion,
      requerimientos_equipo,
      elementos_electricos,
      voltaje,
      elementos_mecanicos,
      frecuencia,
      campo_medicion,
      exactitud,
      sujeto_verificar,
      sujeto_calibracion,
      resolucion_division,
      sujeto_calificacion,
      accesorios
    } = req.body;

    const sql = `INSERT INTO hv_equipos (
      codigo_identificacion, nombre, modelo, marca, inventario_sena, ubicacion, acreditacion, tipo_manual, numero_serie, tipo, clasificacion, manual_usuario, puesta_en_servicio, fecha_adquisicion, requerimientos_equipo, elementos_electricos, voltaje, elementos_mecanicos, frecuencia, campo_medicion, exactitud, sujeto_verificar, sujeto_calibracion, resolucion_division, sujeto_calificacion, accesorios
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await pool.execute(sql, [
      codigo_identificacion,
      nombre,
      modelo,
      marca,
      inventario_sena,
      ubicacion,
      acreditacion,
      tipo_manual,
      numero_serie,
      tipo,
      clasificacion,
      manual_usuario,
      puesta_en_servicio,
      fecha_adquisicion,
      requerimientos_equipo,
      elementos_electricos,
      voltaje,
      elementos_mecanicos,
      frecuencia,
      campo_medicion,
      exactitud,
      sujeto_verificar,
      sujeto_calibracion,
      resolucion_division,
      sujeto_calificacion,
      accesorios
    ]);

    res.status(201).json({ message: 'Equipo registrado correctamente' });
  } catch (error) {
    console.error('Error al registrar equipo:', error);
    res.status(500).json({ message: 'Error al registrar equipo', error: error.message });
  }
};

// Listar todos los equipos registrados con datos de ficha técnica
exports.listarEquipos = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        hv.codigo_identificacion,
        hv.nombre,
        hv.modelo,
        hv.marca,
        hv.inventario_sena,
        hv.ubicacion,
        hv.acreditacion,
        hv.tipo_manual,
        hv.numero_serie,
        hv.tipo,
        hv.clasificacion,
        hv.manual_usuario,
        hv.puesta_en_servicio,
        hv.fecha_adquisicion,
        hv.requerimientos_equipo,
        hv.elementos_electricos,
        hv.voltaje,
        hv.elementos_mecanicos,
        hv.frecuencia,
        hv.campo_medicion,
        hv.exactitud,
        hv.sujeto_verificar,
        hv.sujeto_calibracion,
        hv.resolucion_division,
        hv.sujeto_calificacion,
        hv.accesorios,
        ft.fabricante,
        ft.uso,
        ft.fecha_adq,
        ft.fecha_func,
        ft.precio,
        ft.manual_ope,
        ft.idioma_manual,
        ft.magnitud,
        ft.resolucion,
        ft.accesorios AS accesorios_ficha,
        ft.precision_med,
        ft.rango_de_medicion,
        ft.rango_de_uso,
        ft.potencia,
        ft.amperaje,
        ft.ancho,
        ft.alto,
        ft.peso_kg,
        ft.profundidad,
        ft.temperatura_c,
        ft.humedad_porcentaje,
        ft.limitaciones_e_interferencias,
        ft.otros,
        ft.especificaciones_software,
        ft.proveedor,
        ft.email,
        ft.telefono,
        ft.fecha_de_instalacion,
        ft.alcance_del_servicio,
        ft.garantia,
        ft.observaciones,
        ft.recibido_por,
        ft.fecha
      FROM hv_equipos hv
      LEFT JOIN ficha_tecnica_de_equipos ft 
        ON hv.codigo_identificacion = ft.codigo_identificador
      ORDER BY hv.codigo_identificacion
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error al listar equipos:', error);
    res.status(500).json({ message: 'Error al listar equipos', error: error.message });
  }
};

exports.actualizarEquipo = async (req, res) => {
  try {
    const { codigo } = req.params;
    const body = req.body || {};
    const allowed = [
      'nombre',
      'modelo',
      'marca',
      'inventario_sena',
      'ubicacion',
      'acreditacion',
      'tipo_manual',
      'numero_serie',
      'tipo',
      'clasificacion',
      'manual_usuario',
      'puesta_en_servicio',
      'fecha_adquisicion',
      'requerimientos_equipo',
      'elementos_electricos',
      'voltaje',
      'elementos_mecanicos',
      'frecuencia',
      'campo_medicion',
      'exactitud',
      'sujeto_verificar',
      'sujeto_calibracion',
      'resolucion_division',
      'sujeto_calificacion',
      'accesorios'
    ];
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Obtener datos actuales
      const [rowsCurrent] = await conn.execute('SELECT * FROM hv_equipos WHERE codigo_identificacion = ?', [codigo]);
      if (rowsCurrent.length === 0) {
        await conn.rollback();
        return res.status(404).json({ message: 'Equipo no encontrado' });
      }
      const datosActuales = rowsCurrent[0];

      const fields = [];
      const values = [];
      const datosNuevos = {};

      for (const key of Object.keys(body)) {
        if (allowed.includes(key)) {
          fields.push(`${key} = ?`);
          const val = typeof body[key] === 'undefined' ? null : body[key];
          values.push(val);
          datosNuevos[key] = val;
        }
      }
      if (!fields.length) {
        await conn.rollback();
        return res.status(400).json({ message: 'No hay campos para actualizar' });
      }
      values.push(codigo);
      const sql = `UPDATE hv_equipos SET ${fields.join(', ')} WHERE codigo_identificacion = ?`;
      const [result] = await conn.execute(sql, values);
      
      const [ftExists] = await conn.execute(
        'SELECT 1 FROM ficha_tecnica_de_equipos WHERE codigo_identificador = ? LIMIT 1',
        [codigo]
      );
      const ENABLE_SYNC = false;
      const ftFields = [];
      const ftValues = [];
      const syncKeys = ['nombre', 'marca', 'modelo', 'voltaje', 'frecuencia', 'accesorios', 'exactitud'];
      function sanitizeGeneral(val) {
        if (typeof val === 'undefined' || val === null) return null;
        if (typeof val === 'string' && val.trim() === '') return null;
        return val;
      }
      function sanitizeNumber(val) {
        if (typeof val === 'undefined' || val === null) return null;
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed === '') return null;
          // Extract first numeric pattern (supports decimals)
          const m = trimmed.match(/-?\d+(?:\.\d+)?/);
          if (m) {
            const n = parseFloat(m[0]);
            return isNaN(n) ? null : n;
          }
          return null;
        }
        return null;
      }
      function sanitizeDate(val) {
        if (typeof val === 'undefined' || val === null) return null;
        if (typeof val === 'string' && val.trim() === '') return null;
        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
        try {
          const d = new Date(val);
          if (!isNaN(d.getTime())) {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
          }
        } catch (_) { }
        return null;
      }
      for (const key of syncKeys) {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
          ftFields.push(`${key} = ?`);
          if (key === 'voltaje' || key === 'frecuencia') {
            ftValues.push(sanitizeNumber(body[key]));
          } else {
            ftValues.push(sanitizeGeneral(body[key]));
          }
        }
      }
      if (Object.prototype.hasOwnProperty.call(body, 'numero_serie')) {
        ftFields.push('serie = ?');
        ftValues.push(sanitizeGeneral(body['numero_serie']));
      }
      if (Object.prototype.hasOwnProperty.call(body, 'manual_usuario')) {
        ftFields.push('manual_ope = ?');
        ftValues.push(sanitizeGeneral(body['manual_usuario']));
      }
      if (Object.prototype.hasOwnProperty.call(body, 'fecha_adquisicion')) {
        ftFields.push('fecha_adq = ?');
        ftValues.push(sanitizeDate(body['fecha_adquisicion']));
      }
      if (Object.prototype.hasOwnProperty.call(body, 'puesta_en_servicio')) {
        ftFields.push('fecha_func = ?');
        ftValues.push(sanitizeDate(body['puesta_en_servicio']));
      }
      if (ENABLE_SYNC && ftFields.length) {
        if (ftExists.length > 0) {
          ftValues.push(codigo);
          const ftSql = `UPDATE ficha_tecnica_de_equipos SET ${ftFields.join(', ')} WHERE codigo_identificador = ?`;
          await conn.execute(ftSql, ftValues);
        } else {
          const cols = ['codigo_identificador', ...ftFields.map(f => f.split(' = ')[0])];
          const placeholders = new Array(cols.length).fill('?').join(', ');
          const insertSql = `INSERT INTO ficha_tecnica_de_equipos (${cols.join(', ')}) VALUES (${placeholders})`;
          await conn.execute(insertSql, [codigo, ...ftValues]);
        }
      }
      await conn.commit();

      // 4. Calcular diferencias
      let detallesCambios = null;
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

      if (Object.keys(cambios).length > 0) {
        detallesCambios = JSON.stringify(cambios);
      }

      if (req.user && req.user.id) {
        const fecha = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/Bogota',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date());
        
        // Usamos pool para el log, independiente de la transacción principal
        await pool.query(
          'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion, detalle) VALUES (?, ?, ?, ?, ?, ?)',
          ['EQUIPOS', 'ACTUALIZAR', req.user.id, fecha, `Actualización de equipo: ${codigo}`, detallesCambios]
        );
      }

      const [rows] = await conn.execute(
        `SELECT codigo_identificacion, nombre, modelo, marca, inventario_sena, ubicacion, acreditacion, tipo_manual, numero_serie, tipo, clasificacion, manual_usuario, puesta_en_servicio, fecha_adquisicion, requerimientos_equipo, elementos_electricos, voltaje, elementos_mecanicos, frecuencia, campo_medicion, exactitud, sujeto_verificar, sujeto_calibracion, resolucion_division, sujeto_calificacion, accesorios FROM hv_equipos WHERE codigo_identificacion = ?`,
        [codigo]
      );
      res.json(rows[0]);
    } catch (e) {
      try { await conn.rollback(); } catch (_) {}
      throw e;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Error actualizando equipo:', error);
    res.status(500).json({ message: 'Error al actualizar equipo', error: error.message });
  }
};

// Obtener siguiente consecutivo para historial (garantiza unicidad si PK global)
exports.obtenerNextHistorial = async (req, res) => {
  try {
    const { codigo } = req.params;
    // Próximo consecutivo por equipo (requiere PK compuesto equipo_id+consecutivo)
    const [rows] = await pool.execute('SELECT COALESCE(MAX(consecutivo),0)+1 AS next FROM historial_hv WHERE equipo_id = ?', [codigo]);
    res.json({ next: rows[0].next });
  } catch (error) {
    console.error('Error obteniendo siguiente consecutivo historial:', error);
    res.status(500).json({ message: 'Error obteniendo consecutivo historial', error: error.message });
  }
};

// Obtener siguiente consecutivo para intervalo
exports.obtenerNextIntervalo = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.execute('SELECT COALESCE(MAX(consecutivo),0)+1 AS next FROM intervalo_hv WHERE equipo_id = ?', [codigo]);
    res.json({ next: rows[0].next });
  } catch (error) {
    console.error('Error obteniendo siguiente consecutivo intervalo:', error);
    res.status(500).json({ message: 'Error obteniendo consecutivo intervalo', error: error.message });
  }
};

// Listar historial por equipo
exports.listarHistorialPorEquipo = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.execute(
      'SELECT * FROM historial_hv WHERE equipo_id = ? ORDER BY consecutivo DESC',
      [codigo]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error listando historial por equipo:', error);
    res.status(500).json({ message: 'Error listando historial', error: error.message });
  }
};

// Actualizar registro de historial por equipo y consecutivo
exports.actualizarHistorial = async (req, res) => {
  try {
    const { equipo, consecutivo } = req.params;
    const body = req.body || {};

    // Build dynamic SET clause
    const fields = [];
    const values = [];

    // Allowed updatable columns in historial_hv
    const allowed = [
      'fecha', 'tipo_historial', 'codigo_registro', 'tolerancia_g', 'tolerancia_error_g',
      'incertidumbre_u', 'realizo', 'superviso', 'observaciones'
    ];

    for (const key of Object.keys(body)) {
      if (allowed.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(body[key]);
      }
    }

    if (!fields.length) return res.status(400).json({ message: 'No hay campos para actualizar' });

    values.push(equipo);
    values.push(consecutivo);

    const sql = `UPDATE historial_hv SET ${fields.join(', ')} WHERE equipo_id = ? AND consecutivo = ?`;
    const [result] = await pool.execute(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Registro no encontrado' });
    }

    // Return the updated row
    const [rows] = await pool.execute('SELECT * FROM historial_hv WHERE equipo_id = ? AND consecutivo = ?', [equipo, consecutivo]);
    res.json(rows[0]);
  } catch (error) {
    console.error('Error actualizando historial:', error);
    res.status(500).json({ message: 'Error al actualizar historial', error: error.message });
  }
};

// Listar intervalo por equipo
exports.listarIntervaloPorEquipo = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.execute(
      'SELECT * FROM intervalo_hv WHERE equipo_id = ? ORDER BY consecutivo DESC',
      [codigo]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error listando intervalo por equipo:', error);
    res.status(500).json({ message: 'Error listando intervalo', error: error.message });
  }
};

// Actualizar registro de intervalo por equipo y consecutivo
exports.actualizarIntervalo = async (req, res) => {
  try {
    const { equipo, consecutivo } = req.params;
    const body = req.body || {};

    const fields = [];
    const values = [];

    // Allowed updatable columns in intervalo_hv
    const allowed = [
      'unidad_nominal_g', 'calibracion_1', 'fecha_c1', 'error_c1_g',
      'calibracion_2', 'fecha_c2', 'error_c2_g', 'diferencia_dias', 'desviacion',
      'deriva', 'tolerancia_g', 'intervalo_calibraciones_dias', 'intervalo_calibraciones_anios'
    ];

    for (const key of Object.keys(body)) {
      if (allowed.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(body[key]);
      }
    }

    if (!fields.length) return res.status(400).json({ message: 'No hay campos para actualizar' });

    values.push(equipo);
    values.push(consecutivo);

    const sql = `UPDATE intervalo_hv SET ${fields.join(', ')} WHERE equipo_id = ? AND consecutivo = ?`;
    const [result] = await pool.execute(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Registro no encontrado' });
    }

    const [rows] = await pool.execute('SELECT * FROM intervalo_hv WHERE equipo_id = ? AND consecutivo = ?', [equipo, consecutivo]);
    res.json(rows[0]);
  } catch (error) {
    console.error('Error actualizando intervalo:', error);
    res.status(500).json({ message: 'Error al actualizar intervalo', error: error.message });
  }
};

// Registrar ficha técnica
exports.crearFichaTecnica = async (req, res) => {
  try {
    const {
      codigo_identificador,
      nombre,
      marca,
      modelo,
      serie,
      fabricante,
      fecha_adq,
      uso,
      fecha_func,
      precio,
      accesorios,
      manual_ope,
      idioma_manual,
      magnitud,
      resolucion,
      precision_med,
      exactitud,
      rango_de_medicion,
      rango_de_uso,
      voltaje,
      potencia,
      amperaje,
      frecuencia,
      ancho,
      alto,
      peso_kg,
      profundidad,
      temperatura_c,
      humedad_porcentaje,
      limitaciones_e_interferencias,
      otros,
      especificaciones_software,
      proveedor,
      email,
      telefono,
      fecha_de_instalacion,
      alcance_del_servicio,
      garantia,
      observaciones,
      recibido_por,
      fecha
    } = req.body;

    // Archivo de firma recibido por multer (opcional)
    // Recibe la imagen de la firma como archivo (multer)
    const cargo_y_firma = req.file ? req.file.buffer : null;

    const [existsRows] = await pool.execute(
      'SELECT 1 FROM ficha_tecnica_de_equipos WHERE codigo_identificador = ? LIMIT 1',
      [codigo_identificador]
    );

    if (existsRows.length > 0) {
      const fields = [];
      const values = [];
      const map = [
        ['nombre', nombre],
        ['marca', marca],
        ['modelo', modelo],
        ['serie', serie],
        ['fabricante', fabricante],
        ['fecha_adq', fecha_adq],
        ['uso', uso],
        ['fecha_func', fecha_func],
        ['precio', precio],
        ['accesorios', accesorios],
        ['manual_ope', manual_ope],
        ['idioma_manual', idioma_manual],
        ['magnitud', magnitud],
        ['resolucion', resolucion],
        ['precision_med', precision_med],
        ['exactitud', exactitud],
        ['rango_de_medicion', rango_de_medicion],
        ['rango_de_uso', rango_de_uso],
        ['voltaje', voltaje],
        ['potencia', potencia],
        ['amperaje', amperaje],
        ['frecuencia', frecuencia],
        ['ancho', ancho],
        ['alto', alto],
        ['peso_kg', peso_kg],
        ['profundidad', profundidad],
        ['temperatura_c', temperatura_c],
        ['humedad_porcentaje', humedad_porcentaje],
        ['limitaciones_e_interferencias', limitaciones_e_interferencias],
        ['otros', otros],
        ['especificaciones_software', especificaciones_software],
        ['proveedor', proveedor],
        ['email', email],
        ['telefono', telefono],
        ['fecha_de_instalacion', fecha_de_instalacion],
        ['alcance_del_servicio', alcance_del_servicio],
        ['garantia', garantia],
        ['observaciones', observaciones],
        ['recibido_por', recibido_por],
        ['fecha', fecha]
      ];
      function sanitizeGeneral(val) {
        if (typeof val === 'undefined' || val === null) return null;
        if (typeof val === 'string' && val.trim() === '') return null;
        return val;
      }
      function sanitizeDate(val) {
        if (typeof val === 'undefined' || val === null) return null;
        if (typeof val === 'string' && val.trim() === '') return null;
        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
        try {
          const d = new Date(val);
          if (!isNaN(d.getTime())) {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
          }
        } catch (_) { }
        return null;
      }
      for (const [col, val] of map) {
        if (typeof val === 'undefined') continue;
        fields.push(`${col} = ?`);
        if (col === 'fecha_adq' || col === 'fecha_func') {
          values.push(sanitizeDate(val));
        } else {
          values.push(sanitizeGeneral(val));
        }
      }
      if (cargo_y_firma) {
        fields.push('cargo_y_firma = ?');
        values.push(cargo_y_firma);
      }
      if (!fields.length) {
        return res.status(400).json({ message: 'No hay campos para actualizar' });
      }
      values.push(codigo_identificador);
      const sql = `UPDATE ficha_tecnica_de_equipos SET ${fields.join(', ')} WHERE codigo_identificador = ?`;
      await pool.execute(sql, values);
      res.status(200).json({ message: 'Ficha técnica actualizada correctamente' });
    } else {
      function sanitize(val) {
        return typeof val === 'undefined' ? null : val;
      }
      const params = [
        codigo_identificador, nombre, marca, modelo, serie, fabricante, fecha_adq, uso,
        fecha_func, precio, accesorios, manual_ope, idioma_manual, magnitud, resolucion,
        precision_med, exactitud, rango_de_medicion, rango_de_uso, voltaje, potencia,
        amperaje, frecuencia, ancho, alto, peso_kg, profundidad, temperatura_c,
        humedad_porcentaje, limitaciones_e_interferencias, otros, especificaciones_software,
        proveedor, email, telefono, fecha_de_instalacion, alcance_del_servicio, garantia,
        observaciones, recibido_por, cargo_y_firma, fecha
      ].map(sanitize);
      const sql = `INSERT INTO ficha_tecnica_de_equipos (
        codigo_identificador, nombre, marca, modelo, serie, fabricante, fecha_adq, uso, 
        fecha_func, precio, accesorios, manual_ope, idioma_manual, magnitud, resolucion, 
        precision_med, exactitud, rango_de_medicion, rango_de_uso, voltaje, potencia, 
        amperaje, frecuencia, ancho, alto, peso_kg, profundidad, temperatura_c, 
        humedad_porcentaje, limitaciones_e_interferencias, otros, especificaciones_software, 
        proveedor, email, telefono, fecha_de_instalacion, alcance_del_servicio, garantia, 
        observaciones, recibido_por, cargo_y_firma, fecha
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      await pool.execute(sql, params);
      res.status(201).json({ message: 'Ficha técnica registrada correctamente' });
    }
  } catch (error) {
    console.error('Error al registrar ficha técnica:', error);
    res.status(500).json({ message: 'Error al registrar ficha técnica', error: error.message });
  }
};

exports.actualizarFichaTecnica = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [existsRows] = await pool.execute(
      'SELECT 1 FROM ficha_tecnica_de_equipos WHERE codigo_identificador = ? LIMIT 1',
      [codigo]
    );
    if (existsRows.length === 0) {
      return res.status(404).json({ message: 'Ficha técnica no encontrada' });
    }
    const cargo_y_firma = req.file ? req.file.buffer : null;
    const body = req.body || {};
    const columns = [
      'nombre', 'marca', 'modelo', 'serie', 'fabricante', 'fecha_adq', 'uso', 'fecha_func', 'precio',
      'accesorios', 'manual_ope', 'idioma_manual', 'magnitud', 'resolucion', 'precision_med', 'exactitud',
      'rango_de_medicion', 'rango_de_uso', 'voltaje', 'potencia', 'amperaje', 'frecuencia', 'ancho', 'alto',
      'peso_kg', 'profundidad', 'temperatura_c', 'humedad_porcentaje', 'limitaciones_e_interferencias', 'otros',
      'especificaciones_software', 'proveedor', 'email', 'telefono', 'fecha_de_instalacion', 'alcance_del_servicio',
      'garantia', 'observaciones', 'recibido_por', 'fecha'
    ];
    function sanitizeGeneral(val) {
      if (typeof val === 'undefined' || val === null) return null;
      if (typeof val === 'string' && val.trim() === '') return null;
      return val;
    }
    function sanitizeDate(val) {
      if (typeof val === 'undefined' || val === null) return null;
      if (typeof val === 'string' && val.trim() === '') return null;
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
      try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        }
      } catch (_) {}
      return null;
    }
    const fields = [];
    const values = [];
    for (const col of columns) {
      if (Object.prototype.hasOwnProperty.call(body, col)) {
        fields.push(`${col} = ?`);
        if (col === 'fecha_adq' || col === 'fecha_func' || col === 'fecha' || col === 'fecha_de_instalacion') {
          values.push(sanitizeDate(body[col]));
        } else {
          values.push(sanitizeGeneral(body[col]));
        }
      }
    }
    if (cargo_y_firma) {
      fields.push('cargo_y_firma = ?');
      values.push(cargo_y_firma);
    }
    if (!fields.length) {
      return res.status(400).json({ message: 'No hay campos para actualizar' });
    }
    values.push(codigo);
    const sql = `UPDATE ficha_tecnica_de_equipos SET ${fields.join(', ')} WHERE codigo_identificador = ?`;
    await pool.execute(sql, values);
    res.status(200).json({ message: 'Ficha técnica actualizada correctamente' });
  } catch (error) {
    console.error('Error al actualizar ficha técnica:', error);
    res.status(500).json({ message: 'Error al actualizar ficha técnica', error: error.message });
  }
};

// Obtener equipo completo por código
exports.obtenerEquipoCompleto = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.execute(
      `SELECT codigo_identificacion, nombre, marca, modelo, numero_serie, fecha_adquisicion, puesta_en_servicio, voltaje, frecuencia, accesorios FROM hv_equipos WHERE codigo_identificacion = ?`,
      [codigo]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Equipo no encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener equipo:', error);
    res.status(500).json({ message: 'Error al obtener equipo', error: error.message });
  }
};

exports.generarDocumentoEquipo = async (req, res) => {
  try {
    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ message: 'Plantilla requerida' });
    }

    const codigo = String((req.body || {}).codigo || '').trim();
    if (!codigo) {
      return res.status(400).json({ message: 'Debe enviar codigo' });
    }

    const dto = await fetchEquipoDocumentoDTO({ codigo });
    if (!dto) {
      return res.status(404).json({ message: 'Equipo no encontrado' });
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
    const code = dto?.equipo?.codigo_identificacion ?? codigo;
    const filename = `equipo_${safeFileComponent(code)}.${ext}`;

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

exports.descargarDiccionarioEquiposExcel = async (req, res) => {
  try {
    const [equipoCols, fichaCols, historialCols, intervaloCols] = await Promise.all([
      fetchTableColumns('hv_equipos'),
      fetchTableColumns('ficha_tecnica_de_equipos'),
      fetchTableColumns('historial_hv'),
      fetchTableColumns('intervalo_hv')
    ]);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Diccionario');
    sheet.columns = [
      { header: 'Llave', key: 'key', width: 48 },
      { header: 'Origen', key: 'origin', width: 34 }
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    sheet.addRow({ key: '{{#historial}}', origin: 'Inicio bloque historial (Excel)' });
    sheet.addRow({ key: '{{/historial}}', origin: 'Fin bloque historial (Excel)' });
    sheet.addRow({ key: '{{#intervalos}}', origin: 'Inicio bloque intervalos (Excel)' });
    sheet.addRow({ key: '{{/intervalos}}', origin: 'Fin bloque intervalos (Excel)' });

    for (const c of equipoCols) sheet.addRow({ key: `{{equipo.${c}}}`, origin: `hv_equipos.${c}` });
    for (const c of fichaCols) sheet.addRow({ key: `{{ficha.${c}}}`, origin: `ficha_tecnica_de_equipos.${c}` });
    for (const c of historialCols) sheet.addRow({ key: `{{historial_ultimo.${c}}}`, origin: `historial_hv (último).${c}` });
    for (const c of intervaloCols) sheet.addRow({ key: `{{intervalo_ultimo.${c}}}`, origin: `intervalo_hv (último).${c}` });
    for (const c of historialCols) sheet.addRow({ key: `{{historial.${c}}}`, origin: `historial_hv (loop).${c}` });
    for (const c of intervaloCols) sheet.addRow({ key: `{{intervalos.${c}}}`, origin: `intervalo_hv (loop).${c}` });

    const out = await workbook.xlsx.writeBuffer();
    const filename = 'diccionario_equipos.xlsx';
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(Buffer.from(out));
  } catch (err) {
    const status = err?.status ? Number(err.status) : 500;
    const message = err?.message || 'Error generando diccionario';
    return res.status(Number.isFinite(status) ? status : 500).json({ message });
  }
};

// Obtener fichas técnicas
exports.obtenerFichasTecnicas = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT codigo_identificador, nombre, marca, modelo 
      FROM ficha_tecnica_de_equipos 
      ORDER BY codigo_identificador
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener fichas técnicas:', error);
    res.status(500).json({ message: 'Error al obtener fichas técnicas', error: error.message });
  }
};

// Obtener imagen de cargo y firma por código identificador
exports.obtenerFirmaFicha = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.execute(
      'SELECT cargo_y_firma FROM ficha_tecnica_de_equipos WHERE codigo_identificador = ?',
      [codigo]
    );

    if (!rows.length || !rows[0].cargo_y_firma) {
      return res.status(404).json({ message: 'Firma no encontrada' });
    }

    const buffer = rows[0].cargo_y_firma;
    // Intentar detectar tipo (asumimos PNG si no hay metadatos)
    // Podríamos mejorar detectando magic numbers de JPEG/PNG
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error('Error al obtener firma:', error);
    res.status(500).json({ message: 'Error al obtener firma', error: error.message });
  }
};

// Eliminar equipo (con eliminación en cascada de dependencias)
exports.eliminarEquipo = async (req, res) => {
  const { codigo } = req.params;
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Eliminar dependencias primero
    await conn.execute('DELETE FROM historial_hv WHERE equipo_id = ?', [codigo]);
    await conn.execute('DELETE FROM intervalo_hv WHERE equipo_id = ?', [codigo]);
    await conn.execute('DELETE FROM ficha_tecnica_de_equipos WHERE codigo_identificador = ?', [codigo]);

    // Eliminar equipo
    const [result] = await conn.execute('DELETE FROM hv_equipos WHERE codigo_identificacion = ?', [codigo]);

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Equipo no encontrado' });
    }

    await conn.commit();
    res.json({ message: 'Equipo eliminado correctamente' });
  } catch (error) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    console.error('Error al eliminar equipo:', error);
    res.status(500).json({ message: 'Error al eliminar equipo', error: error.message });
  } finally {
    if (conn) conn.release();
  }
};

// PDFs handlers: simple filesystem-backed implementation
const fs = require('fs').promises;
const path = require('path');

const UPLOADS_BASE = path.join(__dirname, '..', '..', 'uploads', 'equipos');

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    // ignore
  }
}

// List PDFs for a given equipo (reads uploads/equipos/<codigo>)
exports.listarPdfsPorEquipo = async (req, res) => {
  try {
    const { codigo } = req.params;
    const dir = path.join(UPLOADS_BASE, String(codigo));
    try {
      await ensureDir(dir);
      const files = await fs.readdir(dir);
      const items = [];
      // Only consider actual files that are not the metadata JSONs
      const pdfFiles = files.filter(f => !f.endsWith('.meta.json') && !f.startsWith('.'));
      for (const f of pdfFiles) {
        const full = path.join(dir, f);
        const stat = await fs.stat(full);
        // Filename stored as <timestamp>_<originalname>
        const original = f.replace(/^\d+_/, '');
        // try read metadata JSON
        let categoria = null;
        try {
          const metaPath = path.join(dir, f + '.meta.json');
          const metaRaw = await fs.readFile(metaPath, 'utf8').catch(() => null);
          if (metaRaw) {
            const meta = JSON.parse(metaRaw);
            categoria = meta.categoria || null;
          }
        } catch (e) {
          categoria = null;
        }
        items.push({ id: f, nombre_archivo: original, url: `/api/equipos/pdfs/download/${encodeURIComponent(f)}`, categoria: categoria, size_bytes: stat.size, mime: 'application/pdf', fecha_subida: stat.mtime });
      }
      // sort by fecha_subida asc
      items.sort((a, b) => new Date(a.fecha_subida) - new Date(b.fecha_subida));
      res.json(items);
    } catch (e) {
      // If dir doesn't exist or other error, return empty list
      return res.json([]);
    }
  } catch (error) {
    console.error('Error listarPdfsPorEquipo:', error);
    res.status(500).json({ message: 'Error listando PDFs', error: error.message });
  }
};

// Upload PDF for equipo
exports.subirPdfEquipo = async (req, res) => {
  try {
    const { codigo } = req.params;
    const categoria = req.body.categoria || null;
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'No se recibió archivo' });
    }
    const dir = path.join(UPLOADS_BASE, String(codigo));
    await ensureDir(dir);
    const originalName = req.file.originalname || 'archivo.pdf';
    const filename = `${Date.now()}_${originalName.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
    const full = path.join(dir, filename);
    await fs.writeFile(full, req.file.buffer);
    // write metadata alongside file
    const meta = {
      originalName: originalName,
      categoria: categoria || null,
      mime: req.file.mimetype || 'application/pdf',
      size_bytes: req.file.size || (req.file.buffer ? req.file.buffer.length : null),
      fecha_subida: new Date().toISOString()
    };
    const metaPath = path.join(dir, filename + '.meta.json');
    try { await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8'); } catch (e) { console.warn('No se pudo escribir meta', e); }
    const stat = await fs.stat(full);
    const item = { id: filename, nombre_archivo: originalName, categoria: categoria || null, size_bytes: stat.size, mime: req.file.mimetype || 'application/pdf', url: `/api/equipos/pdfs/download/${encodeURIComponent(filename)}`, fecha_subida: stat.mtime };
    res.status(201).json(item);
  } catch (error) {
    console.error('Error subirPdfEquipo:', error);
    res.status(500).json({ message: 'Error subiendo PDF', error: error.message });
  }
};

// Download PDF by filename id
exports.descargarPdf = async (req, res) => {
  try {
    const { id } = req.params; // this is filename
    // find file under uploads/equipos subfolders
    const parts = id.split('_');
    // We don't know codigo from id, so scan directories (acceptable for small scale)
    const base = UPLOADS_BASE;
    let found = null;
    try {
      const dirs = await fs.readdir(base);
      for (const d of dirs) {
        const candidate = path.join(base, d, id);
        try {
          const stat = await fs.stat(candidate);
          if (stat && stat.isFile()) { found = candidate; break; }
        } catch (_) { }
      }
    } catch (e) {
      // base may not exist
    }
    if (!found) return res.status(404).json({ message: 'Archivo no encontrado' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', (await fs.stat(found)).size);
    // Stream the file
    const stream = require('fs').createReadStream(found);
    stream.on('error', (err) => {
      console.error('Error reading file', err);
      res.status(500).end();
    });
    stream.pipe(res);
  } catch (error) {
    console.error('Error descargarPdf:', error);
    res.status(500).json({ message: 'Error descargando PDF', error: error.message });
  }
};

// Delete PDF by filename id
exports.eliminarPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const base = UPLOADS_BASE;
    let found = null;
    try {
      const dirs = await fs.readdir(base);
      for (const d of dirs) {
        const candidate = path.join(base, d, id);
        try {
          const stat = await fs.stat(candidate);
          if (stat && stat.isFile()) { found = candidate; break; }
        } catch (_) { }
      }
    } catch (e) {
      // base may not exist
    }
    if (!found) return res.status(404).json({ message: 'Archivo no encontrado' });
    await fs.unlink(found);
    res.json({ message: 'Archivo eliminado' });
  } catch (error) {
    console.error('Error eliminarPdf:', error);
    res.status(500).json({ message: 'Error eliminando PDF', error: error.message });
  }
};

