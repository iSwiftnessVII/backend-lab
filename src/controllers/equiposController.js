const pool = require('../config/db');

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

    // Convierte undefined a null en todos los parámetros
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

    await pool.execute(sql, [
      ...params
    ]);

    res.status(201).json({ message: 'Ficha técnica registrada correctamente' });
  } catch (error) {
    console.error('Error al registrar ficha técnica:', error);
    res.status(500).json({ message: 'Error al registrar ficha técnica', error: error.message });
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

