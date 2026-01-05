const pool = require('../config/db');
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (_) { nodemailer = null; }
const ExcelJS = require('exceljs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

function templateHasReactivosLoop(templateBuffer) {
  try {
    const zip = new PizZip(templateBuffer);
    const re = /{{\s*#reactivos\s*}}/i;
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

// Helpers
function likeParam(q) {
  return `%${(q || '').toLowerCase()}%`;
}

// Sanitize helpers
function trimStr(v) {
  return typeof v === 'string' ? v.trim() : v;
}
function toNull(v) {
  const t = trimStr(v);
  return t === '' || t === undefined ? null : t;
}
function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

const ALLOWED_REACTIVO_FIELDS = new Set([
  'codigo',
  'nombre',
  'marca',
  'lote',
  'referencia',
  'cas',
  'presentacion',
  'cantidad_total',
  'fecha_adquisicion',
  'fecha_vencimiento',
  'tipo',
  'clasificacion',
  'unidad',
  'unidad_simbolo',
  'estado',
  'almacenamiento',
  'tipo_recipiente'
]);

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

function valueToText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return formatDateYMD(v);
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  return String(v);
}

async function fetchReactivoDTO({ codigo, lote }) {
  const loteNorm = String(lote || '').trim();
  const codigoNorm = String(codigo || '').trim();
  if (!codigoNorm && !loteNorm) return null;

  const where = ['r.activo = 1'];
  const params = [];
  if (loteNorm) {
    where.push('r.lote = ?');
    params.push(loteNorm);
  } else {
    where.push('r.codigo = ?');
    params.push(codigoNorm);
  }

  const [rows] = await pool.query(
    `
      SELECT
        r.codigo,
        r.nombre,
        r.marca,
        r.lote,
        r.referencia,
        r.cas,
        r.presentacion,
        r.cantidad_total,
        r.fecha_adquisicion,
        r.fecha_vencimiento,
        tr.nombre AS tipo,
        cs.nombre AS clasificacion,
        u.nombre AS unidad_simbolo,
        u.nombre AS unidad,
        ef.nombre AS estado,
        a.nombre AS almacenamiento,
        trc.nombre AS tipo_recipiente
      FROM reactivos r
      JOIN catalogo_reactivos c ON c.codigo = r.codigo
      LEFT JOIN tipo_reactivo tr ON tr.id = r.tipo_id
      LEFT JOIN clasificacion_sga cs ON cs.id = r.clasificacion_id
      LEFT JOIN unidades u ON u.id = r.unidad_id
      LEFT JOIN estado_fisico ef ON ef.id = r.estado_id
      LEFT JOIN almacenamiento a ON a.id = r.almacenamiento_id
      LEFT JOIN tipo_recipiente trc ON trc.id = r.tipo_recipiente_id
      WHERE ${where.join(' AND ')}
      ORDER BY r.fecha_creacion DESC
      LIMIT 1
    `,
    params
  );
  if (!rows || !rows.length) return null;

  const row = rows[0] || {};
  const reactivo = Object.create(null);
  reactivo.codigo = valueToText(row.codigo);
  reactivo.nombre = valueToText(row.nombre);
  reactivo.marca = valueToText(row.marca);
  reactivo.lote = valueToText(row.lote);
  reactivo.referencia = valueToText(row.referencia);
  reactivo.cas = valueToText(row.cas);
  reactivo.presentacion = row.presentacion ?? '';
  reactivo.cantidad_total = row.cantidad_total ?? '';
  reactivo.fecha_adquisicion = formatDateYMD(row.fecha_adquisicion);
  reactivo.fecha_vencimiento = formatDateYMD(row.fecha_vencimiento);
  reactivo.tipo = valueToText(row.tipo);
  reactivo.clasificacion = valueToText(row.clasificacion);
  reactivo.unidad = valueToText(row.unidad);
  reactivo.unidad_simbolo = valueToText(row.unidad_simbolo || row.unidad);
  reactivo.estado = valueToText(row.estado);
  reactivo.almacenamiento = valueToText(row.almacenamiento);
  reactivo.tipo_recipiente = valueToText(row.tipo_recipiente);
  return reactivo;
}

async function fetchReactivosLoopDTO({ limit } = {}) {
  const lim = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.min(20000, Number(limit)) : 5000;
  const [rows] = await pool.query(
    `
      SELECT
        r.codigo,
        r.nombre,
        r.marca,
        r.lote,
        r.referencia,
        r.cas,
        r.presentacion,
        r.cantidad_total,
        r.fecha_adquisicion,
        r.fecha_vencimiento,
        tr.nombre AS tipo,
        cs.nombre AS clasificacion,
        u.nombre AS unidad_simbolo,
        u.nombre AS unidad,
        ef.nombre AS estado,
        a.nombre AS almacenamiento,
        trc.nombre AS tipo_recipiente
      FROM reactivos r
      JOIN catalogo_reactivos c ON c.codigo = r.codigo
      LEFT JOIN tipo_reactivo tr ON tr.id = r.tipo_id
      LEFT JOIN clasificacion_sga cs ON cs.id = r.clasificacion_id
      LEFT JOIN unidades u ON u.id = r.unidad_id
      LEFT JOIN estado_fisico ef ON ef.id = r.estado_id
      LEFT JOIN almacenamiento a ON a.id = r.almacenamiento_id
      LEFT JOIN tipo_recipiente trc ON trc.id = r.tipo_recipiente_id
      WHERE r.activo = 1
      ORDER BY r.fecha_creacion DESC
      LIMIT ?
    `,
    [lim]
  );

  return (rows || []).map((row) => {
    const reactivo = Object.create(null);
    reactivo.codigo = valueToText(row.codigo);
    reactivo.nombre = valueToText(row.nombre);
    reactivo.marca = valueToText(row.marca);
    reactivo.lote = valueToText(row.lote);
    reactivo.referencia = valueToText(row.referencia);
    reactivo.cas = valueToText(row.cas);
    reactivo.presentacion = row.presentacion ?? '';
    reactivo.cantidad_total = row.cantidad_total ?? '';
    reactivo.fecha_adquisicion = formatDateYMD(row.fecha_adquisicion);
    reactivo.fecha_vencimiento = formatDateYMD(row.fecha_vencimiento);
    reactivo.tipo = valueToText(row.tipo);
    reactivo.clasificacion = valueToText(row.clasificacion);
    reactivo.unidad = valueToText(row.unidad);
    reactivo.unidad_simbolo = valueToText(row.unidad_simbolo || row.unidad);
    reactivo.estado = valueToText(row.estado);
    reactivo.almacenamiento = valueToText(row.almacenamiento);
    reactivo.tipo_recipiente = valueToText(row.tipo_recipiente);
    return reactivo;
  });
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

function validateTags(tags) {
  const invalid = [];
  for (const tag of tags) {
    const t = String(tag || '').trim();
    if (t === '#reactivos' || t === '/reactivos') continue;

    const m = /^(reactivo|reactivos)\.([A-Za-z0-9_]+)$/.exec(t);
    if (!m) {
      invalid.push(t);
      continue;
    }
    const field = m[2];
    if (!ALLOWED_REACTIVO_FIELDS.has(field)) invalid.push(t);
  }
  return invalid;
}

function replaceExcelText(text, dto, ctx) {
  return String(text ?? '').replace(/{{\s*(reactivo|reactivos)\.([A-Za-z0-9_]+)\s*}}/g, (_, scope, field) => {
    const s = String(scope || '').trim();
    const f = String(field || '').trim();
    if (!ALLOWED_REACTIVO_FIELDS.has(f)) return '';
    const src = ctx && ctx[s] ? ctx[s] : (dto && dto[s] ? dto[s] : null);
    return src ? valueToText(src[f]) : '';
  });
}

function clonePlain(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
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

async function generateXlsxFromTemplate(templateBuffer, data) {
  const dto = data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'reactivo')
    ? data
    : { reactivo: data || Object.create(null) };
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

  const invalid = validateTags(tags);
  if (invalid.length) {
    const err = new Error('Plantilla contiene llaves no permitidas: ' + invalid.slice(0, 20).join(', '));
    err.status = 400;
    throw err;
  }

  workbook.eachSheet((sheet) => {
    applyExcelLoop(sheet, 'reactivos', dto?.reactivos, dto);
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
  if (/^#reactivos$/.test(raw0) || /^\/reactivos$/.test(raw0)) return { get: () => '' };

  const raw = raw0.replace(/^[#/^]+/, '').trim();
  if (/^[A-Za-z0-9_]+$/.test(raw)) {
    const key = raw;
    if (!ALLOWED_REACTIVO_FIELDS.has(key)) {
      const e = new Error('Llave no permitida: ' + raw0);
      e.status = 400;
      throw e;
    }
    return {
      get: (scope) => {
        if (!scope || typeof scope !== 'object') return '';
        if (!Object.prototype.hasOwnProperty.call(scope, key)) return '';
        return scope[key];
      }
    };
  }

  const m = /^(reactivo|reactivos)\.([A-Za-z0-9_]+)$/.exec(raw);
  if (!m) {
    const e = new Error('Llave no permitida: ' + raw0);
    e.status = 400;
    throw e;
  }
  const field = m[2];
  if (!ALLOWED_REACTIVO_FIELDS.has(field)) {
    const e = new Error('Llave no permitida: ' + raw0);
    e.status = 400;
    throw e;
  }
  const scopeName = m[1];
  return {
    get: (scope) => {
      const r = scope && scope[scopeName] ? scope[scopeName] : null;
      return r ? r[field] : '';
    }
  };
}

async function generateDocxFromTemplate(templateBuffer, data) {
  const dto = data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'reactivo')
    ? data
    : { reactivo: data || Object.create(null) };
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

async function ensurePlantillasDocumentoReactivosTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plantillas_documento_reactivos (
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

const reactivosController = {
  // GET /api/reactivos/aux
  getAux: async (req, res) => {
    try {
      const [tipos] = await pool.query('SELECT id, nombre FROM tipo_reactivo ORDER BY nombre');
      const [clasif] = await pool.query('SELECT id, nombre FROM clasificacion_sga ORDER BY nombre');
      const [unidades] = await pool.query('SELECT id, nombre FROM unidades ORDER BY nombre');
      const [estado] = await pool.query('SELECT id, nombre FROM estado_fisico ORDER BY nombre');
      const [recipiente] = await pool.query('SELECT id, nombre FROM tipo_recipiente ORDER BY nombre');
      const [almacen] = await pool.query('SELECT id, nombre FROM almacenamiento ORDER BY id');
      res.json({ tipos, clasif, unidades, estado, recipiente, almacen });
    } catch (err) {
      console.error('Error /aux:', err);
      res.status(500).json({ message: 'Error obteniendo datos auxiliares' });
    }
  },
  // --- Catálogo de reactivos ---
  
   // GET /api/reactivos/catalogo?q=
  getCatalogo: async (req, res) => {
    const q = (req.query.q || '').trim();
    let limit = parseInt(req.query.limit, 10);
    let offset = parseInt(req.query.offset, 10);
    if (isNaN(limit) || limit <= 0) limit = 0;
    if (isNaN(offset) || offset < 0) offset = 0;
    if (limit > 500) limit = 500;
    
    try {
      const baseSelect = 'SELECT codigo, nombre, tipo_reactivo, clasificacion_sga, activo FROM catalogo_reactivos';
      const baseWhere = ' WHERE activo = 1';
      const where = q ? `${baseWhere} AND (LOWER(codigo) LIKE ? OR LOWER(nombre) LIKE ?)` : baseWhere;
      const order = ' ORDER BY codigo';
      
      if (limit > 0) {
        const countQuery = `SELECT COUNT(*) as total FROM catalogo_reactivos${where}`;
        let totalRows;
        if (q) {
          [totalRows] = await pool.query(countQuery, [likeParam(q), likeParam(q)]);
        } else {
          [totalRows] = await pool.query(countQuery);
        }
        const total = totalRows[0]?.total || 0;
        let rows;
        if (q) {
          [rows] = await pool.query(`${baseSelect}${where}${order} LIMIT ? OFFSET ?`, [likeParam(q), likeParam(q), limit, offset]);
        } else {
          [rows] = await pool.query(`${baseSelect}${where}${order} LIMIT ? OFFSET ?`, [limit, offset]);
        }
        return res.json({ rows, total });
      } else {
        let rows;
        if (q) {
          [rows] = await pool.query(`${baseSelect}${where}${order}`, [likeParam(q), likeParam(q)]);
        } else {
          [rows] = await pool.query(`${baseSelect}${where}${order}`);
        }
        return res.json(rows);
      }
    } catch (err) {
      console.error('Error GET /catalogo:', err);
      res.status(500).json({ message: 'Error buscando catálogo' });
    }
  },

  // GET /api/reactivos/catalogo/:codigo
  getCatalogoItem: async (req, res) => {
    const { codigo } = req.params;
    try {
      const [rows] = await pool.query(
        'SELECT codigo, nombre, tipo_reactivo, clasificacion_sga, activo FROM catalogo_reactivos WHERE codigo = ? AND activo = 1',
        [codigo]
      );
      if (!rows.length) return res.status(404).json({ message: 'No encontrado' });
      res.json(rows[0]);
    } catch (err) {
      console.error('Error GET /catalogo/:codigo:', err);
      res.status(500).json({ message: 'Error obteniendo catálogo' });
    }
  },

  // POST /api/reactivos/catalogo
  createCatalogo: async (req, res) => {
    const { codigo, nombre, tipo_reactivo, clasificacion_sga } = req.body || {};
    if (!codigo || !nombre || !tipo_reactivo || !clasificacion_sga) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }
    try {
      await pool.query(
        'INSERT INTO catalogo_reactivos (codigo, nombre, tipo_reactivo, clasificacion_sga, activo) VALUES (?, ?, ?, ?, 1)',
        [codigo, nombre, tipo_reactivo, clasificacion_sga]
      );
      if (req.user && req.user.id) {
        const fecha = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/Bogota',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date());
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha) VALUES (?, ?, ?, ?)',
          [req.user.id, 'CREAR', 'CATALOGO_REACTIVOS', fecha]
        );
      }
      res.status(201).json({ codigo, nombre, tipo_reactivo, clasificacion_sga });
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        try {
          const [exist] = await pool.query('SELECT activo FROM catalogo_reactivos WHERE codigo = ?', [codigo]);
          const activo = exist?.[0]?.activo;
          if (exist.length && (activo === 0 || activo === false)) {
            await pool.query(
              'UPDATE catalogo_reactivos SET nombre = ?, tipo_reactivo = ?, clasificacion_sga = ?, activo = 1 WHERE codigo = ?',
              [nombre, tipo_reactivo, clasificacion_sga, codigo]
            );
            return res.status(200).json({ codigo, nombre, tipo_reactivo, clasificacion_sga, reactivado: true });
          }
        } catch (_) {}
        return res.status(409).json({ message: 'Código ya existe en catálogo' });
      }
      console.error('Error POST /catalogo:', err);
      res.status(500).json({ message: 'Error creando catálogo' });
    }
  },

  // PUT /api/reactivos/catalogo/:codigo
  updateCatalogo: async (req, res) => {
    const { codigo } = req.params;
    const { nombre, tipo_reactivo, clasificacion_sga } = req.body || {};
    
    try {
      // 1. Obtener datos actuales
      const [rowsCurrent] = await pool.query('SELECT * FROM catalogo_reactivos WHERE codigo = ? AND activo = 1', [codigo]);
      if (rowsCurrent.length === 0) {
        return res.status(404).json({ message: 'No encontrado' });
      }
      const datosActuales = rowsCurrent[0];

      // 2. Preparar datos nuevos
      const datosNuevos = {
        nombre: nombre !== undefined ? nombre : datosActuales.nombre,
        tipo_reactivo: tipo_reactivo !== undefined ? tipo_reactivo : datosActuales.tipo_reactivo,
        clasificacion_sga: clasificacion_sga !== undefined ? clasificacion_sga : datosActuales.clasificacion_sga
      };

      // 3. Actualizar
      await pool.query(
        'UPDATE catalogo_reactivos SET nombre = ?, tipo_reactivo = ?, clasificacion_sga = ? WHERE codigo = ? AND activo = 1',
        [
          datosNuevos.nombre || null, 
          datosNuevos.tipo_reactivo || null, 
          datosNuevos.clasificacion_sga || null, 
          codigo
        ]
      );

      // 4. Calcular diferencias y registrar log
      if (req.user && req.user.id) {
        const cambios = {};
        const normalize = (val) => {
          if (val === null || val === undefined) return '';
          return String(val).trim();
        };

        const campos = ['nombre', 'tipo_reactivo', 'clasificacion_sga'];
        for (const key of campos) {
          const valAnt = normalize(datosActuales[key]);
          const valNuevo = normalize(datosNuevos[key]);
          if (valAnt !== valNuevo) {
            cambios[key] = {
              anterior: valAnt || '(vacío)',
              nuevo: valNuevo || '(vacío)'
            };
          }
        }

        const detallesCambios = Object.keys(cambios).length > 0 ? JSON.stringify(cambios) : null;
        
        const fecha = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/Bogota',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date());

        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion, detalle) VALUES (?, ?, ?, ?, ?, ?)',
          [req.user.id, 'ACTUALIZAR', 'CATALOGO_REACTIVOS', fecha, `Actualización de catálogo: ${codigo}`, detallesCambios]
        );
      }
      
      res.json({ 
        codigo, 
        nombre: datosNuevos.nombre || null, 
        tipo_reactivo: datosNuevos.tipo_reactivo || null, 
        clasificacion_sga: datosNuevos.clasificacion_sga || null 
      });
    } catch (err) {
      console.error('Error PUT /catalogo/:codigo:', err);
      res.status(500).json({ message: 'Error actualizando catálogo' });
    }
  },

deleteCatalogo: async (req, res) => {
    // VERIFICACIÓN POR ROL - Solo Administrador y Superadmin pueden eliminar
    if (req.user && req.user.rol !== 'Administrador' && req.user.rol !== 'Superadmin') {
      return res.status(403).json({ 
        message: 'No tienes permisos para eliminar del catálogo. Solo administradores pueden realizar esta acción.' 
      });
    }

    const { codigo } = req.params;
    try {
      // Pre-chequeo: evitar violar FK si existen reactivos con ese código (TU LÓGICA)
      const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM reactivos WHERE codigo = ? AND activo = 1', [codigo]);
      const cnt = rows?.[0]?.cnt || 0;
      if (cnt > 0) {
        return res.status(409).json({
          message: `No se puede eliminar del catálogo: existen ${cnt} reactivo(s) que referencian este código`,
          codigo,
          dependientes: cnt
        });
      }

      const [result] = await pool.query('UPDATE catalogo_reactivos SET activo = 0 WHERE codigo = ? AND activo = 1', [codigo]);
      if (result.affectedRows === 0) {
        const [exists] = await pool.query('SELECT codigo FROM catalogo_reactivos WHERE codigo = ?', [codigo]);
        if (!exists.length) return res.status(404).json({ message: 'No encontrado' });
        return res.json({ message: 'Eliminado del catálogo' });
      }

      // REGISTRO DE LOG - Solo si hay usuario autenticado
      if (req.user && req.user.id) {
        const fecha = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/Bogota',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date());
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha) VALUES (?, ?, ?, ?)',
          [req.user.id, 'ELIMINAR', 'CATALOGO_REACTIVOS', fecha]
        );
      }

      res.json({ message: 'Eliminado del catálogo' });
    } catch (err) {
      console.error('Error DELETE /catalogo/:codigo:', err);
      res.status(500).json({ message: 'Error eliminando del catálogo' });
    }
  },

  // --- PDFs: Hoja de Seguridad ---

  // GET availability (por código en catálogo) - consulta por join a lote
  getHojaSeguridad: async (req, res) => {
    const { codigo } = req.params;
    try {
      const [rows] = await pool.query(
        `SELECT hs.id
         FROM hoja_seguridad hs
         JOIN reactivos r ON r.lote = hs.lote
         WHERE r.codigo = ? AND r.activo = 1 AND hs.contenido_pdf IS NOT NULL
         ORDER BY hs.fecha_subida DESC
         LIMIT 1`,
        [codigo]
      );
      if (!rows.length) return res.status(404).json({ message: 'No encontrada' });
      return res.json({ url: `catalogo/${encodeURIComponent(codigo)}/hoja-seguridad/view` });
    } catch (err) {
      console.error('Error GET /hoja-seguridad (por codigo):', err);
      res.status(500).json({ message: 'Error consultando hoja de seguridad' });
    }
  },

  // VIEW stream (por código) - devolver el último PDF asociado a cualquier lote con ese código
  viewHojaSeguridad: async (req, res) => {
    const { codigo } = req.params;
    try {
      const [rows] = await pool.query(
        `SELECT hs.contenido_pdf
         FROM hoja_seguridad hs
         JOIN reactivos r ON r.lote = hs.lote
         WHERE r.codigo = ? AND r.activo = 1
         ORDER BY hs.fecha_subida DESC
         LIMIT 1`,
        [codigo]
      );
      if (!rows.length || !rows[0].contenido_pdf) return res.status(404).type('text/plain').send('PDF no encontrado');
      res.setHeader('Content-Type', 'application/pdf');
      res.send(rows[0].contenido_pdf);
    } catch (err) {
      console.error('Error VIEW /hoja-seguridad (por codigo):', err);
      res.status(500).type('text/plain').send('Error obteniendo PDF');
    }
  },

  // POST upload (catálogo) - no soportado con esquema por lote
  uploadHojaSeguridad: async (req, res) => {
    return res.status(400).json({ message: 'Subida por catálogo no soportada. Suba el PDF por lote: /api/reactivos/:lote/hoja-seguridad' });
  },

  // DELETE (catálogo) - no soportado con esquema por lote
  deleteHojaSeguridad: async (req, res) => {
    return res.status(400).json({ message: 'Eliminación por catálogo no soportada. Elimine el PDF por lote: /api/reactivos/:lote/hoja-seguridad' });
  },

  // --- PDFs por LOTE ---
  getHojaSeguridadByLote: async (req, res) => {
    const { lote } = req.params;
    try {
      const [rows] = await pool.query('SELECT id FROM hoja_seguridad WHERE lote = ? AND contenido_pdf IS NOT NULL', [lote]);
      if (!rows.length) return res.status(404).json({ message: 'No encontrada' });
      return res.json({ url: `${encodeURIComponent(lote)}/hoja-seguridad/view` });
    } catch (err) {
      console.error('Error GET /:lote/hoja-seguridad:', err);
      res.status(500).json({ message: 'Error consultando hoja de seguridad' });
    }
  },
  viewHojaSeguridadByLote: async (req, res) => {
    const { lote } = req.params;
    try {
      const [rows] = await pool.query('SELECT contenido_pdf FROM hoja_seguridad WHERE lote = ?', [lote]);
      if (!rows.length || !rows[0].contenido_pdf) return res.status(404).type('text/plain').send('PDF no encontrado');
      res.setHeader('Content-Type', 'application/pdf');
      res.send(rows[0].contenido_pdf);
    } catch (err) {
      console.error('Error VIEW /:lote/hoja-seguridad:', err);
      res.status(500).type('text/plain').send('Error obteniendo PDF');
    }
  },
  uploadHojaSeguridadByLote: async (req, res) => {
    const { lote } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'Archivo requerido' });
    const name = file.originalname || '';
    const mimetype = file.mimetype || '';
    if (!/pdf/i.test(mimetype) && !name.toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({ message: 'Archivo no es un PDF válido' });
    }
    if (!file.buffer || String(file.buffer.slice(0,4).toString('utf8')) !== '%PDF') {
        return res.status(400).json({ message: 'Archivo no es un PDF válido' });
    }
    try {
        await pool.query(
            `INSERT INTO hoja_seguridad (lote, hoja_seguridad, contenido_pdf)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE hoja_seguridad = VALUES(hoja_seguridad), contenido_pdf = VALUES(contenido_pdf), fecha_subida = CURRENT_TIMESTAMP`,
            [lote, file.originalname || 'hoja_seguridad.pdf', file.buffer]
        );

        // REGISTRO DE LOG - MODIFICADO
        if (req.user && req.user.id) {
            const fecha = new Intl.DateTimeFormat('sv-SE', {
                timeZone: 'America/Bogota',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            }).format(new Date());
            await pool.query(
                'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha) VALUES (?, ?, ?, ?)',
                [req.user.id, 'SUBIR_PDF', 'REACTIVOS', fecha]
            );
        }

        res.status(201).json({ url: `${encodeURIComponent(lote)}/hoja-seguridad/view` });
    } catch (err) {
        console.error('Error POST /:lote/hoja-seguridad:', err);
        res.status(500).json({ message: 'Error subiendo PDF' });
    }
  },

  deleteHojaSeguridadByLote: async (req, res) => {
    // VERIFICACIÓN POR ROL - MODIFICADO
    if (req.user && req.user.rol !== 'Administrador' && req.user.rol !== 'Superadmin') {
        return res.status(403).json({ message: 'No tienes permisos para eliminar hojas de seguridad. Solo administradores.' });
    }
    const { lote } = req.params;
    try {
        const [result] = await pool.query('DELETE FROM hoja_seguridad WHERE lote = ?', [lote]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'No encontrada' });

        // REGISTRO DE LOG - MODIFICADO
        if (req.user && req.user.id) {
            await pool.query(
                'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha) VALUES (?, ?, ?, DATE_SUB(NOW(), INTERVAL 5 HOUR))',
                [req.user.id, 'ELIMINAR_PDF', 'REACTIVOS']
            );
        }

        res.json({ message: 'Eliminada' });
    } catch (err) {
        console.error('Error DELETE /:lote/hoja-seguridad:', err);
        res.status(500).json({ message: 'Error eliminando PDF' });
    }
},

  // --- PDFs: Certificado de análisis ---

  // Disponibilidad por código (catálogo) usando join
  getCertAnalisis: async (req, res) => {
    const { codigo } = req.params;
    try {
      const [rows] = await pool.query(
        `SELECT ca.id
         FROM cert_analisis ca
         JOIN reactivos r ON r.lote = ca.lote
         WHERE r.codigo = ? AND r.activo = 1 AND ca.contenido_pdf IS NOT NULL
         ORDER BY ca.fecha_subida DESC
         LIMIT 1`,
        [codigo]
      );
      if (!rows.length) return res.status(404).json({ message: 'No encontrado' });
      return res.json({ url: `catalogo/${encodeURIComponent(codigo)}/cert-analisis/view` });
    } catch (err) {
      console.error('Error GET /cert-analisis (por codigo):', err);
      res.status(500).json({ message: 'Error consultando certificado' });
    }
  },

  viewCertAnalisis: async (req, res) => {
    const { codigo } = req.params;
    try {
      const [rows] = await pool.query(
        `SELECT ca.contenido_pdf
         FROM cert_analisis ca
         JOIN reactivos r ON r.lote = ca.lote
         WHERE r.codigo = ? AND r.activo = 1
         ORDER BY ca.fecha_subida DESC
         LIMIT 1`,
        [codigo]
      );
      if (!rows.length || !rows[0].contenido_pdf) return res.status(404).type('text/plain').send('PDF no encontrado');
      res.setHeader('Content-Type', 'application/pdf');
      res.send(rows[0].contenido_pdf);
    } catch (err) {
      console.error('Error VIEW /cert-analisis (por codigo):', err);
      res.status(500).type('text/plain').send('Error obteniendo PDF');
    }
  },

  // Subida/Eliminación por catálogo no soportadas con esquema por lote
  uploadCertAnalisis: async (req, res) => {
    return res.status(400).json({ message: 'Subida por catálogo no soportada. Suba el PDF por lote: /api/reactivos/:lote/cert-analisis' });
  },
  deleteCertAnalisis: async (req, res) => {
    return res.status(400).json({ message: 'Eliminación por catálogo no soportada. Elimine el PDF por lote: /api/reactivos/:lote/cert-analisis' });
  },

  // Endpoints por lote
  getCertAnalisisByLote: async (req, res) => {
    const { lote } = req.params;
    try {
      const [rows] = await pool.query('SELECT id FROM cert_analisis WHERE lote = ? AND contenido_pdf IS NOT NULL', [lote]);
      if (!rows.length) return res.status(404).json({ message: 'No encontrado' });
      return res.json({ url: `${encodeURIComponent(lote)}/cert-analisis/view` });
    } catch (err) {
      console.error('Error GET /:lote/cert-analisis:', err);
      res.status(500).json({ message: 'Error consultando certificado' });
    }
  },
  viewCertAnalisisByLote: async (req, res) => {
    const { lote } = req.params;
    try {
      const [rows] = await pool.query('SELECT contenido_pdf FROM cert_analisis WHERE lote = ?', [lote]);
      if (!rows.length || !rows[0].contenido_pdf) return res.status(404).type('text/plain').send('PDF no encontrado');
      res.setHeader('Content-Type', 'application/pdf');
      res.send(rows[0].contenido_pdf);
    } catch (err) {
      console.error('Error VIEW /:lote/cert-analisis:', err);
      res.status(500).type('text/plain').send('Error obteniendo PDF');
    }
  },
  uploadCertAnalisisByLote: async (req, res) => {
  const { lote } = req.params;
  const file = req.file;
  if (!file) return res.status(400).json({ message: 'Archivo requerido' });
  const name = file.originalname || '';
  const mimetype = file.mimetype || '';
  if (!/pdf/i.test(mimetype) && !name.toLowerCase().endsWith('.pdf')) {
    return res.status(400).json({ message: 'Archivo no es un PDF válido' });
  }
  if (!file.buffer || String(file.buffer.slice(0,4).toString('utf8')) !== '%PDF') {
    return res.status(400).json({ message: 'Archivo no es un PDF válido' });
  }
  try {
    await pool.query(
      `INSERT INTO cert_analisis (lote, certificado_analisis, contenido_pdf)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE certificado_analisis = VALUES(certificado_analisis), contenido_pdf = VALUES(contenido_pdf), fecha_subida = CURRENT_TIMESTAMP`,
      [lote, file.originalname || 'cert_analisis.pdf', file.buffer]
    );

    // REGISTRO DE LOG - MODIFICAR
    if (req.user && req.user.id) {
      await pool.query(
        'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha) VALUES (?, ?, ?, DATE_SUB(NOW(), INTERVAL 5 HOUR))',
        [req.user.id, 'SUBIR_PDF', 'REACTIVOS']
      );
    }

    res.status(201).json({ url: `${encodeURIComponent(lote)}/cert-analisis/view` });
  } catch (err) {
    console.error('Error POST /:lote/cert-analisis:', err);
    res.status(500).json({ message: 'Error subiendo PDF' });
  }
},

  deleteCertAnalisisByLote: async (req, res) => {
  // VERIFICACIÓN POR ROL - MODIFICAR
  if (req.user && req.user.rol !== 'Administrador' && req.user.rol !== 'Superadmin') {
    return res.status(403).json({ message: 'No tienes permisos para eliminar certificados. Solo administradores.' });
  }
  const { lote } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM cert_analisis WHERE lote = ?', [lote]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'No encontrado' });

    // REGISTRO DE LOG - MODIFICAR
    if (req.user && req.user.id) {
      const fecha = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      await pool.query(
        'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha) VALUES (?, ?, ?, ?)',
        [req.user.id, 'ELIMINAR_PDF', 'REACTIVOS', fecha]
      );
    }

    res.json({ message: 'Eliminado' });
  } catch (err) {
    console.error('Error DELETE /:lote/cert-analisis:', err);
    res.status(500).json({ message: 'Error eliminando PDF' });
  }
},

  // --- Reactivos (CRUD) ---

  // GET /api/reactivos?q=
  getReactivos: async (req, res) => {
    const q = (req.query.q || '').trim().toLowerCase();
    let limit = parseInt(req.query.limit, 10);
    let offset = parseInt(req.query.offset, 10);
    if (isNaN(limit) || limit <= 0) limit = 0;
    if (isNaN(offset) || offset < 0) offset = 0;
    if (limit > 500) limit = 500;

    try {
      const conditions = ['activo = 1'];
      const params = [];
      if (q) {
        conditions.push('(LOWER(lote) LIKE ? OR LOWER(codigo) LIKE ? OR LOWER(nombre) LIKE ? OR LOWER(marca) LIKE ?)');
        params.push(likeParam(q), likeParam(q), likeParam(q), likeParam(q));
      }
      const whereClause = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
      const baseSelect = 'SELECT * FROM reactivos' + whereClause;
      const orderClause = ' ORDER BY fecha_creacion DESC';

      // Sin límite: devolver array completo (comportamiento existente)
      if (limit === 0) {
        const [rows] = await pool.query(baseSelect + orderClause, params);
        return res.json(rows);
      }

      // Con límite: devolver objeto { rows, total }
      let total = 0;
      const countSql = 'SELECT COUNT(*) AS total FROM reactivos' + whereClause;
      const [countRows] = await pool.query(countSql, params);
      total = countRows[0]?.total || 0;
      const [rows] = await pool.query(baseSelect + orderClause + ' LIMIT ? OFFSET ?', [...params, limit, offset]);
      return res.json({ rows, total });
    } catch (err) {
      console.error('Error GET / (reactivos):', err);
      res.status(500).json({ message: 'Error listando reactivos' });
    }
  },

  // GET /api/reactivos/total - devuelve solo el total de filas (uso liviano para fallback en frontend)
  getReactivosTotal: async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT COUNT(*) AS total FROM reactivos WHERE activo = 1');
      const total = rows[0]?.total || 0;
      res.json({ total });
    } catch (err) {
      console.error('Error GET /total (reactivos):', err);
      res.status(500).json({ message: 'Error obteniendo total de reactivos' });
    }
  },

  // GET /api/reactivos/:lote
  getReactivoByLote: async (req, res) => {
    const { lote } = req.params;
    try {
      const [rows] = await pool.query('SELECT * FROM reactivos WHERE lote = ? AND activo = 1', [lote]);
      if (!rows.length) return res.status(404).json({ message: 'No encontrado' });
      res.json(rows[0]);
    } catch (err) {
      console.error('Error GET /:lote:', err);
      res.status(500).json({ message: 'Error obteniendo reactivo' });
    }
  },

  // POST /api/reactivos
  createReactivo: async (req, res) => {
    const r = req.body || {};
    try {
      const lote = trimStr(r.lote);
      const codigo = trimStr(r.codigo);
      const nombre = trimStr(r.nombre);
      if (!lote || !codigo || !nombre) {
        return res.status(400).json({ message: 'Faltan campos requeridos: lote, codigo, nombre' });
      }

      const presentacion = numOrNull(r.presentacion);
      const presentacion_cant = numOrNull(r.presentacion_cant);
      let cantidad_total = r.cantidad_total != null ? numOrNull(r.cantidad_total) : null;
      if (cantidad_total == null && presentacion != null && presentacion_cant != null) {
        cantidad_total = Number((presentacion * presentacion_cant).toFixed(4));
      }

      const marca = toNull(r.marca);
      const referencia = toNull(r.referencia);
      const cas = toNull(r.cas);
      const fecha_adquisicion = toNull(r.fecha_adquisicion);
      const fecha_vencimiento = toNull(r.fecha_vencimiento);
      const observaciones = toNull(r.observaciones);
      const tipo_id = numOrNull(r.tipo_id);
      const clasificacion_id = numOrNull(r.clasificacion_id);
      const unidad_id = numOrNull(r.unidad_id);
      const estado_id = numOrNull(r.estado_id);
      const almacenamiento_id = numOrNull(r.almacenamiento_id);
      const tipo_recipiente_id = numOrNull(r.tipo_recipiente_id);

      await pool.query(
        `INSERT INTO reactivos (
          lote, codigo, nombre, marca, referencia, cas, presentacion, presentacion_cant, cantidad_total,
          fecha_adquisicion, fecha_vencimiento, observaciones, tipo_id, clasificacion_id, unidad_id, estado_id,
          almacenamiento_id, tipo_recipiente_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          lote, codigo, nombre, marca, referencia, cas,
          presentacion, presentacion_cant, cantidad_total,
          fecha_adquisicion, fecha_vencimiento, observaciones,
          tipo_id, clasificacion_id, unidad_id, estado_id, almacenamiento_id, tipo_recipiente_id
        ]
      );

      // REGISTRO DE LOG - MODIFICADO
        if (req.user && req.user.id) {
            await pool.query(
                'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha) VALUES (?, ?, ?, DATE_SUB(NOW(), INTERVAL 5 HOUR))',
                [req.user.id, 'CREAR', 'REACTIVOS']
            );

            // REGISTRO DE MOVIMIENTO
            await pool.query(
                'INSERT INTO movimientos_inventario (producto_tipo, producto_referencia, usuario_id, tipo_movimiento, fecha) VALUES (?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 5 HOUR))',
                ['REACTIVO', lote, req.user.id, 'ENTRADA']
            );
        }
    
      res.status(201).json({ message: 'Creado' });
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'Lote ya existe' });
      }
      console.error('Error POST / (reactivos):', err);
      res.status(500).json({ message: 'Error creando reactivo' });
    }
  },

  // PUT /api/reactivos/:lote
  updateReactivo: async (req, res) => {
    const { lote } = req.params;
    const r = req.body || {};
    try {
      // 1. Obtener datos actuales
      const [rowsCurrent] = await pool.query('SELECT * FROM reactivos WHERE lote = ? AND activo = 1', [lote]);
      if (rowsCurrent.length === 0) {
        return res.status(404).json({ message: 'No encontrado' });
      }
      const datosActuales = rowsCurrent[0];

      // 2. Preparar datos nuevos (Lógica existente)
      const codigo = trimStr(r.codigo);
      const nombre = trimStr(r.nombre);
      const presentacion = numOrNull(r.presentacion);
      const presentacion_cant = numOrNull(r.presentacion_cant);
      let cantidad_total = r.cantidad_total != null ? numOrNull(r.cantidad_total) : null;
      if (cantidad_total == null && presentacion != null && presentacion_cant != null) {
        cantidad_total = Number((presentacion * presentacion_cant).toFixed(4));
      }

      const marca = toNull(r.marca);
      const referencia = toNull(r.referencia);
      const cas = toNull(r.cas);
      const fecha_adquisicion = toNull(r.fecha_adquisicion);
      const fecha_vencimiento = toNull(r.fecha_vencimiento);
      const observaciones = toNull(r.observaciones);
      const tipo_id = numOrNull(r.tipo_id);
      const clasificacion_id = numOrNull(r.clasificacion_id);
      const unidad_id = numOrNull(r.unidad_id);
      const estado_id = numOrNull(r.estado_id);
      const almacenamiento_id = numOrNull(r.almacenamiento_id);
      const tipo_recipiente_id = numOrNull(r.tipo_recipiente_id);

      const datosNuevos = {
        codigo, nombre, marca, referencia, cas, presentacion, presentacion_cant, cantidad_total,
        fecha_adquisicion, fecha_vencimiento, observaciones, tipo_id, clasificacion_id, unidad_id, estado_id,
        almacenamiento_id, tipo_recipiente_id
      };

      // 3. Actualizar
      await pool.query(
        `UPDATE reactivos SET
          codigo = ?, nombre = ?, marca = ?, referencia = ?, cas = ?, presentacion = ?, presentacion_cant = ?, cantidad_total = ?,
          fecha_adquisicion = ?, fecha_vencimiento = ?, observaciones = ?, tipo_id = ?, clasificacion_id = ?, unidad_id = ?, estado_id = ?,
          almacenamiento_id = ?, tipo_recipiente_id = ?
        WHERE lote = ? AND activo = 1`,
        [
          codigo, nombre, marca, referencia, cas, presentacion, presentacion_cant, cantidad_total,
          fecha_adquisicion, fecha_vencimiento, observaciones, tipo_id, clasificacion_id, unidad_id, estado_id,
          almacenamiento_id, tipo_recipiente_id, lote
        ]
      );

      // 4. Calcular diferencias y registrar log
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

        // Enriquecer IDs con nombres para el log
        const idFields = {
            unidad_id: { table: 'unidades', label: 'unidad' },
            tipo_id: { table: 'tipo_reactivo', label: 'tipo' },
            clasificacion_id: { table: 'clasificacion_sga', label: 'clasificacion' },
            estado_id: { table: 'estado_fisico', label: 'estado' },
            almacenamiento_id: { table: 'almacenamiento', label: 'almacenamiento' },
            tipo_recipiente_id: { table: 'tipo_recipiente', label: 'recipiente' }
        };

        for (const [field, config] of Object.entries(idFields)) {
            if (cambios[field]) {
                const oldId = datosActuales[field];
                const newId = datosNuevos[field];
                const ids = [oldId, newId].filter(id => id != null);
                
                if (ids.length > 0) {
                    try {
                        const [rows] = await pool.query(`SELECT id, nombre FROM ${config.table} WHERE id IN (?)`, [ids]);
                        const nameMap = {};
                        rows.forEach(r => nameMap[r.id] = r.nombre);

                        cambios[config.label] = {
                            anterior: (oldId ? (nameMap[oldId] || oldId) : '(vacío)'),
                            nuevo: (newId ? (nameMap[newId] || newId) : '(vacío)')
                        };
                        delete cambios[field];
                    } catch (errName) {
                        console.error(`Error obteniendo nombres para log ${field}:`, errName);
                        // Si falla, se queda con el ID original en cambios[field]
                    }
                }
            }
        }

        const detallesCambios = Object.keys(cambios).length > 0 ? JSON.stringify(cambios) : null;
        
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion, detalle) VALUES (?, ?, ?, DATE_SUB(NOW(), INTERVAL 5 HOUR), ?, ?)',
          [req.user.id, 'ACTUALIZAR', 'REACTIVOS', `Actualización de reactivo: ${lote}`, detallesCambios]
        );
      }

      res.json({ message: 'Actualizado' });
    } catch (err) {
      console.error('Error PUT /:lote (reactivos):', err);
      res.status(500).json({ message: 'Error actualizando reactivo' });
    }
  },

  // DELETE /api/reactivos/:lote
  deleteReactivo: async (req, res) => {
    // VERIFICACIÓN POR ROL - MODIFICADO
    if (req.user && req.user.rol !== 'Administrador' && req.user.rol !== 'Superadmin') {
        return res.status(403).json({ 
            message: 'No tienes permisos para eliminar reactivos. Solo administradores pueden realizar esta acción.' 
        });
    }

    const { lote } = req.params;
    try {
        const [result] = await pool.query('UPDATE reactivos SET activo = 0 WHERE lote = ? AND activo = 1', [lote]);
        if (result.affectedRows === 0) {
          const [exists] = await pool.query('SELECT lote FROM reactivos WHERE lote = ?', [lote]);
          if (!exists.length) return res.status(404).json({ message: 'No encontrado' });
          return res.json({ message: 'Eliminado' });
        }

        // REGISTRO DE LOG - MODIFICADO
        if (req.user && req.user.id) {
            try {
              await pool.query(
                  'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion, detalle) VALUES (?, ?, ?, DATE_SUB(NOW(), INTERVAL 5 HOUR), ?, ?)',
                  [req.user.id, 'ELIMINAR', 'REACTIVOS', `Eliminación de reactivo: ${lote}`, JSON.stringify({ lote })]
              );
            } catch (errLog) {
              console.error('Error registrando log eliminación reactivo:', errLog);
            }
        }

        res.json({ message: 'Eliminado' });
    } catch (err) {
        console.error('Error DELETE /:lote (reactivos):', err);
        res.status(500).json({ message: 'Error eliminando reactivo' });
    }
  },

  // POST /api/reactivos/consumo
  registrarConsumo: async (req, res) => {
    const { lote, cantidad, usuario, uso } = req.body;
    
    // Validación básica
    if (!lote || !cantidad || cantidad <= 0 || !uso) {
      return res.status(400).json({ message: 'Lote, cantidad positiva y uso son requeridos' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Verificar existencia y cantidad actual
      const [rows] = await connection.query('SELECT cantidad_total FROM reactivos WHERE lote = ? AND activo = 1 FOR UPDATE', [lote]);
      if (rows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'Reactivo no encontrado' });
      }

      const currentCant = parseFloat(rows[0].cantidad_total || 0);
      const consumeCant = parseFloat(cantidad);

      if (currentCant < consumeCant) {
        await connection.rollback();
        return res.status(400).json({ 
          message: `Cantidad insuficiente. Disponible: ${currentCant}, Solicitado: ${consumeCant}` 
        });
      }

      // Determinar nombre de usuario
      let userName = usuario;
      if (!userName && req.user) {
        userName = req.user.nombre || req.user.email || 'Usuario sistema';
      }
      if (!userName) userName = 'Anónimo';

      // Insertar en consumo_reactivos
      await connection.query(
        'INSERT INTO consumo_reactivos (lote, cantidad, usuario, uso) VALUES (?, ?, ?, ?)',
        [lote, consumeCant, userName, uso || null]
      );

      // Actualizar reactivos
      await connection.query(
        'UPDATE reactivos SET cantidad_total = cantidad_total - ? WHERE lote = ? AND activo = 1',
        [consumeCant, lote]
      );

      // Logs
      if (req.user && req.user.id) {
         // Log de acción
         await connection.query(
           'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion) VALUES (?, ?, ?, DATE_SUB(NOW(), INTERVAL 5 HOUR), ?)',
           [req.user.id, 'CONSUMO', 'REACTIVOS', `Consumo de ${consumeCant} del lote ${lote}. Uso: ${uso}`]
         );
         
         // Movimiento de inventario (Salida)
         // Nota: Asumiendo que movimientos_inventario no tiene columna cantidad basado en createReactivo, 
         // pero registramos el evento.
         await connection.query(
             'INSERT INTO movimientos_inventario (producto_tipo, producto_referencia, usuario_id, tipo_movimiento, fecha) VALUES (?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 5 HOUR))',
             ['REACTIVO', lote, req.user.id, 'SALIDA']
         );
      }

      await connection.commit();
      res.json({ message: 'Consumo registrado exitosamente', nuevo_saldo: Number((currentCant - consumeCant).toFixed(4)) });

    } catch (err) {
      await connection.rollback();
      console.error('Error registrarConsumo:', err);
      res.status(500).json({ message: 'Error registrando consumo' });
    } finally {
      connection.release();
    }
  },

  // Exportación Excel de reactivos (propiedad del controlador)
  exportReactivosExcel: async (req, res) => {
    try {
      // Datos base de reactivos
      const [rows] = await pool.query('SELECT * FROM reactivos WHERE activo = 1 ORDER BY fecha_creacion DESC');

      // Cargar catálogos para mapear *_id a nombre
      const [tipos] = await pool.query('SELECT id, nombre FROM tipo_reactivo');
      const [clasif] = await pool.query('SELECT id, nombre FROM clasificacion_sga');
      const [unidades] = await pool.query('SELECT id, nombre FROM unidades');
      const [estado] = await pool.query('SELECT id, nombre FROM estado_fisico');
      const [recipiente] = await pool.query('SELECT id, nombre FROM tipo_recipiente');
      const [almacen] = await pool.query('SELECT id, nombre FROM almacenamiento');

      // Construir diccionarios id -> nombre
      const toMap = (arr) => {
        const m = {};
        for (const it of arr || []) m[it.id] = it.nombre;
        return m;
      };
      const mapTipo = toMap(tipos);
      const mapClasif = toMap(clasif);
      const mapUnidad = toMap(unidades);
      const mapEstado = toMap(estado);
      const mapRecipiente = toMap(recipiente);
      const mapAlmacen = toMap(almacen);

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Reactivos');

      if (!rows.length) {
        sheet.addRow(['No hay reactivos']);
      } else {
        // Cabeceras dinámicas basadas en claves del primer registro
        const headers = Object.keys(rows[0]);
        sheet.addRow(headers);

        // Escribir filas, reemplazando *_id por su nombre
        for (const r of rows) {
          const rowValues = headers.map((h) => {
            const v = r[h];
            switch (h) {
              case 'tipo_id':
                return v != null ? (mapTipo[v] ?? v) : v;
              case 'clasificacion_id':
                return v != null ? (mapClasif[v] ?? v) : v;
              case 'unidad_id':
                return v != null ? (mapUnidad[v] ?? v) : v;
              case 'estado_id':
                return v != null ? (mapEstado[v] ?? v) : v;
              case 'tipo_recipiente_id':
                return v != null ? (mapRecipiente[v] ?? v) : v;
              case 'almacenamiento_id':
                return v != null ? (mapAlmacen[v] ?? v) : v;
              default:
                return v;
            }
          });
          sheet.addRow(rowValues);
        }

        // Estilos de encabezado y ancho de columnas
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B8B5' } };
          cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        });
        sheet.columns.forEach((col) => {
          col.width = Math.min(40, Math.max(12, col.header ? String(col.header).length + 2 : 15));
        });
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const filename = 'reactivos_' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.xlsx';
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      console.error('Error exportando Excel reactivos:', err);
      res.status(500).json({ message: 'Error exportando reactivos a Excel' });
    }
  },

  listarPlantillasDocumentoReactivo: async (req, res) => {
    try {
      await ensurePlantillasDocumentoReactivosTable();
      const [rows] = await pool.query(
        `SELECT id, nombre, nombre_archivo, mime, size_bytes, usuario_id, fecha_subida
         FROM plantillas_documento_reactivos
         ORDER BY fecha_subida DESC, id DESC`
      );
      return res.json(rows);
    } catch (err) {
      console.error('Error GET /documentos/plantillas:', err);
      return res.status(500).json({ message: 'Error listando plantillas' });
    }
  },

  subirPlantillaDocumentoReactivo: async (req, res) => {
    try {
      await ensurePlantillasDocumentoReactivosTable();
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
        `INSERT INTO plantillas_documento_reactivos (nombre, nombre_archivo, mime, size_bytes, archivo, usuario_id)
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
      console.error('Error POST /documentos/plantillas:', err);
      return res.status(500).json({ message: 'Error subiendo plantilla' });
    }
  },

  eliminarPlantillaDocumentoReactivo: async (req, res) => {
    try {
      await ensurePlantillasDocumentoReactivosTable();
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: 'ID inválido' });

      const [result] = await pool.query('DELETE FROM plantillas_documento_reactivos WHERE id = ?', [id]);
      if (!result.affectedRows) return res.status(404).json({ message: 'Plantilla no encontrada' });
      return res.json({ ok: true });
    } catch (err) {
      console.error('Error DELETE /documentos/plantillas/:id:', err);
      return res.status(500).json({ message: 'Error eliminando plantilla' });
    }
  },

  generarDocumentoReactivoDesdePlantilla: async (req, res) => {
    try {
      await ensurePlantillasDocumentoReactivosTable();
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: 'ID inválido' });

      const codigo = String((req.body || {}).codigo || '').trim();
      const lote = String((req.body || {}).lote || '').trim();
      const todos = !!(req.body || {}).todos;
      if (!todos && !codigo && !lote) {
        return res.status(400).json({ message: 'Debe enviar codigo (y opcionalmente lote)' });
      }

      const [rows] = await pool.query(
        'SELECT nombre_archivo, mime, archivo FROM plantillas_documento_reactivos WHERE id = ? LIMIT 1',
        [id]
      );
      if (!rows || !rows.length) return res.status(404).json({ message: 'Plantilla no encontrada' });

      const tpl = rows[0];
      req.body = { ...req.body, codigo: codigo || undefined, lote: lote || undefined, todos: todos || undefined };
      req.file = {
        buffer: tpl.archivo,
        originalname: tpl.nombre_archivo,
        mimetype: tpl.mime || 'application/octet-stream',
        size: tpl.archivo ? tpl.archivo.length : 0
      };

      return reactivosController.generarDocumentoReactivo(req, res);
    } catch (err) {
      console.error('Error POST /documentos/plantillas/:id/generar:', err);
      return res.status(500).json({ message: 'Error generando documento desde plantilla' });
    }
  },

  generarDocumentoReactivo: async (req, res) => {
    try {
      const file = req.file;
      if (!file || !file.buffer) {
        return res.status(400).json({ message: 'Plantilla requerida' });
      }

      const codigo = String((req.body || {}).codigo || '').trim();
      const lote = String((req.body || {}).lote || '').trim();
      let dto = null;

      const original = String(file.originalname || '').toLowerCase();
      const isXlsx = original.endsWith('.xlsx') || /spreadsheetml/.test(String(file.mimetype || '').toLowerCase());
      const isDocx = original.endsWith('.docx') || /wordprocessingml/.test(String(file.mimetype || '').toLowerCase());
      if (!isXlsx && !isDocx) {
        return res.status(400).json({ message: 'Formato de plantilla no soportado. Use .xlsx o .docx' });
      }

      // Regla A: el template manda. Si hay loop #reactivos, generar para todos; si no, requiere selección.
      const todos = templateHasReactivosLoop(file.buffer);
      if (!todos && !codigo && !lote) {
        return res.status(400).json({ message: 'Debe enviar codigo (y opcionalmente lote)' });
      }

      if (todos) {
        dto = { reactivo: Object.create(null), reactivos: await fetchReactivosLoopDTO() };
      } else {
        const reactivo = await fetchReactivoDTO({ codigo, lote });
        if (!reactivo) {
          return res.status(404).json({ message: 'Reactivo no encontrado' });
        }
        dto = { reactivo };
      }

      const outBuffer = isXlsx
        ? await generateXlsxFromTemplate(file.buffer, dto)
        : await generateDocxFromTemplate(file.buffer, dto);

      const ext = isXlsx ? 'xlsx' : 'docx';
      const filename = todos
        ? `reactivos.${ext}`
        : `reactivo_${safeFileComponent(dto.reactivo.codigo)}_${safeFileComponent(dto.reactivo.lote)}.${ext}`;

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
  }
};

// ===== SUSCRIPCIONES Y NOTIFICACIONES =====

// Crear tabla de suscripciones si no existe
async function ensureSuscripcionesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS suscripciones_reactivos (
        email VARCHAR(255) PRIMARY KEY,
        activo TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('Error creando tabla suscripciones_reactivos:', err);
  }
}

// Crear tabla de notificaciones si no existe (evitar correos duplicados por reinicios)
async function ensureNotificacionesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notificaciones_reactivos (
        lote VARCHAR(255) NOT NULL,
        days_threshold INT NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (lote, days_threshold)
      )
    `);
  } catch (err) {
    console.error('Error creando tabla notificaciones_reactivos:', err);
  }
}

async function ensureJobRunsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS job_runs (
        job_name VARCHAR(64) NOT NULL,
        run_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (job_name, run_date)
      )
    `);
  } catch (err) {
    console.error('Error creando tabla job_runs:', err);
  }
}

// Helper para enviar correo
async function sendMail(to, subject, text, html) {
  if (!nodemailer) {
    console.log(`[email] nodemailer no disponible; simulando envío: to=${to} subject="${subject}"`);
    return { simulated: true };
  }
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || `no-reply@backend-lab`;
  if (!host || !user || !pass) {
    console.warn('[email] SMTP env incompletos; simulando envío');
    console.log(`[email] to=${to} text=${text}`);
    return { simulated: true };
  }
  const transport = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  const info = await transport.sendMail({ from, to, subject, text, html });
  return { messageId: info.messageId };
}

// Endpoint: POST /api/reactivos/suscripciones
reactivosController.suscribirseReactivos = async (req, res) => {
  try {
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !re.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }
    await ensureSuscripcionesTable();
    const [existing] = await pool.query(
      'SELECT activo FROM suscripciones_reactivos WHERE email = ? LIMIT 1',
      [email]
    );
    if (existing && existing.length && existing[0] && existing[0].activo) {
      return res.status(409).json({ error: 'Este correo ya está suscrito a reactivos' });
    }
    await pool.query(
      `INSERT INTO suscripciones_reactivos (email, activo) VALUES (?, 1)
       ON DUPLICATE KEY UPDATE activo = VALUES(activo), created_at = CURRENT_TIMESTAMP`,
      [email]
    );
    const text = `Te has suscrito a notificaciones de vencimiento de reactivos.\n\nRecibirás alertas a 6, 3, 2 y 1 meses antes del vencimiento.`;
    const html = `<p>Te has suscrito a notificaciones de vencimiento de reactivos.</p><p>Recibirás alertas a <strong>6, 3, 2 y 1 meses</strong> antes del vencimiento.</p>`;
    const r = await sendMail(email, 'Suscripción a reactivos confirmada', text, html);
    return res.json({ ok: true, ...r });
  } catch (err) {
    console.error('Error suscribirseReactivos:', err);
    return res.status(500).json({ error: 'No se pudo registrar la suscripción' });
  }
};

// Endpoint: GET /api/reactivos/suscripciones/:email
reactivosController.obtenerEstadoSuscripcion = async (req, res) => {
  try {
    const email = String((req.params || {}).email || '').trim().toLowerCase();
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !re.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }
    await ensureSuscripcionesTable();
    const [rows] = await pool.query('SELECT activo FROM suscripciones_reactivos WHERE email = ?', [email]);
    if (!rows.length) return res.json({ suscrito: false });
    return res.json({ suscrito: !!rows[0].activo });
  } catch (err) {
    console.error('Error obtenerEstadoSuscripcion:', err);
    return res.status(500).json({ error: 'Error consultando suscripción' });
  }
};

reactivosController.cancelarSuscripcion = async (req, res) => {
  try {
    const email = String((req.params || {}).email || '').trim().toLowerCase();
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !re.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }
    await ensureSuscripcionesTable();
    const [result] = await pool.query('UPDATE suscripciones_reactivos SET activo = 0 WHERE email = ?', [email]);
    return res.json({ ok: true, updated: result.affectedRows });
  } catch (err) {
    console.error('Error cancelarSuscripcion:', err);
    return res.status(500).json({ error: 'Error cancelando suscripción' });
  }
};

// Job: enviar notificaciones de vencimiento (ejecutar diariamente)
reactivosController.ejecutarNotificacionesVencimiento = async () => {
  try {
    await ensureSuscripcionesTable();
    await ensureNotificacionesTable();
    await ensureJobRunsTable();

    const jobName = 'reactivos_vencimiento';
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    try {
      const [alreadyRan] = await pool.query(
        'SELECT 1 FROM job_runs WHERE job_name = ? AND run_date = ? LIMIT 1',
        [jobName, today]
      );
      if (alreadyRan && alreadyRan.length) {
        return;
      }
    } catch (errCheck) {
      console.error('Error verificando ejecución diaria job_runs:', errCheck);
    }

    const [subs] = await pool.query('SELECT email FROM suscripciones_reactivos WHERE activo = 1');
    const emails = subs.map(s => s.email).filter(Boolean);
    if (!emails.length) return;

    const [rows] = await pool.query('SELECT lote, codigo, nombre, fecha_vencimiento FROM reactivos WHERE activo = 1 AND fecha_vencimiento IS NOT NULL');
    const hoy = new Date();
    const toMid = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const thresholds = [
      { label: '6 meses', days: 180 },
      { label: '3 meses', days: 90 },
      { label: '2 meses', days: 60 },
      { label: '1 mes', days: 30 },
    ];
    const vencido = { label: 'Vencido', days: 0 };

    const grupos = {};
    for (const t of thresholds) grupos[t.days] = [];
    grupos[vencido.days] = [];

    for (const r of rows || []) {
      const d = new Date(r.fecha_vencimiento);
      if (isNaN(d.getTime())) continue;
      const days = Math.floor((toMid(d) - toMid(hoy)) / 86400000);
      // Ventana de ±1 día para evitar perder alertas por horarios
      for (const t of thresholds) {
        if (days >= t.days - 1 && days <= t.days + 1) {
          grupos[t.days].push({
            nombre: r.nombre,
            lote: r.lote,
            codigo: r.codigo,
            fecha: d.toISOString().slice(0, 10)
          });
          break;
        }
      }
      // Capturar vencidos una sola vez (ventana -1..+1 alrededor de 0 días)
      if (days >= vencido.days - 1 && days <= vencido.days + 1) {
        grupos[vencido.days].push({
          nombre: r.nombre,
          lote: r.lote,
          codigo: r.codigo,
          fecha: d.toISOString().slice(0, 10)
        });
      }
    }

    // Filtrar elementos ya notificados previamente para evitar duplicados al reiniciar
    const relevantDays = [...thresholds.map(t => t.days), vencido.days];
    const [prev] = await pool.query(
      `SELECT lote, days_threshold FROM notificaciones_reactivos WHERE days_threshold IN (${relevantDays.join(',')})`
    );
    const prevSet = new Set((prev || []).map(p => `${p.lote}:${p.days_threshold}`));
    for (const t of thresholds) {
      grupos[t.days] = grupos[t.days].filter(it => !prevSet.has(`${it.lote}:${t.days}`));
    }
    grupos[vencido.days] = grupos[vencido.days].filter(it => !prevSet.has(`${it.lote}:${vencido.days}`));

    // Construir contenido si hay items (no notificados aún)
    const hayItems = thresholds.some(t => (grupos[t.days] || []).length) || (grupos[vencido.days] || []).length;
    if (!hayItems) return;

    let text = 'Alertas de vencimiento de reactivos:\n\n';
    let html = '<h3>Alertas de vencimiento de reactivos</h3>';
    if ((grupos[vencido.days] || []).length) {
      text += `== ${vencido.label} ==\n`;
      html += `<h4>${vencido.label}</h4><ul>`;
      for (const it of grupos[vencido.days]) {
        text += `- ${it.nombre} | Lote: ${it.lote} | Código: ${it.codigo} | Vencido: ${it.fecha}\n`;
        html += `<li>${it.nombre} — Lote: <strong>${it.lote}</strong> — Código: <strong>${it.codigo}</strong> — Vencido: ${it.fecha}</li>`;
      }
      text += '\n';
      html += '</ul>';
    }
    for (const t of thresholds) {
      const list = grupos[t.days];
      if (!list.length) continue;
      text += `== ${t.label} ==\n`;
      html += `<h4>${t.label}</h4><ul>`;
      for (const it of list) {
        text += `- ${it.nombre} | Lote: ${it.lote} | Código: ${it.codigo} | Vence: ${it.fecha}\n`;
        html += `<li>${it.nombre} — Lote: <strong>${it.lote}</strong> — Código: <strong>${it.codigo}</strong> — Vence: ${it.fecha}</li>`;
      }
      text += '\n';
      html += '</ul>';
    }

    // Enviar a todos los suscriptores (BCC para privacidad)
    const subject = 'Notificación de vencimiento de reactivos';
    for (const to of emails) {
      try {
        await sendMail(to, subject, text, html);
      } catch (e) {
        console.error('Error enviando notificación a', to, e);
      }
    }

    // Registrar notificaciones enviadas para evitar futuras duplicadas en el mismo umbral
    const inserts = [];
    for (const t of thresholds) {
      for (const it of (grupos[t.days] || [])) {
        inserts.push([it.lote, t.days]);
      }
    }
    for (const it of (grupos[vencido.days] || [])) {
      inserts.push([it.lote, vencido.days]);
    }
    if (inserts.length) {
      // Inserción en bloque con ON DUPLICATE KEY UPDATE para idempotencia
      const valuesSql = inserts.map(() => '(?, ?, CURRENT_TIMESTAMP)').join(', ');
      const flat = inserts.flat();
      await pool.query(
        `INSERT INTO notificaciones_reactivos (lote, days_threshold, sent_at) VALUES ${valuesSql}
         ON DUPLICATE KEY UPDATE sent_at = sent_at`,
        flat
      );
    }

    try {
      await pool.query(
        `INSERT INTO job_runs (job_name, run_date) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE created_at = created_at`,
        [jobName, today]
      );
    } catch (errRun) {
      console.error('Error registrando ejecución diaria job_runs:', errRun);
    }
  } catch (err) {
    console.error('Error ejecutarNotificacionesVencimiento:', err);
  }
};

// Endpoint: listar alertas próximas (agrupadas por umbral) sin envío
reactivosController.listarAlertasProximas = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT lote, codigo, nombre, fecha_vencimiento FROM reactivos WHERE activo = 1 AND fecha_vencimiento IS NOT NULL');
    const hoy = new Date();
    const toMid = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const thresholds = [
      { label: '6 meses', days: 180 },
      { label: '3 meses', days: 90 },
      { label: '2 meses', days: 60 },
      { label: '1 mes', days: 30 },
    ];
    const grupos = {};
    for (const t of thresholds) grupos[t.days] = [];
    for (const r of rows || []) {
      const d = new Date(r.fecha_vencimiento);
      if (isNaN(d.getTime())) continue;
      const days = Math.floor((toMid(d) - toMid(hoy)) / 86400000);
      for (const t of thresholds) {
        if (days >= t.days - 1 && days <= t.days + 1) {
          grupos[t.days].push({
            nombre: r.nombre,
            lote: r.lote,
            codigo: r.codigo,
            fecha: d.toISOString().slice(0, 10)
          });
          break;
        }
      }
    }
    return res.json({
      '6_meses': grupos[180],
      '3_meses': grupos[90],
      '2_meses': grupos[60],
      '1_mes': grupos[30]
    });
  } catch (err) {
    console.error('Error listarAlertasProximas:', err);
    return res.status(500).json({ error: 'Error listando alertas próximas' });
  }
};

// Endpoint: POST /api/reactivos/notificaciones/test
reactivosController.enviarNotificacionPrueba = async (req, res) => {
  try {
    const email = String((req.body || {}).email || process.env.SMTP_USER || '').trim().toLowerCase();
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !re.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }
    // Crear/actualizar reactivo de prueba a 30 días con campos requeridos
    const addDays = (n) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0,10);
    };
    const fecha = addDays(30);
    const hoy = new Date(); const fechaAdq = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString().slice(0,10);
    // Asegurar catálogo
    await pool.query(
      `INSERT INTO catalogo_reactivos (codigo, nombre, tipo_reactivo, clasificacion_sga, descripcion, activo)
       VALUES (?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), activo = 1`,
      ['EXPTEST', 'Reactivo de Prueba 30D', 'No controlado', 'No peligro', 'Elemento de prueba para notificaciones']
    );
    // Obtener IDs requeridos
    const idFrom = async (table, nombre) => {
      const [rows] = await pool.query(`SELECT id FROM ${table} WHERE nombre = ? LIMIT 1`, [nombre]);
      return rows?.[0]?.id || 1;
    };
    const tipo_id = await idFrom('tipo_reactivo', 'No controlado');
    const clasificacion_id = await idFrom('clasificacion_sga', 'No peligro');
    const unidad_id = await idFrom('unidades', 'mL');
    const estado_id = await idFrom('estado_fisico', 'Liquido');
    const almacenamiento_id = await idFrom('almacenamiento', 'No aplica');
    const tipo_recipiente_id = await idFrom('tipo_recipiente', 'Vidrio');
    // Insertar reactivo completo
    await pool.query(
      `INSERT INTO reactivos (
        lote, codigo, nombre, marca, referencia, cas, presentacion, presentacion_cant, cantidad_total,
        fecha_adquisicion, fecha_vencimiento, observaciones, tipo_id, clasificacion_id, unidad_id, estado_id,
        almacenamiento_id, tipo_recipiente_id, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE 
        activo = 1,
        fecha_vencimiento = VALUES(fecha_vencimiento),
        nombre = VALUES(nombre),
        marca = VALUES(marca),
        presentacion = VALUES(presentacion),
        presentacion_cant = VALUES(presentacion_cant),
        cantidad_total = VALUES(cantidad_total),
        fecha_adquisicion = VALUES(fecha_adquisicion),
        tipo_id = VALUES(tipo_id),
        clasificacion_id = VALUES(clasificacion_id),
        unidad_id = VALUES(unidad_id),
        estado_id = VALUES(estado_id),
        almacenamiento_id = VALUES(almacenamiento_id),
        tipo_recipiente_id = VALUES(tipo_recipiente_id)`,
      [
        'TEST-EXP-30D', 'EXPTEST', 'Reactivo de Prueba 30D', 'LIBA', null, null, 
        1, 1, 1,
        fechaAdq, fecha, 'Prueba de notificación',
        tipo_id, clasificacion_id, unidad_id, estado_id, almacenamiento_id, tipo_recipiente_id
      ]
    );
    const subject = 'Notificación de vencimiento (prueba)';
    const text = `Alertas de vencimiento (prueba):\n\n- Reactivo de Prueba 30D | Lote: TEST-EXP-30D | Código: EXPTEST | Vence: ${fecha}\n`;
    const html = `<h3>Alertas de vencimiento (prueba)</h3><ul><li>Reactivo de Prueba 30D — Lote: <strong>TEST-EXP-30D</strong> — Código: <strong>EXPTEST</strong> — Vence: ${fecha}</li></ul>`;
    const r = await sendMail(email, subject, text, html);
    return res.json({ ok: true, ...r });
  } catch (err) {
    console.error('Error enviarNotificacionPrueba:', err);
    return res.status(500).json({ error: 'No se pudo enviar la notificación de prueba' });
  }
};

module.exports = reactivosController;
