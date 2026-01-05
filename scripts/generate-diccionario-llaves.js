/*
  Generates the public key dictionary Excel used by Plantillas.
  Output: frontend-lab/public/diccionario_llaves.xlsx

  This script is intentionally schema-light for modules whose allowed keys depend on DB columns
  (Equipos/Volumetricos/Referencia): it documents the supported scopes/patterns and loop markers.
*/

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

function extractSet(fileText, constName) {
  const re = new RegExp(`const\\s+${constName}\\s*=\\s+new\\s+Set\\(\\[([\\s\\S]*?)\\]\\);`);
  const m = re.exec(fileText);
  if (!m) return [];
  const body = m[1] || '';
  const out = [];
  const reStr = /'([^']+)'|\"([^\"]+)\"/g;
  let mm;
  while ((mm = reStr.exec(body))) {
    out.push(mm[1] || mm[2]);
  }
  return out;
}

function addSheet(workbook, name) {
  const ws = workbook.addWorksheet(name);
  ws.columns = [
    { header: 'Llave', key: 'llave', width: 44 },
    { header: 'Sirve para', key: 'sirve', width: 54 },
    { header: 'Ejemplo', key: 'ejemplo', width: 36 },
    { header: 'Origen', key: 'origen', width: 26 }
  ];
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.getRow(1).font = { bold: true };
  return ws;
}

function addFormato(ws, exampleKey, origin = 'Plantilla') {
  ws.addRow({
    llave: '(Formato)',
    sirve: 'Usa llaves con doble llave: {{scope.campo}}. Para listas usa bloques: {{#lista}} ... {{/lista}}.',
    ejemplo: exampleKey,
    origen: origin
  });
}

function addLoop(ws, name, note) {
  ws.addRow({
    llave: `{{#${name}}}`,
    sirve: `Inicio de bloque repetible para la lista ${name}. ${note || ''}`.trim(),
    ejemplo: `{{#${name}}}`,
    origen: `Loop (${name})`
  });
  ws.addRow({
    llave: `{{/${name}}}`,
    sirve: `Fin de bloque repetible para la lista ${name}.`,
    ejemplo: `{{/${name}}}`,
    origen: `Loop (${name})`
  });
}

function addFields(ws, scope, fields, originPrefix, descriptionPrefix) {
  for (const f of fields) {
    ws.addRow({
      llave: `{{${scope}.${f}}}`,
      sirve: `${descriptionPrefix} ${f}.`,
      ejemplo: `{{${scope}.${f}}}`,
      origen: `${originPrefix}.${f}`
    });
  }
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const controllersDir = path.join(repoRoot, 'src', 'controllers');

  const reactivosText = readText(path.join(controllersDir, 'reactivosController.js'));
  const solicitudesText = readText(path.join(controllersDir, 'solicitudesController.js'));

  const reactivoFields = extractSet(reactivosText, 'ALLOWED_REACTIVO_FIELDS');

  const clienteFields = extractSet(solicitudesText, 'ALLOWED_CLIENTE_FIELDS');
  const solicitudFields = extractSet(solicitudesText, 'ALLOWED_SOLICITUD_FIELDS');
  const ofertaFields = extractSet(solicitudesText, 'ALLOWED_OFERTA_FIELDS');
  const revisionFields = extractSet(solicitudesText, 'ALLOWED_REVISION_FIELDS');
  const seguimientoFields = extractSet(solicitudesText, 'ALLOWED_SEGUIMIENTO_ENCUESTA_FIELDS');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'backend-lab/scripts/generate-diccionario-llaves.js';
  workbook.created = new Date();

  // ===== Clientes =====
  {
    const ws = addSheet(workbook, 'Clientes');
    addFormato(ws, '{{cliente.nombre_solicitante}}', 'Plantilla');
    addLoop(ws, 'clientes', 'Si tu plantilla contiene este loop, se generará un documento con TODOS los clientes.');
    addFields(ws, 'cliente', clienteFields, 'clientes', 'Inserta el valor del campo');
  }

  // ===== Solicitudes =====
  {
    const ws = addSheet(workbook, 'Solicitudes');
    addFormato(ws, '{{solicitud.solicitud_id}}', 'Plantilla');
    addLoop(ws, 'solicitudes', 'Si tu plantilla contiene este loop, se generará un documento con TODAS las solicitudes.');

    addFields(ws, 'solicitud', solicitudFields, 'solicitudes', 'Inserta el valor del campo');

    // Scopes asociados (solo disponibles cuando se genera por solicitud individual)
    ws.addRow({
      llave: '(Nota)',
      sirve: 'Los scopes oferta/revision/seguimiento_encuesta se llenan cuando generas por solicitud individual; en modo loop pueden quedar vacíos.',
      ejemplo: '',
      origen: 'Backend'
    });
    addFields(ws, 'oferta', ofertaFields, 'oferta', 'Inserta el valor del campo');
    addFields(ws, 'revision', revisionFields, 'revision', 'Inserta el valor del campo');
    addFields(ws, 'seguimiento_encuesta', seguimientoFields, 'seguimiento_encuesta', 'Inserta el valor del campo');

    // Cliente también puede usarse en este módulo
    ws.addFields = undefined;
    ws.addRow({
      llave: '(Cliente)',
      sirve: 'También puedes usar llaves del scope cliente (ej. cuando generas documento de cliente).',
      ejemplo: '{{cliente.numero_identificacion}}',
      origen: 'clientes'
    });
    addFields(ws, 'cliente', clienteFields, 'clientes', 'Inserta el valor del campo');
  }

  // ===== Reactivos =====
  {
    const ws = addSheet(workbook, 'Reactivos');
    addFormato(ws, '{{reactivo.codigo}}', 'Plantilla');
    addLoop(ws, 'reactivos', 'Si tu plantilla contiene este loop, se generará un documento con TODOS los reactivos.');

    // Alias: el backend acepta reactivo.* y reactivos.* (útil dentro de loops)
    ws.addRow({
      llave: '(Alias)',
      sirve: 'El backend acepta los scopes reactivo.* y reactivos.*. Usa reactivo.* para un solo registro y reactivos.* dentro del loop.',
      ejemplo: '{{reactivos.nombre}}',
      origen: 'Backend'
    });

    addFields(ws, 'reactivo', reactivoFields, 'reactivos', 'Inserta el valor del campo');
    addFields(ws, 'reactivos', reactivoFields, 'reactivos', 'Inserta el valor del campo');
  }

  // ===== Equipos =====
  {
    const ws = addSheet(workbook, 'Equipos');
    addFormato(ws, '{{equipo.codigo_identificacion}}', 'Plantilla');
    addLoop(ws, 'historial', 'Lista de historial del equipo (siempre por equipo seleccionado).');
    addLoop(ws, 'intervalos', 'Lista de intervalos del equipo (siempre por equipo seleccionado).');
    ws.addRow({
      llave: '{{equipo.<columna>}}',
      sirve: 'Campos del equipo (tabla hv_equipos). Reemplaza <columna> por el nombre real de la columna.',
      ejemplo: '{{equipo.codigo_identificacion}}',
      origen: 'hv_equipos.<columna>'
    });
    ws.addRow({
      llave: '{{ficha.<columna>}}',
      sirve: 'Campos de ficha técnica (tabla ficha_tecnica_de_equipos).',
      ejemplo: '{{ficha.modelo}}',
      origen: 'ficha_tecnica_de_equipos.<columna>'
    });
    ws.addRow({
      llave: '{{historial_ultimo.<columna>}}',
      sirve: 'Campos del último registro del historial (historial_hv).',
      ejemplo: '{{historial_ultimo.fecha}}',
      origen: 'historial_hv (último).<columna>'
    });
    ws.addRow({
      llave: '{{intervalo_ultimo.<columna>}}',
      sirve: 'Campos del último registro del intervalo (intervalo_hv).',
      ejemplo: '{{intervalo_ultimo.fecha}}',
      origen: 'intervalo_hv (último).<columna>'
    });
    ws.addRow({
      llave: '{{historial.<columna>}}',
      sirve: 'Campos del historial dentro del loop #historial.',
      ejemplo: '{{historial.fecha}}',
      origen: 'historial_hv (loop).<columna>'
    });
    ws.addRow({
      llave: '{{intervalos.<columna>}}',
      sirve: 'Campos del intervalo dentro del loop #intervalos.',
      ejemplo: '{{intervalos.fecha}}',
      origen: 'intervalo_hv (loop).<columna>'
    });
  }

  // ===== Volumetricos =====
  {
    const ws = addSheet(workbook, 'Volumetricos');
    addFormato(ws, '{{material.codigo_material}}', 'Plantilla');
    addLoop(ws, 'historial', 'Lista de historial del volumétrico (por material seleccionado).');
    addLoop(ws, 'intervalos', 'Lista de intervalos del volumétrico (por material seleccionado).');
    ws.addRow({
      llave: '{{material.<columna>}}',
      sirve: 'Campos del material volumétrico (tabla volumetricos).',
      ejemplo: '{{material.codigo_material}}',
      origen: 'volumetricos.<columna>'
    });
    ws.addRow({
      llave: '{{historial_ultimo.<columna>}}',
      sirve: 'Campos del último registro del historial.',
      ejemplo: '{{historial_ultimo.fecha}}',
      origen: 'historial_volumetrico (último).<columna>'
    });
    ws.addRow({
      llave: '{{intervalo_ultimo.<columna>}}',
      sirve: 'Campos del último registro del intervalo.',
      ejemplo: '{{intervalo_ultimo.fecha}}',
      origen: 'intervalo_volumetrico (último).<columna>'
    });
    ws.addRow({
      llave: '{{historial.<columna>}}',
      sirve: 'Campos del historial dentro del loop #historial.',
      ejemplo: '{{historial.fecha}}',
      origen: 'historial_volumetrico (loop).<columna>'
    });
    ws.addRow({
      llave: '{{intervalos.<columna>}}',
      sirve: 'Campos del intervalo dentro del loop #intervalos.',
      ejemplo: '{{intervalos.fecha}}',
      origen: 'intervalo_volumetrico (loop).<columna>'
    });
  }

  // ===== Referencia =====
  {
    const ws = addSheet(workbook, 'Referencia');
    addFormato(ws, '{{material.codigo_material}}', 'Plantilla');
    addLoop(ws, 'historial', 'Lista de historial de referencia (por material seleccionado).');
    addLoop(ws, 'intervalos', 'Lista de intervalos de referencia (por material seleccionado).');
    ws.addRow({
      llave: '{{material.<columna>}}',
      sirve: 'Campos del material de referencia (tabla referencia).',
      ejemplo: '{{material.codigo_material}}',
      origen: 'referencia.<columna>'
    });
    ws.addRow({
      llave: '{{historial_ultimo.<columna>}}',
      sirve: 'Campos del último registro del historial.',
      ejemplo: '{{historial_ultimo.fecha}}',
      origen: 'historial_referencia (último).<columna>'
    });
    ws.addRow({
      llave: '{{intervalo_ultimo.<columna>}}',
      sirve: 'Campos del último registro del intervalo.',
      ejemplo: '{{intervalo_ultimo.fecha}}',
      origen: 'intervalo_referencia (último).<columna>'
    });
    ws.addRow({
      llave: '{{historial.<columna>}}',
      sirve: 'Campos del historial dentro del loop #historial.',
      ejemplo: '{{historial.fecha}}',
      origen: 'historial_referencia (loop).<columna>'
    });
    ws.addRow({
      llave: '{{intervalos.<columna>}}',
      sirve: 'Campos del intervalo dentro del loop #intervalos.',
      ejemplo: '{{intervalos.fecha}}',
      origen: 'intervalo_referencia (loop).<columna>'
    });
  }

  const outPath = path.resolve(repoRoot, '..', 'frontend-lab', 'public', 'diccionario_llaves.xlsx');
  await workbook.xlsx.writeFile(outPath);
  console.log('wrote', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
