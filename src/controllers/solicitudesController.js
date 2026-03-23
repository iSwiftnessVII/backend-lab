const pool = require('../config/db');
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (_) { nodemailer = null; }
const ExcelJS = require('exceljs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

function detectSolicitudesLoopEntity(templateBuffer) {
  try {
    const zip = new PizZip(templateBuffer);
    const reSolicitudes = /{{\s*#solicitudes\s*}}/i;
    const reClientes = /{{\s*#clientes\s*}}/i;

    let hasSolicitudes = false;
    let hasClientes = false;

    for (const name of Object.keys(zip.files || {})) {
      const entry = zip.files[name];
      if (!entry || entry.dir) continue;
      let text = '';
      try {
        text = zip.file(name)?.asText() || '';
      } catch {
        text = '';
      }
      if (!text) continue;
      if (!hasSolicitudes && reSolicitudes.test(text)) hasSolicitudes = true;
      if (!hasClientes && reClientes.test(text)) hasClientes = true;
      if (hasSolicitudes && hasClientes) break;
    }

    if (hasSolicitudes && hasClientes) return 'ambos';
    if (hasSolicitudes) return 'solicitud';
    if (hasClientes) return 'cliente';
  } catch {
    // ignore; treat as no-loop
  }
  return null;
}

async function sendMail(to, subject, text, html) {
  if (!nodemailer) {
    console.log(`[email] nodemailer no disponible; simulando envío: to=${to} subject="${subject}"`);
    return { simulated: true };
  }
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || '';
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
  const secureRaw = process.env.SMTP_SECURE ?? process.env.EMAIL_SECURE ?? 'false';
  const secure = String(secureRaw) === 'true';
  const user =
    process.env.SMTP_USER ||
    process.env.EMAIL_USER ||
    process.env.EMAIL_ADDRESS ||
    process.env.MAIL_USER ||
    '';
  const pass =
    process.env.SMTP_PASS ||
    process.env.EMAIL_APP_PASSWORD ||
    process.env.EMAIL_PASSWORD ||
    process.env.MAIL_PASS ||
    '';
  const from =
    process.env.SMTP_FROM ||
    process.env.EMAIL_FROM ||
    user ||
    'no-reply@backend-lab';
  if (!host || !user || !pass) {
    console.warn('[email] SMTP env incompletos; simulando envío');
    console.log(`[email] to=${to} text=${text}`);
    return { simulated: true };
  }
  const transport = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  const info = await transport.sendMail({ from, to, subject, text, html });
  return { messageId: info.messageId };
}

async function ensureSuscripcionesSolicitudesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS suscripciones_solicitudes (
        email VARCHAR(255) PRIMARY KEY,
        activo TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('Error creando tabla suscripciones_solicitudes:', err);
  }
}

async function ensureSuscripcionesRevisionTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS suscripciones_revision_oferta (
        email VARCHAR(255) PRIMARY KEY,
        activo TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('Error creando tabla suscripciones_revision_oferta:', err);
  }
}

async function getEstadoIdByName(nombre) {
  const name = String(nombre || '').trim().toUpperCase();
  if (!name) return null;
  try {
    const [rows] = await pool.query(
      'SELECT id_estado FROM estados_solicitud WHERE UPPER(nombre_estado) = ? LIMIT 1',
      [name]
    );
    if (rows && rows[0] && Number.isFinite(Number(rows[0].id_estado))) {
      return Number(rows[0].id_estado);
    }
  } catch (err) {
    console.warn('Error consultando estados_solicitud:', err);
  }
  return null;
}

function toBit(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'number') return val ? 1 : 0;
  const s = String(val).trim().toUpperCase();
  if (!s) return null;
  return s === '1' || s === 'TRUE' || s === 'SI' || s === 'SÍ' || s === 'YES' || s === 'Y' ? 1 : 0;
}

function normalizeConceptoFinal(val, fallbackViable) {
  const raw = String(val || '').trim().toUpperCase();
  if (raw) return raw;
  if (fallbackViable === null || fallbackViable === undefined || fallbackViable === '') return null;
  const viable = toBit(fallbackViable);
  if (viable === null) return null;
  return viable ? 'SOLICITUD_VIABLE' : 'SOLICITUD_NO_VIABLE';
}

function conceptoFinalToBit(val) {
  const raw = String(val || '').trim().toUpperCase();
  if (!raw) return null;
  if (raw === 'SOLICITUD_NO_VIABLE') return 0;
  if (raw.startsWith('SOLICITUD_VIABLE')) return 1;
  return null;
}

const tableColumnsCache = new Map();

async function getTableColumns(tableName) {
  if (tableColumnsCache.has(tableName)) return tableColumnsCache.get(tableName);
  try {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME as name
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName]
    );
    const set = new Set((rows || []).map((r) => String(r?.name || '').trim()).filter(Boolean));
    tableColumnsCache.set(tableName, set);
    return set;
  } catch (err) {
    console.warn('Error consultando columnas de tabla:', tableName, err);
    const empty = new Set();
    tableColumnsCache.set(tableName, empty);
    return empty;
  }
}

const ALLOWED_CLIENTE_FIELDS = new Set([
  'id_cliente',
  'numero',
  'fecha_vinculacion',
  'tipo_usuario',
  'razon_social',
  'nit',
  'nombre_solicitante',
  'tipo_identificacion',
  'numero_identificacion',
  'sexo',
  'tipo_poblacion',
  'direccion',
  'id_ciudad',
  'id_departamento',
  'ciudad_codigo',
  'departamento_codigo',
  'ciudad',
  'departamento',
  'celular',
  'telefono',
  'correo_electronico',
  'tipo_vinculacion',
  'registro_realizado_por',
  'observaciones',
  'activo',
  'created_at',
  'updated_at'
]);

const ALLOWED_SOLICITUD_FIELDS = new Set([
  'solicitud_id',
  'id_cliente',
  'id_estado',
  'id_admin',
  'tipo_solicitud',
  'id_tipo_af',
  'nombre_muestra',
  'fecha_solicitud',
  'lote_producto',
  'fecha_vencimiento_muestra',
  'tipo_muestra',
  'tipo_empaque',
  'analisis_requerido',
  'req_analisis',
  'cant_muestras',
  'solicitud_recibida',
  'fecha_entrega_muestra',
  'recibe_personal',
  'cargo_personal',
  'observaciones'
]);

const ALLOWED_OFERTA_FIELDS = new Set([
  'id_oferta',
  'id_solicitud',
  'genero_cotizacion',
  'valor_cotizacion',
  'fecha_envio_oferta',
  'realizo_seguimiento_oferta',
  'observacion_oferta'
]);

const ALLOWED_REVISION_FIELDS = new Set([
  'id_revision',
  'id_solicitud',
  'fecha_limite_entrega',
  'tipo_muestra_especificado',
  'ensayos_requeridos_claros',
  'equipos_calibrados',
  'personal_competente',
  'infraestructura_adecuada',
  'insumos_vigentes',
  'cumple_tiempos_entrega',
  'normas_metodos_especificados',
  'metodo_validado_verificado',
  'metodo_adecuado',
  'observaciones_tecnicas',
  'concepto_final'
]);

const ALLOWED_SEGUIMIENTO_ENCUESTA_FIELDS = new Set([
  'id_encuesta',
  'id_solicitud',
  'fecha_encuesta',
  'comentarios',
  'recomendaria_servicio',
  'cliente_respondio',
  'solicito_nueva_encuesta'
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

function formatDateTime(value) {
  if (!value) return '';
  try {
    if (value instanceof Date) return value.toISOString().slice(0, 19).replace('T', ' ');
    const d = new Date(String(value));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 19).replace('T', ' ');
  } catch {}
  return '';
}

async function getSolicitudPreviewCode(tipo, fechaSolicitud, id) {
  const tipoVal = String(tipo || '').trim();
  if (!tipoVal) return 'N/A';
  let fecha = fechaSolicitud ? new Date(fechaSolicitud) : new Date();
  if (isNaN(fecha.getTime())) fecha = new Date();
  const year = fecha.getFullYear();
  const sid = Number(id);
  if (!Number.isFinite(sid) || sid <= 0) {
    return `${tipoVal}-${year}-00`;
  }
  return `${tipoVal}-${year}-${String(sid).padStart(2, '0')}`;
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
  if (v instanceof Date) return formatDateTime(v);
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

function buildClienteDescripcion({ accion, idCliente, nombre, identificacion }) {
  const accionTxt = String(accion || '').trim();
  const idTxt = String(idCliente || '').trim() || 'sin id';
  const nombreTxt = String(nombre || '').trim() || 'sin nombre';
  const identTxt = String(identificacion || '').trim() || 'sin identificación';
  return `${accionTxt} cliente - id: ${idTxt}, nombre: ${nombreTxt}, identificación: ${identTxt}`;
}

function boolToSiNo(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'number') {
    if (v === 1) return 'Sí';
    if (v === 0) return 'No';
    return '';
  }
  const s = String(v).trim().toLowerCase();
  if (!s) return '';
  if (s === '1' || s === 'true' || s === 't' || s === 'si' || s === 'sí' || s === 'yes' || s === 'y') return 'Sí';
  if (s === '0' || s === 'false' || s === 'f' || s === 'no' || s === 'n') return 'No';
  return '';
}

async function fetchClienteDTO({ id_cliente, numero_identificacion, numero }) {
  const idNorm = String(id_cliente ?? '').trim();
  const identNorm = String(numero_identificacion ?? '').trim();
  const numeroNorm = String(numero ?? '').trim();
  if (!idNorm && !identNorm && !numeroNorm) return null;

  const where = ['c.activo = 1'];
  const params = [];
  if (idNorm) {
    where.push('c.id_cliente = ?');
    params.push(Number(idNorm));
  } else if (identNorm) {
    where.push('c.numero_identificacion = ?');
    params.push(identNorm);
  } else {
    where.push('c.numero = ?');
    params.push(Number(numeroNorm));
  }

  const [rows] = await pool.query(
    `
      SELECT
        c.id_cliente,
        c.numero,
        c.fecha_vinculacion,
        c.tipo_usuario,
        c.razon_social,
        c.nit,
        c.nombre_solicitante,
        c.tipo_identificacion,
        c.numero_identificacion,
        c.sexo,
        c.tipo_poblacion,
        c.direccion,
        c.id_ciudad,
        c.id_departamento,
        ci.nombre AS ciudad,
        d.nombre AS departamento,
        c.celular,
        c.telefono,
        c.correo_electronico,
        c.tipo_vinculacion,
        c.registro_realizado_por,
        c.observaciones,
        c.activo,
        c.created_at,
        c.updated_at
      FROM clientes c
      LEFT JOIN ciudades ci ON ci.codigo = c.id_ciudad
      LEFT JOIN departamentos d ON d.codigo = c.id_departamento
      WHERE ${where.join(' AND ')}
      LIMIT 1
    `,
    params
  );
  if (!rows || !rows.length) return null;

  const row = rows[0] || {};
  const cliente = Object.create(null);
  cliente.id_cliente = valueToText(row.id_cliente);
  cliente.numero = valueToText(row.numero);
  cliente.fecha_vinculacion = formatDateYMD(row.fecha_vinculacion);
  cliente.tipo_usuario = valueToText(row.tipo_usuario);
  cliente.razon_social = valueToText(row.razon_social);
  cliente.nit = valueToText(row.nit);
  cliente.nombre_solicitante = valueToText(row.nombre_solicitante);
  cliente.tipo_identificacion = valueToText(row.tipo_identificacion);
  cliente.numero_identificacion = valueToText(row.numero_identificacion);
  cliente.sexo = valueToText(row.sexo);
  cliente.tipo_poblacion = valueToText(row.tipo_poblacion);
  cliente.direccion = valueToText(row.direccion);
  cliente.id_ciudad = valueToText(row.ciudad);
  cliente.id_departamento = valueToText(row.departamento);
  cliente.ciudad_codigo = valueToText(row.id_ciudad);
  cliente.departamento_codigo = valueToText(row.id_departamento);
  cliente.ciudad = valueToText(row.ciudad);
  cliente.departamento = valueToText(row.departamento);
  cliente.celular = valueToText(row.celular);
  cliente.telefono = valueToText(row.telefono);
  cliente.correo_electronico = valueToText(row.correo_electronico);
  cliente.tipo_vinculacion = valueToText(row.tipo_vinculacion);
  cliente.registro_realizado_por = valueToText(row.registro_realizado_por);
  cliente.observaciones = valueToText(row.observaciones);
  cliente.activo = boolToSiNo(row.activo);
  cliente.created_at = formatDateTime(row.created_at);
  cliente.updated_at = formatDateTime(row.updated_at);
  return cliente;
}

async function fetchClientesLoopDTO({ limit } = {}) {
  const lim = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.min(20000, Number(limit)) : 5000;
  const [rows] = await pool.query(
    `
      SELECT
        c.id_cliente,
        c.numero,
        c.fecha_vinculacion,
        c.tipo_usuario,
        c.razon_social,
        c.nit,
        c.nombre_solicitante,
        c.tipo_identificacion,
        c.numero_identificacion,
        c.sexo,
        c.tipo_poblacion,
        c.direccion,
        c.id_ciudad,
        c.id_departamento,
        ci.nombre AS ciudad,
        d.nombre AS departamento,
        c.celular,
        c.telefono,
        c.correo_electronico,
        c.tipo_vinculacion,
        c.registro_realizado_por,
        c.observaciones,
        c.activo,
        c.created_at,
        c.updated_at
      FROM clientes c
      LEFT JOIN ciudades ci ON ci.codigo = c.id_ciudad
      LEFT JOIN departamentos d ON d.codigo = c.id_departamento
      WHERE c.activo = 1
      ORDER BY c.id_cliente DESC
      LIMIT ?
    `,
    [lim]
  );

  return (rows || []).map((row) => {
    const cliente = Object.create(null);
    cliente.id_cliente = valueToText(row.id_cliente);
    cliente.numero = valueToText(row.numero);
    cliente.fecha_vinculacion = formatDateYMD(row.fecha_vinculacion);
    cliente.tipo_usuario = valueToText(row.tipo_usuario);
    cliente.razon_social = valueToText(row.razon_social);
    cliente.nit = valueToText(row.nit);
    cliente.nombre_solicitante = valueToText(row.nombre_solicitante);
    cliente.tipo_identificacion = valueToText(row.tipo_identificacion);
    cliente.numero_identificacion = valueToText(row.numero_identificacion);
    cliente.sexo = valueToText(row.sexo);
    cliente.tipo_poblacion = valueToText(row.tipo_poblacion);
    cliente.direccion = valueToText(row.direccion);
    cliente.id_ciudad = valueToText(row.ciudad);
    cliente.id_departamento = valueToText(row.departamento);
    cliente.ciudad_codigo = valueToText(row.id_ciudad);
    cliente.departamento_codigo = valueToText(row.id_departamento);
    cliente.ciudad = valueToText(row.ciudad);
    cliente.departamento = valueToText(row.departamento);
    cliente.celular = valueToText(row.celular);
    cliente.telefono = valueToText(row.telefono);
    cliente.correo_electronico = valueToText(row.correo_electronico);
    cliente.tipo_vinculacion = valueToText(row.tipo_vinculacion);
    cliente.registro_realizado_por = valueToText(row.registro_realizado_por);
    cliente.observaciones = valueToText(row.observaciones);
    cliente.activo = boolToSiNo(row.activo);
    cliente.created_at = formatDateTime(row.created_at);
    cliente.updated_at = formatDateTime(row.updated_at);
    return cliente;
  });
}

async function fetchSolicitudesLoopDTO({ limit } = {}) {
  const lim = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.min(20000, Number(limit)) : 5000;
  const [rows] = await pool.query(
    `
      SELECT
        s.solicitud_id,
        s.id_cliente,
        s.tipo_solicitud,
        s.nombre_muestra,
        s.fecha_solicitud,
        s.lote_producto,
        s.fecha_vencimiento_muestra,
        s.tipo_muestra,
        s.tipo_empaque,
        s.analisis_requerido,
        s.req_analisis,
        s.cant_muestras,
        s.solicitud_recibida,
        s.fecha_entrega_muestra,
        s.recibe_personal,
        s.cargo_personal,
        s.observaciones
      FROM Solicitudes s
      ORDER BY s.solicitud_id DESC
      LIMIT ?
    `,
    [lim]
  );

  return (rows || []).map((row) => {
    const solicitud = Object.create(null);
    solicitud.solicitud_id = valueToText(row.solicitud_id);
    solicitud.id_cliente = valueToText(row.id_cliente);
    solicitud.tipo_solicitud = valueToText(row.tipo_solicitud);
    solicitud.nombre_muestra = valueToText(row.nombre_muestra);
    solicitud.fecha_solicitud = formatDateYMD(row.fecha_solicitud);
    solicitud.lote_producto = valueToText(row.lote_producto);
    solicitud.fecha_vencimiento_muestra = formatDateYMD(row.fecha_vencimiento_muestra);
    solicitud.tipo_muestra = valueToText(row.tipo_muestra);
    solicitud.tipo_empaque = valueToText(row.tipo_empaque);
    solicitud.analisis_requerido = valueToText(row.analisis_requerido);
    solicitud.req_analisis = boolToSiNo(row.req_analisis);
    solicitud.cant_muestras = valueToText(row.cant_muestras);
    solicitud.solicitud_recibida = valueToText(row.solicitud_recibida);
    solicitud.fecha_entrega_muestra = formatDateYMD(row.fecha_entrega_muestra);
    solicitud.recibe_personal = valueToText(row.recibe_personal);
    solicitud.cargo_personal = valueToText(row.cargo_personal);
    solicitud.observaciones = valueToText(row.observaciones);
    return solicitud;
  });
}

async function fetchSolicitudDocumentoDTO({ solicitud_id }) {
  const idNorm = String(solicitud_id ?? '').trim();
  if (!idNorm) return null;

  const [rows] = await pool.query(
    `
      SELECT
        s.solicitud_id,
        s.id_cliente,
        s.tipo_solicitud,
        s.nombre_muestra,
        s.fecha_solicitud,
        s.lote_producto,
        s.fecha_vencimiento_muestra,
        s.tipo_muestra,
        s.tipo_empaque,
        s.analisis_requerido,
        s.req_analisis,
        s.cant_muestras,
        s.solicitud_recibida,
        s.fecha_entrega_muestra,
        s.recibe_personal,
        s.cargo_personal,
        s.observaciones
      FROM Solicitudes s
      WHERE s.solicitud_id = ?
      LIMIT 1
    `,
    [Number(idNorm)]
  );
  if (!rows || !rows.length) return null;

  const row = rows[0] || {};
  const solicitud = Object.create(null);
  solicitud.solicitud_id = valueToText(row.solicitud_id);
  solicitud.id_cliente = valueToText(row.id_cliente);
  solicitud.tipo_solicitud = valueToText(row.tipo_solicitud);
  solicitud.nombre_muestra = valueToText(row.nombre_muestra);
  solicitud.fecha_solicitud = formatDateYMD(row.fecha_solicitud);
  solicitud.lote_producto = valueToText(row.lote_producto);
  solicitud.fecha_vencimiento_muestra = formatDateYMD(row.fecha_vencimiento_muestra);
  solicitud.tipo_muestra = valueToText(row.tipo_muestra);
  solicitud.tipo_empaque = valueToText(row.tipo_empaque);
  solicitud.analisis_requerido = valueToText(row.analisis_requerido);
  solicitud.req_analisis = boolToSiNo(row.req_analisis);
  solicitud.cant_muestras = valueToText(row.cant_muestras);
  solicitud.solicitud_recibida = valueToText(row.solicitud_recibida);
  solicitud.fecha_entrega_muestra = formatDateYMD(row.fecha_entrega_muestra);
  solicitud.recibe_personal = valueToText(row.recibe_personal);
  solicitud.cargo_personal = valueToText(row.cargo_personal);
  solicitud.observaciones = valueToText(row.observaciones);

  const clienteRaw = await fetchClienteDTO({ id_cliente: row.id_cliente });
  const cliente = clienteRaw
    ? {
        ...clienteRaw,
        ciudad_codigo: clienteRaw.ciudad_codigo || clienteRaw.id_ciudad,
        departamento_codigo: clienteRaw.departamento_codigo || clienteRaw.id_departamento,
        id_ciudad: clienteRaw.ciudad || clienteRaw.id_ciudad,
        id_departamento: clienteRaw.departamento || clienteRaw.id_departamento
      }
    : null;

  const [ofertaRows] = await pool.query(
    `
      SELECT
        o.id_oferta,
        o.id_solicitud,
        o.genero_cotizacion,
        o.valor_cotizacion,
        o.fecha_envio_oferta,
        o.realizo_seguimiento_oferta,
        o.observacion_oferta
      FROM oferta o
      WHERE o.id_solicitud = ?
      LIMIT 1
    `,
    [Number(idNorm)]
  );
  const ofertaRow = (ofertaRows && ofertaRows.length) ? ofertaRows[0] : null;
  const oferta = Object.create(null);
  oferta.id_oferta = valueToText(ofertaRow?.id_oferta);
  oferta.id_solicitud = valueToText(ofertaRow?.id_solicitud ?? row.solicitud_id);
  oferta.genero_cotizacion = boolToSiNo(ofertaRow?.genero_cotizacion);
  oferta.valor_cotizacion = valueToText(ofertaRow?.valor_cotizacion);
  oferta.fecha_envio_oferta = formatDateYMD(ofertaRow?.fecha_envio_oferta);
  oferta.realizo_seguimiento_oferta = boolToSiNo(ofertaRow?.realizo_seguimiento_oferta);
  oferta.observacion_oferta = valueToText(ofertaRow?.observacion_oferta);

  const [revisionRows] = await pool.query(
    `
      SELECT
        r.id_revision,
        r.id_solicitud,
        r.fecha_limite_entrega,
        r.servicio_es_viable
      FROM revision_oferta r
      WHERE r.id_solicitud = ?
      LIMIT 1
    `,
    [Number(idNorm)]
  );
  const revisionRow = (revisionRows && revisionRows.length) ? revisionRows[0] : null;
  const revision = Object.create(null);
  revision.id_revision = valueToText(revisionRow?.id_revision);
  revision.id_solicitud = valueToText(revisionRow?.id_solicitud ?? row.solicitud_id);
  revision.fecha_limite_entrega = formatDateYMD(revisionRow?.fecha_limite_entrega);
  revision.servicio_es_viable = boolToSiNo(revisionRow?.servicio_es_viable);

  const [seguimientoRows] = await pool.query(
    `
      SELECT
        e.id_encuesta,
        e.id_solicitud,
        e.fecha_encuesta,
        e.comentarios,
        e.recomendaria_servicio,
        e.cliente_respondio,
        e.solicito_nueva_encuesta
      FROM seguimiento_encuesta e
      WHERE e.id_solicitud = ?
      LIMIT 1
    `,
    [Number(idNorm)]
  );
  const segRow = (seguimientoRows && seguimientoRows.length) ? seguimientoRows[0] : null;
  const seguimiento_encuesta = Object.create(null);
  seguimiento_encuesta.id_encuesta = valueToText(segRow?.id_encuesta);
  seguimiento_encuesta.id_solicitud = valueToText(segRow?.id_solicitud ?? row.solicitud_id);
  seguimiento_encuesta.fecha_encuesta = formatDateYMD(segRow?.fecha_encuesta);
  seguimiento_encuesta.comentarios = valueToText(segRow?.comentarios);
  seguimiento_encuesta.recomendaria_servicio = boolToSiNo(segRow?.recomendaria_servicio);
  seguimiento_encuesta.cliente_respondio = boolToSiNo(segRow?.cliente_respondio);
  seguimiento_encuesta.solicito_nueva_encuesta = boolToSiNo(segRow?.solicito_nueva_encuesta);

  return { solicitud, cliente, oferta, revision, seguimiento_encuesta };
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

function validateSolicitudDocTags(tags) {
  const invalid = [];
  for (const tag of tags) {
    const t = String(tag || '').trim();
    if (t === '#clientes' || t === '/clientes' || t === '#solicitudes' || t === '/solicitudes') continue;

    const m = /^(cliente|solicitud|oferta|revision|seguimiento_encuesta|clientes|solicitudes)\.([A-Za-z0-9_]+)$/.exec(t);
    if (!m) {
      invalid.push(t);
      continue;
    }
    const scope = m[1];
    const field = m[2];
    const ok =
      ((scope === 'cliente' || scope === 'clientes') && ALLOWED_CLIENTE_FIELDS.has(field)) ||
      ((scope === 'solicitud' || scope === 'solicitudes') && ALLOWED_SOLICITUD_FIELDS.has(field)) ||
      (scope === 'oferta' && ALLOWED_OFERTA_FIELDS.has(field)) ||
      (scope === 'revision' && ALLOWED_REVISION_FIELDS.has(field)) ||
      (scope === 'seguimiento_encuesta' && ALLOWED_SEGUIMIENTO_ENCUESTA_FIELDS.has(field));
    if (!ok) invalid.push(t);
  }
  return invalid;
}

function replaceExcelSolicitudDocText(text, data, ctx) {
  return String(text ?? '').replace(
    /{{\s*(cliente|solicitud|oferta|revision|seguimiento_encuesta|clientes|solicitudes)\.([A-Za-z0-9_]+)\s*}}/g,
    (_, scope, field) => {
      const s = String(scope || '').trim();
      const f = String(field || '').trim();
      const allowed =
        ((s === 'cliente' || s === 'clientes') && ALLOWED_CLIENTE_FIELDS.has(f)) ||
        ((s === 'solicitud' || s === 'solicitudes') && ALLOWED_SOLICITUD_FIELDS.has(f)) ||
        (s === 'oferta' && ALLOWED_OFERTA_FIELDS.has(f)) ||
        (s === 'revision' && ALLOWED_REVISION_FIELDS.has(f)) ||
        (s === 'seguimiento_encuesta' && ALLOWED_SEGUIMIENTO_ENCUESTA_FIELDS.has(f));
      if (!allowed) return '';
      const src = ctx && ctx[s] ? ctx[s] : (data && data[s] ? data[s] : null);
      return src ? valueToText(src[f]) : '';
    }
  );
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

function replaceSolicitudDocCellValue(value, dto, ctx) {
  if (typeof value === 'string') return replaceExcelSolicitudDocText(value, dto, ctx);
  if (value && typeof value === 'object' && Array.isArray(value.richText)) {
    const cloned = clonePlain(value) || {};
    if (cloned && Array.isArray(cloned.richText)) {
      cloned.richText = cloned.richText.map((part) => ({
        ...part,
        text: replaceExcelSolicitudDocText(part?.text, dto, ctx)
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
        row.getCell(col).value = replaceSolicitudDocCellValue(snap.cells[col]?.value, dto, { [loopName]: items[0] });
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
          newCell.value = replaceSolicitudDocCellValue(snap.cells[col]?.value, dto, { [loopName]: items[i] });
        }
        endMarkerRow++;
      }
    }

    sheet.spliceRows(endMarkerRow, 1);
    sheet.spliceRows(startRow, 1);
  }
}

async function generateSolicitudXlsxFromTemplate(templateBuffer, data) {
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

  const invalid = validateSolicitudDocTags(tags);
  if (invalid.length) {
    const err = new Error('Plantilla contiene llaves no permitidas: ' + invalid.slice(0, 20).join(', '));
    err.status = 400;
    throw err;
  }

  workbook.eachSheet((sheet) => {
    applyExcelLoop(sheet, 'clientes', data?.clientes, data);
    applyExcelLoop(sheet, 'solicitudes', data?.solicitudes, data);
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        const v = cell.value;
        if (typeof v === 'string') {
          cell.value = replaceExcelSolicitudDocText(v, data, null);
        } else if (v && typeof v === 'object' && Array.isArray(v.richText)) {
          cell.value = {
            ...v,
            richText: v.richText.map((part) => ({
              ...part,
              text: replaceExcelSolicitudDocText(part?.text, data, null)
            }))
          };
        }
      });
    });
  });

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}

function docxSolicitudDocSafeParser(tag) {
  const raw0 = String(tag ?? '').trim();
  if (!raw0) return { get: () => '' };
  if (/^#(clientes|solicitudes)$/.test(raw0) || /^\/(clientes|solicitudes)$/.test(raw0)) return { get: () => '' };

  const raw = raw0.replace(/^[#/^]+/, '').trim();
  if (/^[A-Za-z0-9_]+$/.test(raw)) {
    const key = raw;
    const allowedKey =
      ALLOWED_CLIENTE_FIELDS.has(key) ||
      ALLOWED_SOLICITUD_FIELDS.has(key) ||
      ALLOWED_OFERTA_FIELDS.has(key) ||
      ALLOWED_REVISION_FIELDS.has(key) ||
      ALLOWED_SEGUIMIENTO_ENCUESTA_FIELDS.has(key);
    if (!allowedKey) {
      const e = new Error('Llave no permitida: ' + raw0);
      e.status = 400;
      throw e;
    }
    return {
      get: (scopeData) => {
        if (!scopeData || typeof scopeData !== 'object') return '';
        if (!Object.prototype.hasOwnProperty.call(scopeData, key)) return '';
        return scopeData[key];
      }
    };
  }

  const m = /^(cliente|solicitud|oferta|revision|seguimiento_encuesta|clientes|solicitudes)\.([A-Za-z0-9_]+)$/.exec(raw);
  if (!m) {
    const e = new Error('Llave no permitida: ' + raw0);
    e.status = 400;
    throw e;
  }

  const scope = m[1];
  const field = m[2];
  const allowed =
    ((scope === 'cliente' || scope === 'clientes') && ALLOWED_CLIENTE_FIELDS.has(field)) ||
    ((scope === 'solicitud' || scope === 'solicitudes') && ALLOWED_SOLICITUD_FIELDS.has(field)) ||
    (scope === 'oferta' && ALLOWED_OFERTA_FIELDS.has(field)) ||
    (scope === 'revision' && ALLOWED_REVISION_FIELDS.has(field)) ||
    (scope === 'seguimiento_encuesta' && ALLOWED_SEGUIMIENTO_ENCUESTA_FIELDS.has(field));
  if (!allowed) {
    const e = new Error('Llave no permitida: ' + raw0);
    e.status = 400;
    throw e;
  }

  return {
    get: (scopeData) => {
      const obj = scopeData && scopeData[scope] ? scopeData[scope] : null;
      return obj ? obj[field] : '';
    }
  };
}

async function generateSolicitudDocxFromTemplate(templateBuffer, data) {
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    parser: docxSolicitudDocSafeParser,
    nullGetter: () => ''
  });

  doc.setData(data || {});
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

async function ensurePlantillasDocumentoSolicitudesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plantillas_documento_solicitudes (
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

const solicitudesController = {
  // ---------- DEPARTAMENTOS Y CIUDADES ----------
  getDepartamentos: async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT codigo, nombre FROM departamentos ORDER BY nombre ASC');
      res.json(rows);
    } catch (err) {
      console.error('GET /departamentos error', err);
      res.status(500).json({ message: 'Error obteniendo departamentos' });
    }
  },

  getCiudades: async (req, res) => {
    const codigoDepartamento = String(req.query.departamento || '').trim();

    // Some DBs use different column names for the departamento code in `ciudades`.
    // Detect once per process to avoid 500s caused by schema mismatch.
    if (!global.__ciudadesDeptColumn) {
      try {
        const [cols] = await pool.query('SHOW COLUMNS FROM ciudades');
        const fields = new Set((cols || []).map((c) => String(c.Field || '').toLowerCase()));
        const candidates = [
          'codigo_departamento',
          'departamento_codigo',
          'id_departamento',
          'codigo_depto',
          'cod_depto',
          'depto_codigo'
        ];
        global.__ciudadesDeptColumn = candidates.find((c) => fields.has(c)) || null;
      } catch (e) {
        // If table doesn't exist or SHOW fails, leave null and let query below error.
        global.__ciudadesDeptColumn = null;
      }
    }

    try {
      const deptCol = global.__ciudadesDeptColumn || 'id_departamento';
      let query = `SELECT codigo, nombre, ${deptCol} AS codigo_departamento FROM ciudades`;
      const params = [];
      if (codigoDepartamento) {
        query += ` WHERE ${deptCol} = ?`;
        params.push(codigoDepartamento);
      }
      query += ' ORDER BY nombre ASC';
      const [rows] = await pool.query(query, params);
      res.json(rows);
    } catch (err) {
      console.error('GET /ciudades error', err);
      res.status(500).json({ message: 'Error obteniendo ciudades' });
    }
  },

  // ---------- CLIENTES CRUD ----------
  getClientes: async (req, res) => {
    const q = req.query.q || '';
    try {
      const [rows] = await pool.query(
        `SELECT id_cliente, nombre_solicitante, numero_identificacion, correo_electronico, id_ciudad, id_departamento, activo, tipo_usuario
         FROM clientes
         WHERE nombre_solicitante LIKE ? OR correo_electronico LIKE ?
         ORDER BY id_cliente DESC
         LIMIT 200`,
        [`%${q}%`, `%${q}%`]
      );
      res.json(rows);
    } catch (err) {
      console.error('GET /clientes error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  exportClientesExcel: async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT
          c.id_cliente,
          c.numero,
          c.fecha_vinculacion,
          c.tipo_usuario,
          c.razon_social,
          c.nit,
          c.nombre_solicitante,
          c.tipo_identificacion,
          c.numero_identificacion,
          c.sexo,
          c.tipo_poblacion,
          c.direccion,
          ci.nombre AS ciudad,
          d.nombre AS departamento,
          c.celular,
          c.telefono,
          c.correo_electronico,
          c.tipo_vinculacion,
          c.registro_realizado_por,
          c.observaciones,
          c.activo,
          c.created_at,
          c.updated_at
         FROM clientes c
         LEFT JOIN ciudades ci ON ci.codigo = c.id_ciudad
         LEFT JOIN departamentos d ON d.codigo = c.id_departamento
         ORDER BY c.id_cliente DESC`
      );
      const orderedColumns = rows.length ? Object.keys(rows[0]) : [];

      const workbook = new ExcelJS.Workbook();
      workbook.created = new Date();
      workbook.modified = new Date();
      const worksheet = workbook.addWorksheet('Clientes');

      worksheet.columns = orderedColumns.map((columnKey) => ({
        header: String(columnKey || '')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (match) => match.toUpperCase()),
        key: columnKey,
        width: Math.min(Math.max(String(columnKey || '').length + 6, 16), 42)
      }));

      for (const row of rows) {
        const rowData = {};
        for (const columnKey of orderedColumns) {
          rowData[columnKey] = row?.[columnKey] ?? '';
        }
        worksheet.addRow(rowData);
      }

      const headerRow = worksheet.getRow(1);
      headerRow.height = 24;
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF166534' }
      };

      if (orderedColumns.length > 0) {
        worksheet.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: 1, column: orderedColumns.length }
        };
      }

      worksheet.views = [{ state: 'frozen', ySplit: 1 }];

      const filename = `clientes_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(Buffer.from(buffer));
    } catch (err) {
      console.error('GET /clientes/export/excel error', err);
      return res.status(500).json({ message: 'No se pudo exportar clientes a Excel' });
    }
  },

  exportClientesSolicitudesExcel: async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT
          s.tipo_solicitud,
          s.fecha_solicitud,
          s.solicitud_id,
          c.nombre_solicitante,
          c.numero_identificacion,
          c.razon_social,
          c.nit,
          c.correo_electronico,
          c.celular,
          ci.nombre AS ciudad,
          c.direccion,
          s.tipo_muestra,
          s.cant_muestras
         FROM Solicitudes s
         LEFT JOIN clientes c ON c.id_cliente = s.id_cliente
         LEFT JOIN ciudades ci ON ci.codigo = c.id_ciudad
         ORDER BY s.solicitud_id DESC`
      );

      const workbook = new ExcelJS.Workbook();
      workbook.created = new Date();
      workbook.modified = new Date();
      const worksheet = workbook.addWorksheet('SolicitudesClientes');

      worksheet.columns = [
        { header: 'Tipo de solicitud', key: 'tipo_solicitud', width: 24 },
        { header: 'Nombre del Solicitante', key: 'nombre_solicitante', width: 32 },
        { header: 'Número de identificación', key: 'numero_identificacion', width: 26 },
        { header: 'Empresa', key: 'razon_social', width: 30 },
        { header: 'NIT', key: 'nit', width: 20 },
        { header: 'Correo Electrónico', key: 'correo_electronico', width: 34 },
        { header: 'Celular', key: 'celular', width: 18 },
        { header: 'Ciudad', key: 'ciudad', width: 24 },
        { header: 'Dirección', key: 'direccion', width: 36 },
        { header: 'Número de solicitud', key: 'numero_solicitud', width: 22 },
        { header: 'Tipo de muestra', key: 'tipo_muestra', width: 22 },
        { header: 'Cantidad de muestras', key: 'cant_muestras', width: 22 }
      ];

      for (const row of rows || []) {
        const numeroSolicitudPreview = await getSolicitudPreviewCode(
          row?.tipo_solicitud,
          row?.fecha_solicitud,
          row?.solicitud_id
        );
        worksheet.addRow({
          tipo_solicitud: row?.tipo_solicitud ?? '',
          nombre_solicitante: row?.nombre_solicitante ?? '',
          numero_identificacion: row?.numero_identificacion ?? '',
          razon_social: row?.razon_social ?? '',
          nit: row?.nit ?? '',
          correo_electronico: row?.correo_electronico ?? '',
          celular: row?.celular ?? '',
          ciudad: row?.ciudad ?? '',
          direccion: row?.direccion ?? '',
          numero_solicitud: numeroSolicitudPreview ?? '',
          tipo_muestra: row?.tipo_muestra ?? '',
          cant_muestras: row?.cant_muestras ?? ''
        });
      }

      const headerRow = worksheet.getRow(1);
      headerRow.height = 24;
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF166534' }
      };

      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: worksheet.columns.length }
      };
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];

      const filename = `solicitudes_clientes_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(Buffer.from(buffer));
    } catch (err) {
      console.error('GET /clientes-solicitudes/export/excel error', err);
      return res.status(500).json({ message: 'No se pudo exportar el Excel de solicitudes y clientes' });
    }
  },

  createCliente: async (req, res) => {
    const body = req.body || {};
    const required = ['nombre_solicitante', 'tipo_identificacion', 'numero_identificacion'];
    for (const f of required) if (!body[f]) return res.status(400).json({ message: `Missing ${f}` });

    try {
      let numeroVal = body.numero || null;
      if (!numeroVal) {
        try {
          const [rmax] = await pool.query('SELECT MAX(numero) AS max FROM clientes');
          const maxNum = (rmax && rmax[0] && rmax[0].max) ? parseInt(rmax[0].max, 10) : 0;
          numeroVal = maxNum + 1;
        } catch (e) {
          numeroVal = 1;
        }
      }

      const fechaVinc = body.fecha_vinculacion || new Date().toISOString().slice(0, 10);
      const tipoUsuarioVal = body.tipo_usuario || 'Persona Natural';
      const sexoVal = body.sexo || 'Otro';

      const [result] = await pool.query(
        `INSERT INTO clientes (numero, fecha_vinculacion, tipo_usuario, razon_social, nit, nombre_solicitante, tipo_identificacion, numero_identificacion, sexo, tipo_poblacion, direccion, id_ciudad, id_departamento, celular, telefono, correo_electronico, tipo_vinculacion, registro_realizado_por, observaciones)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          numeroVal,
          fechaVinc,
          tipoUsuarioVal,
          body.razon_social || null,
          body.nit || null,
          body.nombre_solicitante,
          body.tipo_identificacion,
          body.numero_identificacion,
          sexoVal,
          body.tipo_poblacion || null,
          body.direccion || null,
          body.id_ciudad || null,
          body.id_departamento || null,
          body.celular || null,
          body.telefono || null,
          body.correo_electronico || null,
          body.tipo_vinculacion || null,
          body.registro_realizado_por || null,
          body.observaciones || null
        ]
      );

      if (req.user && req.user.id) {
        const fecha = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/Bogota',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date());
        const descripcion = buildClienteDescripcion({
          accion: 'Creación de',
          idCliente: result.insertId,
          nombre: body.razon_social || body.nombre_solicitante,
          identificacion: body.numero_identificacion
        });
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
          [req.user.id, 'CREAR', 'CLIENTES', fecha, descripcion]
        );
      }

      res.status(201).json({ id_cliente: result.insertId });
    } catch (err) {
      console.error('POST /clientes error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  getClienteById: async (req, res) => {
    const id = req.params.id;
    try {
      const [rows] = await pool.query('SELECT * FROM clientes WHERE id_cliente = ?', [id]);
      if (!rows.length) return res.status(404).json({ message: 'Not found' });
      res.json(rows[0]);
    } catch (err) {
      console.error('GET /clientes/:id error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  updateCliente: async (req, res) => {
    const id = req.params.id;
    const body = req.body || {};
    try {
      // Obtener datos actuales
      const [rowsCurrent] = await pool.query('SELECT * FROM clientes WHERE id_cliente = ?', [id]);
      if (!rowsCurrent.length) return res.status(404).json({ message: 'Cliente no encontrado' });
      const datosActuales = rowsCurrent[0];

      const fields = [];
      const values = [];
      const datosNuevos = {};

      for (const k of Object.keys(body)) {
        fields.push(`${k} = ?`);
        values.push(body[k]);
        datosNuevos[k] = body[k];
      }
      if (!fields.length) return res.status(400).json({ message: 'No fields to update' });
      values.push(id);
      await pool.query(`UPDATE clientes SET ${fields.join(', ')} WHERE id_cliente = ?`, values);

      if (req.user && req.user.id) {
        const cambios = {};
        const normalize = (val) => {
          if (val instanceof Date) return val.toISOString().split('T')[0];
          if (val === null || val === undefined) return '';
          return String(val).trim();
        };

        for (const key in datosNuevos) {
          if (Object.prototype.hasOwnProperty.call(datosNuevos, key)) {
            // Comparar solo si la clave existe en datosActuales (para evitar undefined en columnas que no están en select * si pasara algo raro, pero aquí es seguro)
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
           const fecha = new Intl.DateTimeFormat('sv-SE', {
              timeZone: 'America/Bogota',
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit'
           }).format(new Date());

           await pool.query(
              'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
              [req.user.id, 'ACTUALIZAR', 'CLIENTES', fecha, `Actualización cliente: ${id}`]
           );
        }
      }

      res.json({ updated: true });
    } catch (err) {
      console.error('PUT /clientes/:id error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  deleteCliente: async (req, res) => {
    const id = req.params.id;

    try {
      if (req.user && req.user.rol !== 'Administrador' && req.user.rol !== 'Superadmin') {
        return res.status(403).json({ 
          message: 'No tienes permisos para eliminar clientes. Solo administradores pueden realizar esta acción.' 
        });
      }

      const [result] = await pool.query('DELETE FROM clientes WHERE id_cliente = ?', [id]);
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Cliente no encontrado' });
      }

      if (req.user && req.user.id) {
        const fecha = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/Bogota',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date());
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha) VALUES (?, ?, ?, ?)',
          [req.user.id, 'ELIMINAR', 'CLIENTES', fecha]
        );
      }

      res.json({ deleted: true });
    } catch (err) {
      console.error('DELETE /clientes/:id error', err);
      res.status(500).json({ message: 'Error eliminando cliente' });
    }
  },

  // ---------- SOLICITUDES CRUD ----------
  getSolicitudes: async (req, res) => {
    try {
      const isAdmin = req.user && req.user.rol === 'Administrador';
      const params = [];
      const where = isAdmin ? 'WHERE s.id_admin = ?' : '';
      if (isAdmin) {
        if (!Number.isFinite(Number(req.user.id))) {
          return res.status(403).json({ message: 'No autorizado' });
        }
        params.push(Number(req.user.id));
      }
      const [rows] = await pool.query(
        `SELECT 
            s.solicitud_id, s.id_cliente, s.id_estado, s.id_admin, s.tipo_solicitud, s.id_tipo_af, s.nombre_muestra, s.fecha_solicitud, s.lote_producto,
            s.fecha_vencimiento_muestra, s.tipo_muestra, s.tipo_empaque, s.analisis_requerido, s.req_analisis,
            s.cant_muestras, s.solicitud_recibida, s.fecha_entrega_muestra, s.recibe_personal, s.cargo_personal, s.observaciones,
            u.nombre_solicitante, u.correo_electronico,
            es.nombre_estado,
            ua.email AS admin_email,
            r.concepto_final
         FROM Solicitudes s
         LEFT JOIN clientes u ON s.id_cliente = u.id_cliente
         LEFT JOIN estados_solicitud es ON s.id_estado = es.id_estado
         LEFT JOIN usuarios ua ON s.id_admin = ua.id_usuario
         LEFT JOIN revision_oferta r ON r.id_solicitud = s.solicitud_id
         ${where}
         ORDER BY s.solicitud_id DESC
         LIMIT 500`,
        params
      );
      res.json(rows);
    } catch (err) {
      console.error('GET /solicitudes error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  exportSolicitudesExcel: async (req, res) => {
    try {
      const isAdmin = req.user && req.user.rol === 'Administrador';
      const params = [];
      const where = isAdmin ? 'WHERE s.id_admin = ?' : '';
      if (isAdmin) {
        if (!Number.isFinite(Number(req.user.id))) {
          return res.status(403).json({ message: 'No autorizado' });
        }
        params.push(Number(req.user.id));
      }

      const [rows] = await pool.query(
        `SELECT 
           s.solicitud_id,
           s.id_cliente,
           s.id_estado,
           s.id_admin,
           s.tipo_solicitud,
           s.id_tipo_af,
           s.nombre_muestra,
           s.fecha_solicitud,
           s.lote_producto,
           s.fecha_vencimiento_muestra,
           s.tipo_muestra,
           s.tipo_empaque,
           s.analisis_requerido,
           s.req_analisis,
           s.cant_muestras,
           s.solicitud_recibida,
           s.fecha_entrega_muestra,
           s.recibe_personal,
           s.cargo_personal,
           s.observaciones,
           u.nombre_solicitante,
           u.correo_electronico,
           es.nombre_estado,
           ua.email AS admin_email,
           o.genero_cotizacion,
           o.valor_cotizacion,
           o.fecha_envio_oferta,
           o.realizo_seguimiento_oferta,
           o.observacion_oferta,
           r.fecha_limite_entrega,
           r.tipo_muestra_especificado,
           r.ensayos_requeridos_claros,
           r.equipos_calibrados,
           r.personal_competente,
           r.infraestructura_adecuada,
           r.insumos_vigentes,
           r.cumple_tiempos_entrega,
           r.normas_metodos_especificados,
           r.metodo_validado_verificado,
           r.metodo_adecuado,
           r.observaciones_tecnicas,
           r.concepto_final,
           e.fecha_encuesta,
           e.fecha_realizacion_encuesta,
           e.comentarios,
           e.recomendaria_servicio,
           e.cliente_respondio,
           e.solicito_nueva_encuesta
         FROM Solicitudes s
         LEFT JOIN clientes u ON s.id_cliente = u.id_cliente
         LEFT JOIN estados_solicitud es ON s.id_estado = es.id_estado
         LEFT JOIN usuarios ua ON s.id_admin = ua.id_usuario
         LEFT JOIN oferta o ON o.id_solicitud = s.solicitud_id
         LEFT JOIN revision_oferta r ON r.id_solicitud = s.solicitud_id
         LEFT JOIN seguimiento_encuesta e ON e.id_solicitud = s.solicitud_id
         ${where}
         ORDER BY s.solicitud_id DESC
         LIMIT 500`,
        params
      );

      const normalizeBinaryValue = (value) => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'boolean') return value ? 'si' : 'no';
        if (typeof value === 'number') {
          if (value === 1) return 'si';
          if (value === 0) return 'no';
          return value;
        }
        const normalized = String(value).trim().toLowerCase();
        if (normalized === '1' || normalized === 'true' || normalized === 'si' || normalized === 'sí') return 'si';
        if (normalized === '0' || normalized === 'false' || normalized === 'no') return 'no';
        return value;
      };

      const preparedRows = await Promise.all(
        (rows || []).map(async (row) => {
          const codigoSolicitud = await getSolicitudPreviewCode(
            row?.tipo_solicitud,
            row?.fecha_solicitud,
            row?.solicitud_id
          );
          return {
            codigo_solicitud: codigoSolicitud ?? '',
            nombre_cliente: row?.nombre_solicitante ?? '',
            tipo_solicitud: row?.tipo_solicitud ?? '',
            nombre_muestra: row?.nombre_muestra ?? '',
            fecha_solicitud: row?.fecha_solicitud ?? '',
            lote_producto: row?.lote_producto ?? '',
            fecha_vencimiento_muestra: row?.fecha_vencimiento_muestra ?? '',
            tipo_muestra: row?.tipo_muestra ?? '',
            tipo_empaque: row?.tipo_empaque ?? '',
            analisis_requerido: row?.analisis_requerido ?? '',
            req_analisis: normalizeBinaryValue(row?.req_analisis),
            cant_muestras: row?.cant_muestras ?? '',
            solicitud_recibida: normalizeBinaryValue(row?.solicitud_recibida),
            fecha_entrega_muestra: row?.fecha_entrega_muestra ?? '',
            recibe_personal: row?.recibe_personal ?? '',
            cargo_personal: row?.cargo_personal ?? '',
            observaciones: row?.observaciones ?? '',
            correo_electronico: row?.correo_electronico ?? '',
            estado: row?.nombre_estado ?? '',
            admin_email: row?.admin_email ?? '',
            genero_cotizacion: row?.genero_cotizacion ?? '',
            valor_cotizacion: row?.valor_cotizacion ?? '',
            fecha_envio_oferta: row?.fecha_envio_oferta ?? '',
            realizo_seguimiento_oferta: normalizeBinaryValue(row?.realizo_seguimiento_oferta),
            observacion_oferta: row?.observacion_oferta ?? '',
            fecha_limite_entrega: row?.fecha_limite_entrega ?? '',
            tipo_muestra_especificado: row?.tipo_muestra_especificado ?? '',
            ensayos_requeridos_claros: normalizeBinaryValue(row?.ensayos_requeridos_claros),
            equipos_calibrados: normalizeBinaryValue(row?.equipos_calibrados),
            personal_competente: normalizeBinaryValue(row?.personal_competente),
            infraestructura_adecuada: normalizeBinaryValue(row?.infraestructura_adecuada),
            insumos_vigentes: normalizeBinaryValue(row?.insumos_vigentes),
            cumple_tiempos_entrega: normalizeBinaryValue(row?.cumple_tiempos_entrega),
            normas_metodos_especificados: normalizeBinaryValue(row?.normas_metodos_especificados),
            metodo_validado_verificado: normalizeBinaryValue(row?.metodo_validado_verificado),
            metodo_adecuado: normalizeBinaryValue(row?.metodo_adecuado),
            observaciones_tecnicas: row?.observaciones_tecnicas ?? '',
            concepto_final: row?.concepto_final ?? '',
            fecha_encuesta: row?.fecha_encuesta ?? '',
            fecha_realizacion_encuesta: row?.fecha_realizacion_encuesta ?? '',
            comentarios: row?.comentarios ?? '',
            recomendaria_servicio: normalizeBinaryValue(row?.recomendaria_servicio),
            cliente_respondio: normalizeBinaryValue(row?.cliente_respondio),
            solicito_nueva_encuesta: normalizeBinaryValue(row?.solicito_nueva_encuesta)
          };
        })
      );

      const orderedColumns = [
        { key: 'codigo_solicitud', header: 'Codigo solicitud', width: 20 },
        { key: 'nombre_cliente', header: 'Nombre cliente', width: 28 },
        { key: 'tipo_solicitud', header: 'Tipo solicitud', width: 22 },
        { key: 'nombre_muestra', header: 'Nombre muestra', width: 24 },
        { key: 'fecha_solicitud', header: 'Fecha solicitud', width: 18 },
        { key: 'lote_producto', header: 'Lote producto', width: 22 },
        { key: 'fecha_vencimiento_muestra', header: 'Fecha vencimiento muestra', width: 24 },
        { key: 'tipo_muestra', header: 'Tipo muestra', width: 20 },
        { key: 'tipo_empaque', header: 'Tipo empaque', width: 20 },
        { key: 'analisis_requerido', header: 'Analisis requerido', width: 24 },
        { key: 'req_analisis', header: 'Req analisis', width: 20 },
        { key: 'cant_muestras', header: 'Cant muestras', width: 16 },
        { key: 'solicitud_recibida', header: 'Solicitud recibida', width: 18 },
        { key: 'fecha_entrega_muestra', header: 'Fecha entrega muestra', width: 22 },
        { key: 'recibe_personal', header: 'Recibe personal', width: 20 },
        { key: 'cargo_personal', header: 'Cargo personal', width: 20 },
        { key: 'observaciones', header: 'Observaciones', width: 30 },
        { key: 'correo_electronico', header: 'Correo electronico', width: 28 },
        { key: 'estado', header: 'Estado', width: 20 },
        { key: 'admin_email', header: 'Admin email', width: 26 },
        { key: 'genero_cotizacion', header: 'Genero cotizacion', width: 20 },
        { key: 'valor_cotizacion', header: 'Valor cotizacion', width: 18 },
        { key: 'fecha_envio_oferta', header: 'Fecha envio oferta', width: 20 },
        { key: 'realizo_seguimiento_oferta', header: 'Realizo seguimiento oferta', width: 26 },
        { key: 'observacion_oferta', header: 'Observacion oferta', width: 30 },
        { key: 'fecha_limite_entrega', header: 'Fecha limite entrega', width: 20 },
        { key: 'tipo_muestra_especificado', header: 'Tipo muestra especificado', width: 24 },
        { key: 'ensayos_requeridos_claros', header: 'Ensayos requeridos claros', width: 24 },
        { key: 'equipos_calibrados', header: 'Equipos calibrados', width: 18 },
        { key: 'personal_competente', header: 'Personal competente', width: 20 },
        { key: 'infraestructura_adecuada', header: 'Infraestructura adecuada', width: 24 },
        { key: 'insumos_vigentes', header: 'Insumos vigentes', width: 18 },
        { key: 'cumple_tiempos_entrega', header: 'Cumple tiempos entrega', width: 22 },
        { key: 'normas_metodos_especificados', header: 'Normas metodos especificados', width: 28 },
        { key: 'metodo_validado_verificado', header: 'Metodo validado verificado', width: 26 },
        { key: 'metodo_adecuado', header: 'Metodo adecuado', width: 18 },
        { key: 'observaciones_tecnicas', header: 'Observaciones tecnicas', width: 30 },
        { key: 'concepto_final', header: 'Concepto final', width: 20 },
        { key: 'fecha_encuesta', header: 'Fecha encuesta', width: 18 },
        { key: 'fecha_realizacion_encuesta', header: 'Fecha realizacion encuesta', width: 24 },
        { key: 'comentarios', header: 'Comentarios', width: 30 },
        { key: 'recomendaria_servicio', header: 'Recomendaria servicio', width: 22 },
        { key: 'cliente_respondio', header: 'Cliente respondio', width: 18 },
        { key: 'solicito_nueva_encuesta', header: 'Solicito nueva encuesta', width: 22 }
      ];
      const workbook = new ExcelJS.Workbook();
      workbook.created = new Date();
      workbook.modified = new Date();
      const worksheet = workbook.addWorksheet('Solicitudes');

      worksheet.columns = orderedColumns;

      for (const row of preparedRows) {
        const rowData = {};
        for (const column of orderedColumns) {
          rowData[column.key] = row?.[column.key] ?? '';
        }
        worksheet.addRow(rowData);
      }

      worksheet.eachRow((currentRow, rowNumber) => {
        if (rowNumber === 1) return;
        currentRow.eachCell((cell) => {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        });
      });

      const headerRow = worksheet.getRow(1);
      headerRow.height = 24;
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF166534' }
      };

      if (orderedColumns.length > 0) {
        worksheet.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: 1, column: orderedColumns.length }
        };
      }
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];

      const filename = `solicitudes_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(Buffer.from(buffer));
    } catch (err) {
      console.error('GET /solicitudes/export/excel error', err);
      return res.status(500).json({ message: 'No se pudo exportar solicitudes a Excel' });
    }
  },

  // Joined detail list: Solicitudes + oferta + revision_oferta + seguimiento_encuesta
  getSolicitudesDetalle: async (req, res) => {
    try {
      const isAdmin = req.user && req.user.rol === 'Administrador';
      const params = [];
      const where = isAdmin ? 'WHERE s.id_admin = ?' : '';
      if (isAdmin) {
        if (!Number.isFinite(Number(req.user.id))) {
          return res.status(403).json({ message: 'No autorizado' });
        }
        params.push(Number(req.user.id));
      }
      const [rows] = await pool.query(
        `SELECT 
           s.solicitud_id,
           s.id_cliente,
           s.id_estado,
           s.id_admin,
           s.tipo_solicitud,
           s.id_tipo_af,
           s.nombre_muestra,
           s.fecha_solicitud,
           s.lote_producto,
           s.fecha_vencimiento_muestra,
           s.tipo_muestra,
           s.tipo_empaque,
           s.analisis_requerido,
           s.req_analisis,
           s.cant_muestras,
           s.solicitud_recibida,
           s.fecha_entrega_muestra,
           s.recibe_personal,
           s.cargo_personal,
           s.observaciones,
           u.nombre_solicitante,
           u.correo_electronico,
           es.nombre_estado,
           ua.email AS admin_email,
           o.genero_cotizacion,
           o.valor_cotizacion,
           o.fecha_envio_oferta,
           o.realizo_seguimiento_oferta,
           o.observacion_oferta,
           r.fecha_limite_entrega,
           r.tipo_muestra_especificado,
           r.ensayos_requeridos_claros,
           r.equipos_calibrados,
           r.personal_competente,
           r.infraestructura_adecuada,
           r.insumos_vigentes,
           r.cumple_tiempos_entrega,
           r.normas_metodos_especificados,
           r.metodo_validado_verificado,
           r.metodo_adecuado,
           r.observaciones_tecnicas,
           r.concepto_final,
           e.fecha_encuesta,
           e.fecha_realizacion_encuesta,
           e.comentarios,
           e.recomendaria_servicio,
           e.cliente_respondio,
           e.solicito_nueva_encuesta
         FROM Solicitudes s
         LEFT JOIN clientes u ON s.id_cliente = u.id_cliente
         LEFT JOIN estados_solicitud es ON s.id_estado = es.id_estado
         LEFT JOIN usuarios ua ON s.id_admin = ua.id_usuario
         LEFT JOIN oferta o ON o.id_solicitud = s.solicitud_id
         LEFT JOIN revision_oferta r ON r.id_solicitud = s.solicitud_id
         LEFT JOIN seguimiento_encuesta e ON e.id_solicitud = s.solicitud_id
         ${where}
         ORDER BY s.solicitud_id DESC
         LIMIT 500`,
        params
      );
      const list = rows || [];
      const withCodes = await Promise.all(
        list.map(async (row) => {
          const numero_solicitud_front = await getSolicitudPreviewCode(
            row?.tipo_solicitud,
            row?.fecha_solicitud,
            row?.solicitud_id
          );
          return { ...row, numero_solicitud_front };
        })
      );
      res.json(withCodes);
    } catch (err) {
      console.error('GET /solicitudes/detalle/lista error', err);
      res.status(500).json({ message: 'Error obteniendo detalle de solicitudes' });
    }
  },

  getSolicitudDetalleById: async (req, res) => {
    const id = req.params.id;
    try {
      const isAdmin = req.user && req.user.rol === 'Administrador';
      const params = [];
      let where = 'WHERE s.solicitud_id = ?';
      params.push(id);
      if (isAdmin) {
        if (!Number.isFinite(Number(req.user.id))) {
          return res.status(403).json({ message: 'No autorizado' });
        }
        where += ' AND s.id_admin = ?';
        params.push(Number(req.user.id));
      }
      const [rows] = await pool.query(
        `SELECT 
           s.solicitud_id,
           s.id_cliente,
           s.id_estado,
           s.id_admin,
           s.tipo_solicitud,
           s.id_tipo_af,
           s.nombre_muestra,
           s.fecha_solicitud,
           s.lote_producto,
           s.fecha_vencimiento_muestra,
           s.tipo_muestra,
           s.tipo_empaque,
           s.analisis_requerido,
           s.req_analisis,
           s.cant_muestras,
           s.solicitud_recibida,
           s.fecha_entrega_muestra,
           s.recibe_personal,
           s.cargo_personal,
           s.observaciones,
           u.nombre_solicitante,
           u.correo_electronico,
           es.nombre_estado,
           ua.email AS admin_email,
           o.genero_cotizacion,
           o.valor_cotizacion,
           o.fecha_envio_oferta,
           o.realizo_seguimiento_oferta,
           o.observacion_oferta,
           r.fecha_limite_entrega,
           r.tipo_muestra_especificado,
           r.ensayos_requeridos_claros,
           r.equipos_calibrados,
           r.personal_competente,
           r.infraestructura_adecuada,
           r.insumos_vigentes,
           r.cumple_tiempos_entrega,
           r.normas_metodos_especificados,
           r.metodo_validado_verificado,
           r.metodo_adecuado,
           r.observaciones_tecnicas,
           r.concepto_final,
           e.fecha_encuesta,
           e.fecha_realizacion_encuesta,
           e.comentarios,
           e.recomendaria_servicio,
           e.cliente_respondio,
           e.solicito_nueva_encuesta
         FROM Solicitudes s
         LEFT JOIN clientes u ON s.id_cliente = u.id_cliente
         LEFT JOIN estados_solicitud es ON s.id_estado = es.id_estado
         LEFT JOIN usuarios ua ON s.id_admin = ua.id_usuario
         LEFT JOIN oferta o ON o.id_solicitud = s.solicitud_id
         LEFT JOIN revision_oferta r ON r.id_solicitud = s.solicitud_id
         LEFT JOIN seguimiento_encuesta e ON e.id_solicitud = s.solicitud_id
         ${where}
         LIMIT 1`,
        params
      );
      if (!rows || rows.length === 0) return res.status(404).json({ message: 'Solicitud no encontrada' });
      const row = rows[0];
      const numero_solicitud_front = await getSolicitudPreviewCode(
        row?.tipo_solicitud,
        row?.fecha_solicitud,
        row?.solicitud_id
      );
      res.json({ ...row, numero_solicitud_front });
    } catch (err) {
      console.error('GET /solicitudes/detalle/:id error', err);
      res.status(500).json({ message: 'Error obteniendo detalle de solicitud' });
    }
  },

  createSolicitud: async (req, res) => {
    const b = req.body || {};
    if (!b.id_cliente) return res.status(400).json({ message: 'Missing id_cliente' });

    try {
      const estadoId = Number(b.id_estado) || await getEstadoIdByName(b.nombre_estado) || await getEstadoIdByName('EN_ESPERA');
      const adminId = Number.isFinite(Number(b.id_admin)) ? Number(b.id_admin) : null;
      let sql;
      let params;
      
      if (b.solicitud_id) {
        sql = `INSERT INTO Solicitudes (
          solicitud_id, id_cliente, id_estado, id_admin, tipo_solicitud, id_tipo_af, nombre_muestra, fecha_solicitud, lote_producto,
          fecha_vencimiento_muestra, tipo_muestra, tipo_empaque, analisis_requerido,
          req_analisis, cant_muestras, solicitud_recibida, fecha_entrega_muestra,
          recibe_personal, cargo_personal, observaciones
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
        params = [
          b.solicitud_id,
          b.id_cliente,
          estadoId || null,
          adminId,
          b.tipo_solicitud || null,
          b.id_tipo_af || null,
          b.nombre_muestra || null,
          b.fecha_solicitud || null,
          b.lote_producto || null,
          b.fecha_vencimiento_muestra || null,
          b.tipo_muestra || null,
          b.tipo_empaque || null,
          b.analisis_requerido || null,
          b.req_analisis ? 1 : 0,
          b.cant_muestras || null,
          b.solicitud_recibida || null,
          b.fecha_entrega_muestra || null,
          b.recibe_personal || null,
          b.cargo_personal || null,
          b.observaciones || null
        ];
      } else {
        sql = `INSERT INTO Solicitudes (
          id_cliente, id_estado, id_admin, tipo_solicitud, id_tipo_af, nombre_muestra, fecha_solicitud, lote_producto,
          fecha_vencimiento_muestra, tipo_muestra, tipo_empaque, analisis_requerido,
          req_analisis, cant_muestras, solicitud_recibida, fecha_entrega_muestra,
          recibe_personal, cargo_personal, observaciones
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
        params = [
          b.id_cliente,
          estadoId || null,
          adminId,
          b.tipo_solicitud || null,
          b.id_tipo_af || null,
          b.nombre_muestra || null,
          b.fecha_solicitud || null,
          b.lote_producto || null,
          b.fecha_vencimiento_muestra || null,
          b.tipo_muestra || null,
          b.tipo_empaque || null,
          b.analisis_requerido || null,
          b.req_analisis ? 1 : 0,
          b.cant_muestras || null,
          b.solicitud_recibida || null,
          b.fecha_entrega_muestra || null,
          b.recibe_personal || null,
          b.cargo_personal || null,
          b.observaciones || null
        ];
      }

      const [result] = await pool.query(sql, params);

      if (req.user && req.user.id) {
        const fecha = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/Bogota',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date());
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha) VALUES (?, ?, ?, ?)',
          [req.user.id, 'CREAR', 'SOLICITUDES', fecha]
        );
      }

      // Notificar suscriptores de solicitudes
      try {
        const fixedEmail = process.env.SOLICITUDES_NOTIFICATION_EMAIL || 'serviciostecnologicoscbi@sena.edu.co';
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (re.test(fixedEmail)) {
          const id = b.solicitud_id || result.insertId;
          const tipo = b.tipo_solicitud || 'N/A';
          const previewCode = await getSolicitudPreviewCode(tipo, b.fecha_solicitud, id);
          const subject = `Solicitud Registrada: ${previewCode}`;
          const bodyHtml = `<p>${previewCode}</p>`;
          const text = `${previewCode}`;

          setImmediate(() => {
            sendMail(fixedEmail, subject, text, bodyHtml)
              .catch((err) => console.warn('Error notificando suscriptores de solicitudes:', err));
          });
        }
      } catch (notifyErr) {
        console.warn('Error notificando suscriptores de solicitudes:', notifyErr);
      }

      // Notificar asignación de solicitud (admin)
      if (adminId) {
        try {
          const [adminRows] = await pool.query(
            'SELECT email FROM usuarios WHERE id_usuario = ? LIMIT 1',
            [adminId]
          );
          const adminEmail = adminRows && adminRows[0] ? adminRows[0].email : null;
          if (adminEmail) {
            const id = b.solicitud_id || result.insertId;
            const tipo = b.tipo_solicitud || 'N/A';
            const nombre = b.nombre_muestra || 'N/A';
          const previewCode = await getSolicitudPreviewCode(tipo, b.fecha_solicitud, id);
          const subject = `Solicitud asignada: ${previewCode}`;
          const text = `Se te asignó la solicitud ${previewCode}`;
          const html = `<h3>Solicitud asignada</h3><p><strong>Código:</strong> ${previewCode}</p><p><strong>Muestra:</strong> ${nombre}</p>`;
          setImmediate(() => {
            sendMail(adminEmail, subject, text, html)
              .catch((err) => console.warn('Error notificando asignación de solicitud:', err));
          });
          }
        } catch (assignErr) {
          console.warn('Error notificando asignación de solicitud:', assignErr);
        }
      }

      res.status(201).json({ solicitud_id: result.insertId });
    } catch (err) {
      console.error('POST /solicitudes error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  getSolicitudById: async (req, res) => {
    const id = req.params.id;
    try {
      const isAdmin = req.user && req.user.rol === 'Administrador';
      const params = [];
      let where = 'WHERE s.solicitud_id = ?';
      params.push(id);
      if (isAdmin) {
        if (!Number.isFinite(Number(req.user.id))) {
          return res.status(403).json({ message: 'No autorizado' });
        }
        where += ' AND s.id_admin = ?';
        params.push(Number(req.user.id));
      }
      const [rows] = await pool.query(
        `SELECT s.*, u.nombre_solicitante, u.correo_electronico FROM Solicitudes s LEFT JOIN clientes u ON s.id_cliente = u.id_cliente ${where}`,
        params
      );
      if (!rows.length) return res.status(404).json({ message: 'Not found' });
      res.json(rows[0]);
    } catch (err) {
      console.error('GET /solicitudes/:id error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  updateSolicitud: async (req, res) => {
    const id = req.params.id;
    const body = req.body || {};
    try {
      if (req.user && req.user.rol === 'Administrador') {
        return res.status(403).json({ message: 'No tienes permisos para editar solicitudes.' });
      }
      // Obtener datos actuales
      const [rowsCurrent] = await pool.query('SELECT * FROM Solicitudes WHERE solicitud_id = ?', [id]);
      if (!rowsCurrent.length) return res.status(404).json({ message: 'Solicitud no encontrada' });
      const datosActuales = rowsCurrent[0];

      const fields = [];
      const values = [];
      const datosNuevos = {};

      for (const k of Object.keys(body)) {
        fields.push(`${k} = ?`);
        values.push(body[k]);
        datosNuevos[k] = body[k];
      }
      if (!fields.length) return res.status(400).json({ message: 'No fields to update' });
      values.push(id);
      await pool.query(`UPDATE Solicitudes SET ${fields.join(', ')} WHERE solicitud_id = ?`, values);

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

        if (Object.keys(cambios).length > 0) {
           const fecha = new Intl.DateTimeFormat('sv-SE', {
              timeZone: 'America/Bogota',
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit'
           }).format(new Date());

           await pool.query(
              'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
              [req.user.id, 'ACTUALIZAR', 'SOLICITUDES', fecha, `Actualización solicitud: ${id}`]
           );
        }
      }

      res.json({ updated: true });
    } catch (err) {
      console.error('PUT /solicitudes/:id error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // ---------- ESTADOS SOLICITUD ----------
  getEstadosSolicitud: async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT id_estado, nombre_estado FROM estados_solicitud ORDER BY id_estado ASC');
      res.json(rows || []);
    } catch (err) {
      console.error('GET /solicitudes/estados error', err);
      res.status(500).json({ message: 'Error obteniendo estados de solicitud' });
    }
  },

  updateSolicitudEstado: async (req, res) => {
    const id = Number(req.params.id);
    const id_estado = Number(req.body?.id_estado);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: 'ID inválido' });
    if (!Number.isFinite(id_estado) || id_estado <= 0) return res.status(400).json({ message: 'Estado inválido' });

    if (req.user && req.user.rol !== 'Administrador' && req.user.rol !== 'Superadmin') {
      return res.status(403).json({ message: 'No tienes permisos para cambiar el estado' });
    }

    try {
      const [rowsEstado] = await pool.query('SELECT nombre_estado FROM estados_solicitud WHERE id_estado = ? LIMIT 1', [id_estado]);
      if (!rowsEstado.length) return res.status(400).json({ message: 'Estado no encontrado' });

      await pool.query('UPDATE Solicitudes SET id_estado = ? WHERE solicitud_id = ?', [id_estado, id]);

      if (req.user && req.user.id) {
        const fecha = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/Bogota',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date());
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
          [req.user.id, 'ACTUALIZAR', 'SOLICITUDES', fecha, `Cambio de estado solicitud: ${id} -> ${rowsEstado[0].nombre_estado}`]
        );
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('PATCH /solicitudes/:id/estado error', err);
      res.status(500).json({ message: 'Error actualizando estado' });
    }
  },

  updateSolicitudAsignacion: async (req, res) => {
    const id = Number(req.params.id);
    const id_admin = req.body?.id_admin === null || req.body?.id_admin === ''
      ? null
      : Number(req.body?.id_admin);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: 'ID inválido' });
    if (id_admin !== null && (!Number.isFinite(id_admin) || id_admin <= 0)) {
      return res.status(400).json({ message: 'Administrador inválido' });
    }

    if (req.user && req.user.rol !== 'Administrador' && req.user.rol !== 'Superadmin') {
      return res.status(403).json({ message: 'No tienes permisos para asignar solicitudes' });
    }

    try {
      await pool.query('UPDATE Solicitudes SET id_admin = ? WHERE solicitud_id = ?', [id_admin, id]);

      if (req.user && req.user.id) {
        const fecha = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/Bogota',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date());
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
          [req.user.id, 'ACTUALIZAR', 'SOLICITUDES', fecha, `Asignación solicitud: ${id} -> ${id_admin ?? 'sin asignar'}`]
        );
      }

      if (id_admin) {
        const [rows] = await pool.query(
          'SELECT email FROM usuarios WHERE id_usuario = ? LIMIT 1',
          [id_admin]
        );
        const adminEmail = rows && rows[0] ? rows[0].email : null;
        if (adminEmail) {
          let tipo = 'N/A';
          let fechaSolicitud = null;
          let nombre = 'N/A';
          try {
            const [solRows] = await pool.query(
              'SELECT tipo_solicitud, fecha_solicitud, nombre_muestra FROM Solicitudes WHERE solicitud_id = ? LIMIT 1',
              [id]
            );
            if (solRows && solRows[0]) {
              tipo = solRows[0].tipo_solicitud || 'N/A';
              fechaSolicitud = solRows[0].fecha_solicitud || null;
              nombre = solRows[0].nombre_muestra || 'N/A';
            }
          } catch (err) {
            console.warn('Error loading solicitud data for assignment email:', err);
          }
          const previewCode = await getSolicitudPreviewCode(tipo, fechaSolicitud, id);
          const subject = `Nueva solicitud asignada: ${previewCode}`;
          const text = `Se te asignó la solicitud ${previewCode}.\n\nMuestra: ${nombre}`;
          const html = `<h3>Solicitud asignada</h3><p><strong>Código:</strong> ${previewCode}</p><p><strong>Muestra:</strong> ${nombre}</p>`;
          setImmediate(() => {
            sendMail(adminEmail, subject, text, html)
              .catch((err) => console.warn('Error notificando asignación de solicitud:', err));
          });
        }
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('PATCH /solicitudes/:id/asignacion error', err);
      res.status(500).json({ message: 'Error actualizando asignación' });
    }
  },

  // ---------- OFERTA ----------
  createOrUpdateOferta: async (req, res) => {
    const id_solicitud = req.params.id_solicitud || req.body.id_solicitud;
    if (!id_solicitud) return res.status(400).json({ message: 'Missing id_solicitud' });
    const b = req.body || {};
    
    try {
      // Obtener datos actuales
      const [rowsCurrent] = await pool.query('SELECT * FROM oferta WHERE id_solicitud = ?', [id_solicitud]);
      const datosActuales = rowsCurrent.length ? rowsCurrent[0] : null;

      const [update] = await pool.query(
        `UPDATE oferta SET genero_cotizacion = ?, valor_cotizacion = ?, fecha_envio_oferta = ?, realizo_seguimiento_oferta = ?, observacion_oferta = ?
         WHERE id_solicitud = ?`,
        [
          b.genero_cotizacion ? 1 : 0,
          b.valor_cotizacion || null,
          b.fecha_envio_oferta || null,
          b.realizo_seguimiento_oferta ? 1 : 0,
          b.observacion_oferta || null,
          id_solicitud
        ]
      );
      
      let isInsert = false;
      if (!update.affectedRows) {
        isInsert = true;
        await pool.query(
          `INSERT INTO oferta (id_solicitud, genero_cotizacion, valor_cotizacion, fecha_envio_oferta, realizo_seguimiento_oferta, observacion_oferta)
           VALUES (?,?,?,?,?,?)`,
          [
            id_solicitud,
            b.genero_cotizacion ? 1 : 0,
            b.valor_cotizacion || null,
            b.fecha_envio_oferta || null,
            b.realizo_seguimiento_oferta ? 1 : 0,
            b.observacion_oferta || null
          ]
        );
      }

      if (req.user && req.user.id) {
        const fecha = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/Bogota',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date());

        if (isInsert) {
           await pool.query(
             'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
             [req.user.id, 'CREAR', 'SOLICITUDES', fecha, `Creación oferta para solicitud: ${id_solicitud}`]
           );
        } else if (datosActuales) {
           const cambios = {};
           const normalize = (val) => {
              if (val instanceof Date) return val.toISOString().split('T')[0];
              if (val === null || val === undefined) return '';
              return String(val).trim();
           };
           
           const datosNuevos = {
             genero_cotizacion: b.genero_cotizacion ? 1 : 0,
             valor_cotizacion: b.valor_cotizacion,
             fecha_envio_oferta: b.fecha_envio_oferta,
             realizo_seguimiento_oferta: b.realizo_seguimiento_oferta ? 1 : 0,
             observacion_oferta: b.observacion_oferta
           };

           for (const key in datosNuevos) {
             const valAnt = normalize(datosActuales[key]);
             const valNuevo = normalize(datosNuevos[key]);
             if (valAnt !== valNuevo) {
               cambios[key] = { anterior: valAnt || '(vacío)', nuevo: valNuevo || '(vacío)' };
             }
           }

           if (Object.keys(cambios).length > 0) {
             await pool.query(
                'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
                [req.user.id, 'ACTUALIZAR', 'SOLICITUDES', fecha, `Actualización oferta para solicitud: ${id_solicitud}`]
             );
           }
        }
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('createOrUpdateOferta error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // ---------- REVISIÓN DE OFERTA ----------
  createOrUpdateRevision: async (req, res) => {
    const id_solicitud = req.params.id_solicitud || req.body.id_solicitud;
    if (!id_solicitud) return res.status(400).json({ message: 'Missing id_solicitud' });
    const b = req.body || {};
    
    try {
      const tipoMuestra = b.tipo_muestra_especificado
        ? String(b.tipo_muestra_especificado).trim().toUpperCase()
        : null;
      const conceptoFinal = normalizeConceptoFinal(b.concepto_final, b.servicio_es_viable);
      const revisionColsRaw = await getTableColumns('revision_oferta');
      const revisionCols = revisionColsRaw.size ? revisionColsRaw : ALLOWED_REVISION_FIELDS;
      const conceptField = revisionCols.has('concepto_final')
        ? 'concepto_final'
        : (revisionCols.has('servicio_es_viable') ? 'servicio_es_viable' : null);
      const conceptValue = conceptField === 'concepto_final'
        ? (conceptoFinal ?? null)
        : (conceptField ? (conceptoFinalToBit(conceptoFinal) ?? toBit(b.servicio_es_viable)) : null);

      const [rowsCurrent] = await pool.query('SELECT * FROM revision_oferta WHERE id_solicitud = ?', [id_solicitud]);
      const datosActuales = rowsCurrent.length ? rowsCurrent[0] : null;

      const updateFields = [];
      const updateValues = [];
      const pushUpdate = (col, val) => {
        if (revisionCols.has(col)) {
          updateFields.push(`${col} = ?`);
          updateValues.push(val);
        }
      };
      pushUpdate('fecha_limite_entrega', b.fecha_limite_entrega || null);
      pushUpdate('tipo_muestra_especificado', tipoMuestra);
      pushUpdate('ensayos_requeridos_claros', toBit(b.ensayos_requeridos_claros));
      pushUpdate('equipos_calibrados', toBit(b.equipos_calibrados));
      pushUpdate('personal_competente', toBit(b.personal_competente));
      pushUpdate('infraestructura_adecuada', toBit(b.infraestructura_adecuada));
      pushUpdate('insumos_vigentes', toBit(b.insumos_vigentes));
      pushUpdate('cumple_tiempos_entrega', toBit(b.cumple_tiempos_entrega));
      pushUpdate('normas_metodos_especificados', toBit(b.normas_metodos_especificados));
      pushUpdate('metodo_validado_verificado', toBit(b.metodo_validado_verificado));
      pushUpdate('metodo_adecuado', toBit(b.metodo_adecuado));
      pushUpdate('observaciones_tecnicas', b.observaciones_tecnicas || null);
      if (conceptField) {
        pushUpdate(conceptField, conceptValue ?? null);
      }

      const update = updateFields.length
        ? (await pool.query(
          `UPDATE revision_oferta SET ${updateFields.join(', ')} WHERE id_solicitud = ?`,
          [...updateValues, id_solicitud]
        ))[0]
        : { affectedRows: 0 };
      
      let isInsert = false;
      if (!update.affectedRows) {
        isInsert = true;
        const insertCols = [];
        const insertValues = [];
        const pushInsert = (col, val) => {
          if (revisionCols.has(col)) {
            insertCols.push(col);
            insertValues.push(val);
          }
        };
        pushInsert('id_solicitud', id_solicitud);
        pushInsert('fecha_limite_entrega', b.fecha_limite_entrega || null);
        pushInsert('tipo_muestra_especificado', tipoMuestra);
        pushInsert('ensayos_requeridos_claros', toBit(b.ensayos_requeridos_claros));
        pushInsert('equipos_calibrados', toBit(b.equipos_calibrados));
        pushInsert('personal_competente', toBit(b.personal_competente));
        pushInsert('infraestructura_adecuada', toBit(b.infraestructura_adecuada));
        pushInsert('insumos_vigentes', toBit(b.insumos_vigentes));
        pushInsert('cumple_tiempos_entrega', toBit(b.cumple_tiempos_entrega));
        pushInsert('normas_metodos_especificados', toBit(b.normas_metodos_especificados));
        pushInsert('metodo_validado_verificado', toBit(b.metodo_validado_verificado));
        pushInsert('metodo_adecuado', toBit(b.metodo_adecuado));
        pushInsert('observaciones_tecnicas', b.observaciones_tecnicas || null);
        if (conceptField) {
          pushInsert(conceptField, conceptValue ?? null);
        }

        if (insertCols.length) {
          const placeholders = insertCols.map(() => '?').join(', ');
          await pool.query(
            `INSERT INTO revision_oferta (${insertCols.join(', ')}) VALUES (${placeholders})`,
            insertValues
          );
        }
      }

      if (req.user && req.user.id) {
         const fecha = new Intl.DateTimeFormat('sv-SE', {
           timeZone: 'America/Bogota',
           year: 'numeric', month: '2-digit', day: '2-digit',
           hour: '2-digit', minute: '2-digit', second: '2-digit'
         }).format(new Date());

         if (isInsert) {
           await pool.query(
             'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
             [req.user.id, 'CREAR', 'SOLICITUDES', fecha, `Creación revisión oferta para solicitud: ${id_solicitud}`]
           );
         } else if (datosActuales) {
           const cambios = {};
           const normalize = (val) => {
              if (val instanceof Date) return val.toISOString().split('T')[0];
              if (val === null || val === undefined) return '';
              return String(val).trim();
           };
           
           const datosNuevos = {
             fecha_limite_entrega: b.fecha_limite_entrega,
             tipo_muestra_especificado: tipoMuestra,
             ensayos_requeridos_claros: toBit(b.ensayos_requeridos_claros),
             equipos_calibrados: toBit(b.equipos_calibrados),
             personal_competente: toBit(b.personal_competente),
             infraestructura_adecuada: toBit(b.infraestructura_adecuada),
             insumos_vigentes: toBit(b.insumos_vigentes),
             cumple_tiempos_entrega: toBit(b.cumple_tiempos_entrega),
             normas_metodos_especificados: toBit(b.normas_metodos_especificados),
             metodo_validado_verificado: toBit(b.metodo_validado_verificado),
             metodo_adecuado: toBit(b.metodo_adecuado),
             observaciones_tecnicas: b.observaciones_tecnicas || null,
             concepto_final: conceptoFinal
           };

           for (const key in datosNuevos) {
             const valAnt = normalize(datosActuales[key]);
             const valNuevo = normalize(datosNuevos[key]);
             if (valAnt !== valNuevo) {
               cambios[key] = { anterior: valAnt || '(vacío)', nuevo: valNuevo || '(vacío)' };
             }
           }

           if (Object.keys(cambios).length > 0) {
             await pool.query(
                'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
                [req.user.id, 'ACTUALIZAR', 'SOLICITUDES', fecha, `Actualización revisión oferta para solicitud: ${id_solicitud}`]
             );
           }
         }
      }

      // Al completar la revisión, marcar solicitud como EVALUADA
      try {
        const evaluadaId = await getEstadoIdByName('EVALUADA');
        if (evaluadaId) {
          await pool.query('UPDATE Solicitudes SET id_estado = ? WHERE solicitud_id = ?', [evaluadaId, id_solicitud]);
        }
      } catch (estadoErr) {
        console.warn('Error actualizando estado a EVALUADA:', estadoErr);
      }

      // Enviar correo al suscriptor de revisión si está suscrito
      try {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const toEmail = process.env.SOLICITUDES_NOTIFICATION_EMAIL || 'serviciostecnologicoscbi@sena.edu.co';
        if (toEmail && re.test(toEmail)) {
          const [rows] = await pool.query(
            `SELECT 
               s.solicitud_id, s.tipo_solicitud, s.nombre_muestra, s.fecha_solicitud, s.lote_producto,
               u.nombre_solicitante, u.correo_electronico
             FROM Solicitudes s
             LEFT JOIN clientes u ON s.id_cliente = u.id_cliente
             WHERE s.solicitud_id = ?
             LIMIT 1`,
            [id_solicitud]
          );
          const s = rows && rows[0] ? rows[0] : {};
          
          const tipo = s.tipo_solicitud || 'N/A';
          const idReal = s.solicitud_id || id_solicitud;
          const previewCode = await getSolicitudPreviewCode(tipo, s.fecha_solicitud, idReal);

          const conceptoLabel = conceptoFinal === 'SOLICITUD_VIABLE_CON_OBSERVACIONES'
            ? 'viable con observaciones'
            : (conceptoFinal === 'SOLICITUD_VIABLE' ? 'viable' : (conceptoFinal === 'SOLICITUD_NO_VIABLE' ? 'no viable' : 'pendiente'));
          const subject = `Revisión de Oferta: ${previewCode} - ${s.nombre_muestra || 'N/A'} - Servicio ${conceptoLabel}`;
          const text =
            `Se ha guardado la revisión de la oferta.\n\n` +
            `Código: ${previewCode}\n` +
            `Solicitud: ${s.solicitud_id || id_solicitud}\n` +
            `Solicitante: ${s.nombre_solicitante || 'N/A'}\n` +
            `Muestra: ${s.nombre_muestra || 'N/A'}\n` +
            `Tipo: ${s.tipo_solicitud || 'N/A'}\n\n` +
            `Fecha límite de entrega: ${b.fecha_limite_entrega || 'N/A'}\n` +
            `Concepto final: ${conceptoLabel}`;
          const html =
            `<h3>Revisión de la oferta</h3>` +
            `<p><strong>Código:</strong> ${previewCode}</p>` +
            `<p><strong>Solicitud:</strong> ${s.solicitud_id || id_solicitud}</p>` +
            `<p><strong>Solicitante:</strong> ${s.nombre_solicitante || 'N/A'}</p>` +
            `<p><strong>Muestra:</strong> ${s.nombre_muestra || 'N/A'}</p>` +
            `<p><strong>Tipo:</strong> ${s.tipo_solicitud || 'N/A'}</p>` +
            `<hr/>` +
            `<p><strong>Fecha límite de entrega:</strong> ${b.fecha_limite_entrega || 'N/A'}</p>` +
            `<p><strong>Concepto final:</strong> ${conceptoLabel}</p>`;
          await sendMail(toEmail, subject, text, html);
        }
      } catch (mailErr) {
        console.warn('Aviso: error al enviar correo de revisión', mailErr);
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('createOrUpdateRevision error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  suscribirseSolicitudes: async (req, res) => {
    try {
      const email = String((req.body || {}).email || '').trim().toLowerCase();
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !re.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
      }
      await pool.query(`
        CREATE TABLE IF NOT EXISTS suscripciones_solicitudes (
          email VARCHAR(255) PRIMARY KEY,
          activo TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      const [existing] = await pool.query(
        'SELECT activo FROM suscripciones_solicitudes WHERE email = ? LIMIT 1',
        [email]
      );
      if (existing && existing.length && existing[0] && existing[0].activo) {
        return res.status(409).json({ error: 'Este correo ya está suscrito a solicitudes' });
      }
      await pool.query(
        `INSERT INTO suscripciones_solicitudes (email, activo) VALUES (?, 1)
         ON DUPLICATE KEY UPDATE activo = VALUES(activo), created_at = CURRENT_TIMESTAMP`,
        [email]
      );
      const text = `Te has suscrito a notificaciones de nuevas solicitudes.\n\nRecibirás correos cuando se registre una nueva solicitud.`;
      const html = `<p>Te has suscrito a notificaciones de <strong>nuevas solicitudes</strong>.</p><p>Recibirás correos cuando se registre una nueva solicitud.</p>`;
      await sendMail(email, 'Suscripción a solicitudes confirmada', text, html);
      return res.json({ ok: true });
    } catch (err) {
      console.error('Error suscribirseSolicitudes:', err);
      return res.status(500).json({ error: 'No se pudo registrar la suscripción' });
    }
  },
  
  obtenerEstadoSuscripcionSolicitudes: async (req, res) => {
    try {
      const email = String((req.params || {}).email || '').trim().toLowerCase();
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !re.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
      }
      await pool.query(`
        CREATE TABLE IF NOT EXISTS suscripciones_solicitudes (
          email VARCHAR(255) PRIMARY KEY,
          activo TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      const [rows] = await pool.query('SELECT activo FROM suscripciones_solicitudes WHERE email = ?', [email]);
      if (!rows.length) return res.json({ suscrito: false });
      return res.json({ suscrito: !!rows[0].activo });
    } catch (err) {
      console.error('Error obtenerEstadoSuscripcionSolicitudes:', err);
      return res.status(500).json({ error: 'Error consultando suscripción' });
    }
  },
  
  cancelarSuscripcionSolicitudes: async (req, res) => {
    try {
      const email = String((req.params || {}).email || '').trim().toLowerCase();
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !re.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
      }
      await pool.query(`
        CREATE TABLE IF NOT EXISTS suscripciones_solicitudes (
          email VARCHAR(255) PRIMARY KEY,
          activo TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      const [result] = await pool.query('UPDATE suscripciones_solicitudes SET activo = 0 WHERE email = ?', [email]);
      return res.json({ ok: true, updated: result.affectedRows });
    } catch (err) {
      console.error('Error cancelarSuscripcionSolicitudes:', err);
      return res.status(500).json({ error: 'Error cancelando suscripción de solicitudes' });
    }
  },

  suscribirseRevisionOferta: async (req, res) => {
    try {
      const email = String((req.body || {}).email || '').trim().toLowerCase();
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !re.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
      }
      await pool.query(`
        CREATE TABLE IF NOT EXISTS suscripciones_revision_oferta (
          email VARCHAR(255) PRIMARY KEY,
          activo TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      const [existing] = await pool.query(
        'SELECT activo FROM suscripciones_revision_oferta WHERE email = ? LIMIT 1',
        [email]
      );
      if (existing && existing.length && existing[0] && existing[0].activo) {
        return res.status(409).json({ error: 'Este correo ya está suscrito a revisión de oferta' });
      }
      await pool.query(
        `INSERT INTO suscripciones_revision_oferta (email, activo) VALUES (?, 1)
         ON DUPLICATE KEY UPDATE activo = VALUES(activo), created_at = CURRENT_TIMESTAMP`,
        [email]
      );
      const text = `Te has suscrito a notificaciones de revisión de oferta.\n\nRecibirás correos cuando se registre una revisión.`;
      const html = `<p>Te has suscrito a notificaciones de <strong>revisión de oferta</strong>.</p><p>Recibirás correos cuando se registre una revisión.</p>`;
      await sendMail(email, 'Suscripción a revisión de oferta confirmada', text, html);
      return res.json({ ok: true });
    } catch (err) {
      console.error('Error suscribirseRevisionOferta:', err);
      return res.status(500).json({ error: 'No se pudo registrar la suscripción' });
    }
  },
  
  obtenerEstadoSuscripcionRevisionOferta: async (req, res) => {
    try {
      const email = String((req.params || {}).email || '').trim().toLowerCase();
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !re.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
      }
      await pool.query(`
        CREATE TABLE IF NOT EXISTS suscripciones_revision_oferta (
          email VARCHAR(255) PRIMARY KEY,
          activo TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      const [rows] = await pool.query('SELECT activo FROM suscripciones_revision_oferta WHERE email = ?', [email]);
      if (!rows.length) return res.json({ suscrito: false });
      return res.json({ suscrito: !!rows[0].activo });
    } catch (err) {
      console.error('Error obtenerEstadoSuscripcionRevisionOferta:', err);
      return res.status(500).json({ error: 'Error consultando suscripción' });
    }
  },
  
  cancelarSuscripcionRevisionOferta: async (req, res) => {
    try {
      const email = String((req.params || {}).email || '').trim().toLowerCase();
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !re.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
      }
      await pool.query(`
        CREATE TABLE IF NOT EXISTS suscripciones_revision_oferta (
          email VARCHAR(255) PRIMARY KEY,
          activo TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      const [result] = await pool.query('UPDATE suscripciones_revision_oferta SET activo = 0 WHERE email = ?', [email]);
      return res.json({ ok: true, updated: result.affectedRows });
    } catch (err) {
      console.error('Error cancelarSuscripcionRevisionOferta:', err);
      return res.status(500).json({ error: 'Error cancelando suscripción de revisión' });
    }
  },

  // ---------- SEGUIMIENTO ENCUESTA ----------
  createOrUpdateSeguimientoEncuesta: async (req, res) => {
    const id_solicitud = req.params.id_solicitud || req.body.id_solicitud;
    if (!id_solicitud) return res.status(400).json({ message: 'Missing id_solicitud' });
    const b = req.body || {};
    
    try {
      const toTinyIntOrNull = (value) => {
        if (value === null || value === undefined || value === '') return null;
        if (value === true || value === 1 || value === '1') return 1;
        if (typeof value === 'string' && value.trim().toLowerCase() === 'true') return 1;
        return 0;
      };

      const recomendariaServicio = toTinyIntOrNull(b.recomendaria_servicio);
      const clienteRespondio = toTinyIntOrNull(b.cliente_respondio);
      const solicitoNuevaEncuesta = toTinyIntOrNull(b.solicito_nueva_encuesta);

      // Obtener datos actuales
      const [rowsCurrent] = await pool.query('SELECT * FROM seguimiento_encuesta WHERE id_solicitud = ?', [id_solicitud]);
      const datosActuales = rowsCurrent.length ? rowsCurrent[0] : null;

      const [update] = await pool.query(
        `UPDATE seguimiento_encuesta SET fecha_encuesta = ?, fecha_realizacion_encuesta = ?, comentarios = ?, recomendaria_servicio = ?, cliente_respondio = ?, solicito_nueva_encuesta = ?
         WHERE id_solicitud = ?`,
        [
          b.fecha_encuesta || null,
          b.fecha_realizacion_encuesta || null,
          b.comentarios || null,
          recomendariaServicio,
          clienteRespondio,
          solicitoNuevaEncuesta,
          id_solicitud
        ]
      );
      
      let isInsert = false;
      if (!update.affectedRows) {
        isInsert = true;
        await pool.query(
          `INSERT INTO seguimiento_encuesta (id_solicitud, fecha_encuesta, fecha_realizacion_encuesta, comentarios, recomendaria_servicio, cliente_respondio, solicito_nueva_encuesta)
           VALUES (?,?,?,?,?,?,?)`,
          [
            id_solicitud,
            b.fecha_encuesta || null,
            b.fecha_realizacion_encuesta || null,
            b.comentarios || null,
            recomendariaServicio,
            clienteRespondio,
            solicitoNuevaEncuesta
          ]
        );
      }
      
      if (req.user && req.user.id) {
         const fecha = new Intl.DateTimeFormat('sv-SE', {
           timeZone: 'America/Bogota',
           year: 'numeric', month: '2-digit', day: '2-digit',
           hour: '2-digit', minute: '2-digit', second: '2-digit'
         }).format(new Date());

         if (isInsert) {
           await pool.query(
             'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
             [req.user.id, 'CREAR', 'SOLICITUDES', fecha, `Creación seguimiento encuesta para solicitud: ${id_solicitud}`]
           );
         } else if (datosActuales) {
           const cambios = {};
           const normalize = (val) => {
              if (val instanceof Date) return val.toISOString().split('T')[0];
              if (val === null || val === undefined) return '';
              return String(val).trim();
           };
           
           const datosNuevos = {
             fecha_encuesta: b.fecha_encuesta,
             fecha_realizacion_encuesta: b.fecha_realizacion_encuesta,
             comentarios: b.comentarios,
             recomendaria_servicio: recomendariaServicio,
             cliente_respondio: clienteRespondio,
             solicito_nueva_encuesta: solicitoNuevaEncuesta
           };

           for (const key in datosNuevos) {
             const valAnt = normalize(datosActuales[key]);
             const valNuevo = normalize(datosNuevos[key]);
             if (valAnt !== valNuevo) {
               cambios[key] = { anterior: valAnt || '(vacío)', nuevo: valNuevo || '(vacío)' };
             }
           }

           if (Object.keys(cambios).length > 0) {
             await pool.query(
                'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
                [req.user.id, 'ACTUALIZAR', 'SOLICITUDES', fecha, `Actualización seguimiento encuesta para solicitud: ${id_solicitud}`]
             );
           }
         }
      }
      
      res.json({ ok: true });
    } catch (err) {
      console.error('createOrUpdateSeguimientoEncuesta error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  deleteSolicitud: async (req, res) => {
    const id = req.params.id;

    try {
      if (req.user && req.user.rol === 'Administrador') {
        return res.status(403).json({ message: 'No tienes permisos para eliminar solicitudes.' });
      }

      const [result] = await pool.query('DELETE FROM Solicitudes WHERE solicitud_id = ?', [id]);
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Solicitud no encontrada' });
      }

      if (req.user && req.user.id) {
         const fecha = new Intl.DateTimeFormat('sv-SE', {
           timeZone: 'America/Bogota',
           year: 'numeric', month: '2-digit', day: '2-digit',
           hour: '2-digit', minute: '2-digit', second: '2-digit'
         }).format(new Date());

        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
          [req.user.id, 'ELIMINAR', 'SOLICITUDES', fecha, `Eliminación de solicitud: ${id}`]
        );
      }

      res.json({ deleted: true });
    } catch (err) {
      console.error('DELETE /solicitudes/:id error', err);
      res.status(500).json({ message: 'Error eliminando solicitud' });
    }
  },

  createEncuesta: async (req, res) => {
    const body = req.body || {};

    if (!body.id_solicitud) {
      return res.status(400).json({ message: 'Missing id_solicitud' });
    }

    try {
      const toTinyIntOrNull = (value) => {
        if (value === null || value === undefined || value === '') return null;
        if (value === true || value === 1 || value === '1') return 1;
        if (typeof value === 'string' && value.trim().toLowerCase() === 'true') return 1;
        return 0;
      };

      const recomendariaServicio = toTinyIntOrNull(body.recomendaria_servicio);
      const clienteRespondioEncuesta = toTinyIntOrNull(body.cliente_respondio_encuesta);
      const solicitoNuevaEncuesta = toTinyIntOrNull(body.solicito_nueva_encuesta);

      const connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
        // Fetch current data for diffs
        const [rowsCurrent] = await connection.query(
            'SELECT cliente_respondio_encuesta, solicito_nueva_encuesta FROM Solicitudes WHERE id_solicitud = ?',
            [body.id_solicitud]
        );
        const datosActuales = rowsCurrent.length ? rowsCurrent[0] : null;

        if (body.fecha_encuesta || body.puntuacion_satisfaccion || body.comentarios || body.recomendaria_servicio !== undefined) {
          await connection.query(
            `INSERT INTO ResultadosEncuestas (id_solicitud, fecha_encuesta, puntuacion_satisfaccion, comentarios, recomendaria_servicio)
             VALUES (?, ?, ?, ?, ?)`,
            [
              body.id_solicitud,
              body.fecha_encuesta || null,
              body.puntuacion_satisfaccion || null,
              body.comentarios || null,
              recomendariaServicio
            ]
          );
        }

        const updateFields = [];
        const updateValues = [];

        if (body.cliente_respondio_encuesta !== undefined) {
          updateFields.push('cliente_respondio_encuesta = ?');
          updateValues.push(clienteRespondioEncuesta);
        }

        if (body.solicito_nueva_encuesta !== undefined) {
          updateFields.push('solicito_nueva_encuesta = ?');
          updateValues.push(solicitoNuevaEncuesta);
        }

        if (updateFields.length > 0) {
          updateValues.push(body.id_solicitud);
          await connection.query(
            `UPDATE Solicitudes SET ${updateFields.join(', ')} WHERE id_solicitud = ?`,
            updateValues
          );
        }

        if (req.user && req.user.id) {
           const fecha = new Intl.DateTimeFormat('sv-SE', {
             timeZone: 'America/Bogota',
             year: 'numeric', month: '2-digit', day: '2-digit',
             hour: '2-digit', minute: '2-digit', second: '2-digit'
           }).format(new Date());

          await connection.query(
            'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'CREAR_ENCUESTA', 'SOLICITUDES', fecha, `Creación resultados encuesta para solicitud: ${body.id_solicitud}`]
          );

          if (datosActuales && updateFields.length > 0) {
             const cambios = {};
             const normalize = (val) => {
                if (val instanceof Date) return val.toISOString().split('T')[0];
                if (val === null || val === undefined) return '';
                return String(val).trim();
             };

             const datosNuevos = {};
             if (body.cliente_respondio_encuesta !== undefined) datosNuevos.cliente_respondio_encuesta = clienteRespondioEncuesta;
             if (body.solicito_nueva_encuesta !== undefined) datosNuevos.solicito_nueva_encuesta = solicitoNuevaEncuesta;

             for (const key in datosNuevos) {
               const valAnt = normalize(datosActuales[key]);
               const valNuevo = normalize(datosNuevos[key]);
               if (valAnt !== valNuevo) {
                 cambios[key] = { anterior: valAnt || '(vacío)', nuevo: valNuevo || '(vacío)' };
               }
             }

             if (Object.keys(cambios).length > 0) {
                await connection.query(
                   'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
                   [req.user.id, 'ACTUALIZAR', 'SOLICITUDES', fecha, `Actualización estado encuesta solicitud: ${body.id_solicitud}`]
                );
             }
          }
        }

        await connection.commit();
        connection.release();

        res.json({ message: 'Encuesta creada exitosamente' });
      } catch (err) {
        await connection.rollback();
        connection.release();
        throw err;
      }
    } catch (err) {
      console.error('POST /encuestas error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  generarDocumentoCliente: async (req, res) => {
    try {
      const file = req.file;
      if (!file || !file.buffer) {
        return res.status(400).json({ message: 'Plantilla requerida' });
      }

      const id_cliente = String((req.body || {}).id_cliente || '').trim();
      const numero_identificacion = String((req.body || {}).numero_identificacion || '').trim();
      const numero = String((req.body || {}).numero || '').trim();
      if (!id_cliente && !numero_identificacion && !numero) {
        return res.status(400).json({ message: 'Debe enviar id_cliente o numero_identificacion o numero' });
      }

      const cliente = await fetchClienteDTO({ id_cliente, numero_identificacion, numero });
      if (!cliente) {
        return res.status(404).json({ message: 'Cliente no encontrado' });
      }

      const clienteDoc = {
        ...cliente,
        ciudad_codigo: cliente.ciudad_codigo || cliente.id_ciudad,
        departamento_codigo: cliente.departamento_codigo || cliente.id_departamento,
        id_ciudad: cliente.ciudad || cliente.id_ciudad,
        id_departamento: cliente.departamento || cliente.id_departamento
      };

      const original = String(file.originalname || '').toLowerCase();
      const isXlsx = original.endsWith('.xlsx') || /spreadsheetml/.test(String(file.mimetype || '').toLowerCase());
      const isDocx = original.endsWith('.docx') || /wordprocessingml/.test(String(file.mimetype || '').toLowerCase());
      if (!isXlsx && !isDocx) {
        return res.status(400).json({ message: 'Formato de plantilla no soportado. Use .xlsx o .docx' });
      }

      const outBuffer = isXlsx
        ? await generateClienteXlsxFromTemplate(file.buffer, clienteDoc)
        : await generateClienteDocxFromTemplate(file.buffer, clienteDoc);

      const ext = isXlsx ? 'xlsx' : 'docx';
      const filename = `cliente_${safeFileComponent(cliente.numero_identificacion || cliente.numero || cliente.id_cliente)}.${ext}`;

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
  },

  generarDocumentoSolicitud: async (req, res) => {
    try {
      const file = req.file;
      if (!file || !file.buffer) {
        return res.status(400).json({ message: 'Plantilla requerida' });
      }

      const solicitud_id = String((req.body || {}).solicitud_id || '').trim();
      if (!solicitud_id) {
        return res.status(400).json({ message: 'Debe enviar solicitud_id' });
      }

      const dto = await fetchSolicitudDocumentoDTO({ solicitud_id });
      if (!dto || !dto.solicitud) {
        return res.status(404).json({ message: 'Solicitud no encontrada' });
      }

      const original = String(file.originalname || '').toLowerCase();
      const isXlsx = original.endsWith('.xlsx') || /spreadsheetml/.test(String(file.mimetype || '').toLowerCase());
      const isDocx = original.endsWith('.docx') || /wordprocessingml/.test(String(file.mimetype || '').toLowerCase());
      if (!isXlsx && !isDocx) {
        return res.status(400).json({ message: 'Formato de plantilla no soportado. Use .xlsx o .docx' });
      }

      const outBuffer = isXlsx
        ? await generateSolicitudXlsxFromTemplate(file.buffer, dto)
        : await generateSolicitudDocxFromTemplate(file.buffer, dto);

      const ext = isXlsx ? 'xlsx' : 'docx';
      const filename = `solicitud_${safeFileComponent(dto.solicitud.solicitud_id)}.${ext}`;

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
  },
  generarDocumentoClienteConLlavesSolicitud: async (req, res) => {
    try {
      const file = req.file;
      if (!file || !file.buffer) {
        return res.status(400).json({ message: 'Plantilla requerida' });
      }

      const id_cliente = String((req.body || {}).id_cliente || '').trim();
      if (!id_cliente) {
        return res.status(400).json({ message: 'Debe enviar id_cliente' });
      }

      const cliente = await fetchClienteDTO({ id_cliente });
      if (!cliente) {
        return res.status(404).json({ message: 'Cliente no encontrado' });
      }

      const clienteDoc = {
        ...cliente,
        ciudad_codigo: cliente.ciudad_codigo || cliente.id_ciudad,
        departamento_codigo: cliente.departamento_codigo || cliente.id_departamento,
        id_ciudad: cliente.ciudad || cliente.id_ciudad,
        id_departamento: cliente.departamento || cliente.id_departamento
      };

      const dto = {
        solicitud: Object.create(null),
        cliente: clienteDoc,
        oferta: Object.create(null),
        revision: Object.create(null),
        seguimiento_encuesta: Object.create(null)
      };

      const original = String(file.originalname || '').toLowerCase();
      const isXlsx = original.endsWith('.xlsx') || /spreadsheetml/.test(String(file.mimetype || '').toLowerCase());
      const isDocx = original.endsWith('.docx') || /wordprocessingml/.test(String(file.mimetype || '').toLowerCase());
      if (!isXlsx && !isDocx) {
        return res.status(400).json({ message: 'Formato de plantilla no soportado. Use .xlsx o .docx' });
      }

      const outBuffer = isXlsx
        ? await generateSolicitudXlsxFromTemplate(file.buffer, dto)
        : await generateSolicitudDocxFromTemplate(file.buffer, dto);

      const ext = isXlsx ? 'xlsx' : 'docx';
      const filename = `cliente_${safeFileComponent(cliente.numero_identificacion || cliente.numero || cliente.id_cliente)}.${ext}`;

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
  },
  listarPlantillasDocumentoSolicitud: async (req, res) => {
    try {
      await ensurePlantillasDocumentoSolicitudesTable();
      const [rows] = await pool.query(
        `SELECT id, nombre, nombre_archivo, mime, size_bytes, usuario_id, fecha_subida
         FROM plantillas_documento_solicitudes
         ORDER BY fecha_subida DESC, id DESC`
      );
      return res.json(rows);
    } catch (err) {
      console.error('Error GET /solicitudes/documentos/plantillas:', err);
      return res.status(500).json({ message: 'Error listando plantillas' });
    }
  },

  subirPlantillaDocumentoSolicitud: async (req, res) => {
    try {
      await ensurePlantillasDocumentoSolicitudesTable();
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
        `INSERT INTO plantillas_documento_solicitudes (nombre, nombre_archivo, mime, size_bytes, archivo, usuario_id)
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
          [req.user.id, 'SUBIR_PLANTILLA', 'SOLICITUDES', fecha, `Subir plantilla de solicitudes: ${nombre}`]
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
      console.error('Error POST /solicitudes/documentos/plantillas:', err);
      return res.status(500).json({ message: 'Error subiendo plantilla' });
    }
  },

  eliminarPlantillaDocumentoSolicitud: async (req, res) => {
    try {
      await ensurePlantillasDocumentoSolicitudesTable();
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: 'ID inválido' });

      const [result] = await pool.query('DELETE FROM plantillas_documento_solicitudes WHERE id = ?', [id]);
      if (!result.affectedRows) return res.status(404).json({ message: 'Plantilla no encontrada' });
      if (req.user && req.user.id) {
        const fecha = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/Bogota',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date());
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
          [req.user.id, 'ELIMINAR_PLANTILLA', 'SOLICITUDES', fecha, `Eliminar plantilla de solicitudes: ${id}`]
        );
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error('Error DELETE /solicitudes/documentos/plantillas/:id:', err);
      return res.status(500).json({ message: 'Error eliminando plantilla' });
    }
  },

  generarDocumentoDesdePlantilla: async (req, res) => {
    try {
      await ensurePlantillasDocumentoSolicitudesTable();
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: 'ID inválido' });

      const body = req.body || {};
      const solicitud_id = body.solicitud_id;
      const id_cliente = body.id_cliente;
      const entidadRaw = String(body.entidad || '').trim().toLowerCase();
      const hasSolicitud = Number.isFinite(Number(solicitud_id)) && Number(solicitud_id) > 0;
      const hasCliente = Number.isFinite(Number(id_cliente)) && Number(id_cliente) > 0;

      const [rows] = await pool.query(
        'SELECT nombre_archivo, mime, archivo FROM plantillas_documento_solicitudes WHERE id = ? LIMIT 1',
        [id]
      );
      if (!rows || !rows.length) return res.status(404).json({ message: 'Plantilla no encontrada' });

      const tpl = rows[0];
      const original = String(tpl.nombre_archivo || '').toLowerCase();
      const isXlsx = original.endsWith('.xlsx') || /spreadsheetml/.test(String(tpl.mime || '').toLowerCase());
      const isDocx = original.endsWith('.docx') || /wordprocessingml/.test(String(tpl.mime || '').toLowerCase());
      if (!isXlsx && !isDocx) {
        return res.status(400).json({ message: 'Formato de plantilla no soportado. Use .xlsx o .docx' });
      }

      // Regla A: el template manda. Si hay loop, generamos "todos" de esa entidad.
      const loopEntity = detectSolicitudesLoopEntity(Buffer.from(tpl.archivo));
      const todos = loopEntity === 'cliente' || loopEntity === 'solicitud' || loopEntity === 'ambos';
      if (!todos && !hasSolicitud && !hasCliente) {
        return res.status(400).json({ message: 'Debe enviar solicitud_id o id_cliente' });
      }

      let dto = {
        solicitud: Object.create(null),
        cliente: Object.create(null),
        oferta: Object.create(null),
        revision: Object.create(null),
        seguimiento_encuesta: Object.create(null)
      };

      let entidad = entidadRaw;
      if (todos) {
        if (loopEntity === 'ambos') {
          dto.clientes = await fetchClientesLoopDTO();
          dto.solicitudes = await fetchSolicitudesLoopDTO();
        } else {
          if (loopEntity === 'cliente' || loopEntity === 'solicitud') {
            entidad = loopEntity;
          }
          if (entidad !== 'cliente' && entidad !== 'solicitud') entidad = 'solicitud';
          if (entidad === 'cliente') {
            dto.clientes = await fetchClientesLoopDTO();
          } else {
            dto.solicitudes = await fetchSolicitudesLoopDTO();
          }
        }
      } else if (hasSolicitud) {
        const fullDto = await fetchSolicitudDocumentoDTO({ solicitud_id: Number(solicitud_id) });
        if (!fullDto || !fullDto.solicitud) return res.status(404).json({ message: 'Solicitud no encontrada' });
        dto = fullDto;
      }

      if (!todos && hasCliente) {
        const cliente = await fetchClienteDTO({ id_cliente: Number(id_cliente) });
        if (!cliente) return res.status(404).json({ message: 'Cliente no encontrado' });
        dto.cliente = {
          ...cliente,
          ciudad_codigo: cliente.ciudad_codigo || cliente.id_ciudad,
          departamento_codigo: cliente.departamento_codigo || cliente.id_departamento,
          id_ciudad: cliente.ciudad || cliente.id_ciudad,
          id_departamento: cliente.departamento || cliente.id_departamento
        };
      }

      const outBuffer = isXlsx
        ? await generateSolicitudXlsxFromTemplate(Buffer.from(tpl.archivo), dto)
        : await generateSolicitudDocxFromTemplate(Buffer.from(tpl.archivo), dto);

      const ext = isXlsx ? 'xlsx' : 'docx';
      const base = todos
        ? (loopEntity === 'ambos' ? 'clientes_y_solicitudes' : (entidad === 'solicitud' ? 'solicitudes' : 'clientes'))
        : (hasSolicitud && dto?.solicitud?.solicitud_id
            ? `solicitud_${safeFileComponent(dto.solicitud.solicitud_id)}`
            : `cliente_${safeFileComponent(dto?.cliente?.numero_identificacion || dto?.cliente?.numero || dto?.cliente?.id_cliente || id_cliente)}`);
      const filename = `${base}.${ext}`;

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
      console.error('Error POST /solicitudes/documentos/plantillas/:id/generar:', err);
      return res.status(500).json({ message: 'Error generando documento desde plantilla' });
    }
  },

  // Suscripciones para nuevas solicitudes
  suscribirseSolicitudes: async (req, res) => {
    try {
      const email = String((req.body || {}).email || '').trim().toLowerCase();
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !re.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
      }
      await ensureSuscripcionesSolicitudesTable();
      const [existing] = await pool.query(
        'SELECT activo FROM suscripciones_solicitudes WHERE email = ? LIMIT 1',
        [email]
      );
      if (existing && existing.length && existing[0] && existing[0].activo) {
        return res.status(409).json({ error: 'Este correo ya está suscrito a solicitudes' });
      }
      await pool.query(
        `INSERT INTO suscripciones_solicitudes (email, activo) VALUES (?, 1)
         ON DUPLICATE KEY UPDATE activo = VALUES(activo), created_at = CURRENT_TIMESTAMP`,
        [email]
      );
      const text = 'Te has suscrito a notificaciones de nuevas solicitudes.';
      const html = '<p>Te has suscrito a notificaciones de <strong>nuevas solicitudes</strong>.</p>';
      const r = await sendMail(email, 'Suscripción a nuevas solicitudes confirmada', text, html);
      return res.json({ ok: true, ...r });
    } catch (err) {
      console.error('Error suscribirseSolicitudes:', err);
      return res.status(500).json({ error: 'No se pudo registrar la suscripción' });
    }
  },

  obtenerEstadoSuscripcionSolicitudes: async (req, res) => {
    try {
      const email = String((req.params || {}).email || '').trim().toLowerCase();
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !re.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
      }
      await ensureSuscripcionesSolicitudesTable();
      const [rows] = await pool.query('SELECT activo FROM suscripciones_solicitudes WHERE email = ?', [email]);
      if (!rows.length) return res.json({ suscrito: false });
      return res.json({ suscrito: !!rows[0].activo });
    } catch (err) {
      console.error('Error obtenerEstadoSuscripcionSolicitudes:', err);
      return res.status(500).json({ error: 'Error consultando suscripción' });
    }
  },

  cancelarSuscripcionSolicitudes: async (req, res) => {
    try {
      const email = String((req.params || {}).email || '').trim().toLowerCase();
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !re.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
      }
      await ensureSuscripcionesSolicitudesTable();
      const [result] = await pool.query('UPDATE suscripciones_solicitudes SET activo = 0 WHERE email = ?', [email]);
      return res.json({ ok: true, updated: result.affectedRows });
    } catch (err) {
      console.error('Error cancelarSuscripcionSolicitudes:', err);
      return res.status(500).json({ error: 'Error cancelando suscripción' });
    }
  },

  // Suscripciones para revisión de oferta
  suscribirseRevisionOferta: async (req, res) => {
    try {
      const email = String((req.body || {}).email || '').trim().toLowerCase();
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !re.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
      }
      await ensureSuscripcionesRevisionTable();
      const [existing] = await pool.query(
        'SELECT activo FROM suscripciones_revision_oferta WHERE email = ? LIMIT 1',
        [email]
      );
      if (existing && existing.length && existing[0] && existing[0].activo) {
        return res.status(409).json({ error: 'Este correo ya está suscrito a revisión de oferta' });
      }
      await pool.query(
        `INSERT INTO suscripciones_revision_oferta (email, activo) VALUES (?, 1)
         ON DUPLICATE KEY UPDATE activo = VALUES(activo), created_at = CURRENT_TIMESTAMP`,
        [email]
      );
      const text = 'Te has suscrito a notificaciones de revisión de oferta.';
      const html = '<p>Te has suscrito a notificaciones de <strong>revisión de oferta</strong>.</p>';
      const r = await sendMail(email, 'Suscripción a revisión de oferta confirmada', text, html);
      return res.json({ ok: true, ...r });
    } catch (err) {
      console.error('Error suscribirseRevisionOferta:', err);
      return res.status(500).json({ error: 'No se pudo registrar la suscripción' });
    }
  },

  obtenerEstadoSuscripcionRevisionOferta: async (req, res) => {
    try {
      const email = String((req.params || {}).email || '').trim().toLowerCase();
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !re.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
      }
      await ensureSuscripcionesRevisionTable();
      const [rows] = await pool.query('SELECT activo FROM suscripciones_revision_oferta WHERE email = ?', [email]);
      if (!rows.length) return res.json({ suscrito: false });
      return res.json({ suscrito: !!rows[0].activo });
    } catch (err) {
      console.error('Error obtenerEstadoSuscripcionRevisionOferta:', err);
      return res.status(500).json({ error: 'Error consultando suscripción' });
    }
  },

  cancelarSuscripcionRevisionOferta: async (req, res) => {
    try {
      const email = String((req.params || {}).email || '').trim().toLowerCase();
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !re.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
      }
      await ensureSuscripcionesRevisionTable();
      const [result] = await pool.query('UPDATE suscripciones_revision_oferta SET activo = 0 WHERE email = ?', [email]);
      return res.json({ ok: true, updated: result.affectedRows });
    } catch (err) {
      console.error('Error cancelarSuscripcionRevisionOferta:', err);
      return res.status(500).json({ error: 'Error cancelando suscripción' });
    }
  },

  checkRevisionOfertaSchema: async () => {
    const cols = await getTableColumns('revision_oferta');
    if (!cols.size) {
      console.warn('No se pudieron obtener columnas de revision_oferta');
      return;
    }
    const missingRequired = [];
    if (!cols.has('id_solicitud')) missingRequired.push('id_solicitud');
    const hasConcept = cols.has('concepto_final') || cols.has('servicio_es_viable');
    if (missingRequired.length) {
      console.warn(`revision_oferta: faltan columnas requeridas (${missingRequired.join(', ')})`);
    }
    if (!hasConcept) {
      console.warn('revision_oferta: no existe concepto_final ni servicio_es_viable');
    }
    const expected = new Set([...ALLOWED_REVISION_FIELDS, 'servicio_es_viable']);
    const missingOptional = [];
    for (const key of expected) {
      if (!cols.has(key)) missingOptional.push(key);
    }
    if (missingOptional.length) {
      console.warn(`revision_oferta: columnas no encontradas (${missingOptional.join(', ')})`);
    }
  }
};

module.exports = solicitudesController;
