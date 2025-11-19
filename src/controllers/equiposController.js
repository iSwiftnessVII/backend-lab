const pool = require('../config/db');

function likeParam(q) {
  return `%${(q || '').toLowerCase()}%`;
}

function trimStr(v) { return typeof v === 'string' ? v.trim() : v; }
function toNull(v) { const t = trimStr(v); return t === '' || t === undefined ? null : t; }

async function ensureVccTable() {
  // Crea la tabla VCC si no existe para evitar errores 500 por tabla ausente
  await pool.query(`
    CREATE TABLE IF NOT EXISTS verificacion_calibracion_calificacion (
      id INT AUTO_INCREMENT PRIMARY KEY,
      equipo_id INT NOT NULL,
      campo_medicion VARCHAR(100) NULL,
      exactitud VARCHAR(100) NULL,
      sujeto_verificar ENUM('Si','No') NULL,
      sujeto_calibracion ENUM('Si','No') NULL,
      resolucion_division VARCHAR(100) NULL,
      sujeto_calificacion ENUM('Si','No') NULL,
      accesorios TEXT NULL,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_vcc_equipo (equipo_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function ensureHistorialTable() {
  // Crea la tabla historial_instrumento si no existe (según esquema proporcionado)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS historial_instrumento (
      id INT AUTO_INCREMENT PRIMARY KEY,
      equipo_id INT NOT NULL,
      numero INT NULL,
      fecha DATE NULL,
      tipo_historial VARCHAR(100) NULL,
      codigo_registro VARCHAR(100) NULL,
      tolerancia_g DECIMAL(10,4) NULL,
      tolerancia_error_g DECIMAL(10,4) NULL,
      incertidumbre_u DECIMAL(10,4) NULL,
      realizo VARCHAR(150) NULL,
      superviso VARCHAR(150) NULL,
      observaciones TEXT NULL,
      INDEX idx_hist_equipo (equipo_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

const equiposController = {
  // GET /api/equipos?q=&limit=&offset=
  getEquipos: async (req, res) => {
    const q = (req.query.q || '').trim();
    let limit = parseInt(req.query.limit, 10);
    let offset = parseInt(req.query.offset, 10);
    if (isNaN(limit) || limit <= 0) limit = 0;
    if (isNaN(offset) || offset < 0) offset = 0;
    if (limit > 500) limit = 500;

    try {
      const base = `SELECT id, nombre, modelo, marca, inventario_sena, acreditacion, tipo_manual, codigo_identificacion, numero_serie, tipo, clasificacion, manual_usuario, puesta_en_servicio, fecha_adquisicion FROM equipos`;
      const where = q ? ` WHERE LOWER(nombre) LIKE ? OR LOWER(modelo) LIKE ? OR LOWER(marca) LIKE ? OR LOWER(codigo_identificacion) LIKE ? OR LOWER(numero_serie) LIKE ?` : '';
      const order = ' ORDER BY id DESC';

      if (limit > 0) {
        const countQuery = `SELECT COUNT(*) as total FROM equipos${where}`;
        let totalRows;
        if (q) {
          const p = [likeParam(q), likeParam(q), likeParam(q), likeParam(q), likeParam(q)];
          [totalRows] = await pool.query(countQuery, p);
        } else {
          [totalRows] = await pool.query(countQuery);
        }
        const total = totalRows[0]?.total || 0;
        let rows;
        if (q) {
          const params = [likeParam(q), likeParam(q), likeParam(q), likeParam(q), likeParam(q), limit, offset];
          [rows] = await pool.query(`${base}${where}${order} LIMIT ? OFFSET ?`, params);
        } else {
          [rows] = await pool.query(`${base}${order} LIMIT ? OFFSET ?`, [limit, offset]);
        }
        return res.json({ rows, total });
      } else {
        let rows;
        if (q) {
          const params = [likeParam(q), likeParam(q), likeParam(q), likeParam(q), likeParam(q)];
          [rows] = await pool.query(`${base}${where}${order}`, params);
        } else {
          [rows] = await pool.query(`${base}${order}`);
        }
        return res.json(rows);
      }
    } catch (err) {
      console.error('Error GET /api/equipos:', err);
      res.status(500).json({ message: 'Error listando equipos' });
    }
  },

  // GET /api/equipos/:id
  getEquipoById: async (req, res) => {
    const { id } = req.params;
    try {
      const [rows] = await pool.query(`SELECT id, nombre, modelo, marca, inventario_sena, acreditacion, tipo_manual, codigo_identificacion, numero_serie, tipo, clasificacion, manual_usuario, puesta_en_servicio, fecha_adquisicion FROM equipos WHERE id = ?`, [id]);
      if (!rows.length) return res.status(404).json({ message: 'No encontrado' });
      res.json(rows[0]);
    } catch (err) {
      console.error('Error GET /api/equipos/:id', err);
      res.status(500).json({ message: 'Error obteniendo equipo' });
    }
  },

  // POST /api/equipos
createEquipo: async (req, res) => {
  const {
    nombre,
    modelo,
    marca,
    inventario_sena,
    acreditacion,
    tipo_manual,
    codigo_identificacion,
    numero_serie,
    tipo,
    clasificacion,
    manual_usuario,
    puesta_en_servicio,
    fecha_adquisicion,
  } = req.body || {};

  if (!nombre || !String(nombre).trim()) {
    return res.status(400).json({ message: 'El nombre es requerido' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO equipos (nombre, modelo, marca, inventario_sena, acreditacion, tipo_manual, codigo_identificacion, numero_serie, tipo, clasificacion, manual_usuario, puesta_en_servicio, fecha_adquisicion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(nombre).trim(),
        toNull(modelo),
        toNull(marca),
        toNull(inventario_sena),
        toNull(acreditacion),
        toNull(tipo_manual),
        toNull(codigo_identificacion),
        toNull(numero_serie),
        toNull(tipo),
        toNull(clasificacion),
        toNull(manual_usuario),
        toNull(puesta_en_servicio),
        toNull(fecha_adquisicion),
      ]
    );
    const id = result.insertId;

    // REGISTRO DE LOG - Con req.user.id
    if (req.user && req.user.id) {
      await pool.query(
        'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
        [req.user.id, 'CREAR', 'EQUIPOS']
      );

      // REGISTRO DE MOVIMIENTO
      await pool.query(
        'INSERT INTO movimientos_inventario (producto_tipo, producto_referencia, usuario_id, tipo_movimiento) VALUES (?, ?, ?, ?)',
        ['EQUIPO', id.toString(), req.user.id, 'ENTRADA']
      );
    }

    res.status(201).json({ id, nombre: String(nombre).trim(), modelo: toNull(modelo), marca: toNull(marca) });
  } catch (err) {
    console.error('Error POST /api/equipos:', err);
    res.status(500).json({ message: 'Error creando equipo' });
  }
},


  // PUT /api/equipos/:id
updateEquipo: async (req, res) => {
  const { id } = req.params;
  const {
    nombre,
    modelo,
    marca,
    inventario_sena,
    acreditacion,
    tipo_manual,
    codigo_identificacion,
    numero_serie,
    tipo,
    clasificacion,
    manual_usuario,
    puesta_en_servicio,
    fecha_adquisicion,
  } = req.body || {};

  try {
    const [result] = await pool.query(
      `UPDATE equipos
       SET nombre = ?, modelo = ?, marca = ?, inventario_sena = ?, acreditacion = ?, tipo_manual = ?, codigo_identificacion = ?, numero_serie = ?, tipo = ?, clasificacion = ?, manual_usuario = ?, puesta_en_servicio = ?, fecha_adquisicion = ?
       WHERE id = ?`,
      [
        toNull(nombre),
        toNull(modelo),
        toNull(marca),
        toNull(inventario_sena),
        toNull(acreditacion),
        toNull(tipo_manual),
        toNull(codigo_identificacion),
        toNull(numero_serie),
        toNull(tipo),
        toNull(clasificacion),
        toNull(manual_usuario),
        toNull(puesta_en_servicio),
        toNull(fecha_adquisicion),
        id,
      ]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'No encontrado' });

    // REGISTRO DE LOG - Con req.user.id
    if (req.user && req.user.id) {
      await pool.query(
        'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
        [req.user.id, 'ACTUALIZAR', 'EQUIPOS']
      );
    }

    res.json({ message: 'Actualizado' });
  } catch (err) {
    console.error('Error PUT /api/equipos/:id', err);
    res.status(500).json({ message: 'Error actualizando equipo' });
  }
},

  // DELETE /api/equipos/:id
deleteEquipo: async (req, res) => {
  if (req.user && req.user.rol !== 'Administrador' && req.user.rol !== 'Superadmin') {
    return res.status(403).json({ message: 'No tienes permisos para eliminar equipos' });
  }
  const { id } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM equipos WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'No encontrado' });

    // REGISTRO DE LOG - Con req.user.id
    if (req.user && req.user.id) {
      await pool.query(
        'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
        [req.user.id, 'ELIMINAR', 'EQUIPOS']
      );
    }

    res.json({ message: 'Eliminado' });
  } catch (err) {
    console.error('Error DELETE /api/equipos/:id', err);
    res.status(500).json({ message: 'Error eliminando equipo' });
  }
},

  // POST /api/equipos/:id/mantenimientos
  createMantenimientoEquipo: async (req, res) => {
    const { id } = req.params; // equipo_id
    const {
      requerimientos_equipo,
      elementos_v,
      voltaje,
      elementos_f,
      frecuencia,
    } = req.body || {};

    const equipoIdNum = parseInt(id, 10);
    if (!equipoIdNum || isNaN(equipoIdNum)) {
      return res.status(400).json({ message: 'ID de equipo inválido' });
    }

    function normEnum(v) {
      if (v === undefined || v === null) return null;
      const s = String(v).trim().toLowerCase();
      if (s === 'si') return 'Si';
      if (s === 'no') return 'No';
      return null;
    }

    const hasValue = (v) => v !== undefined && v !== null && String(v).trim() !== '';
    const ev = normEnum(elementos_v);
    const ef = normEnum(elementos_f);
    // Permitir null/'' como valor vacío; solo validar cuando hay valor real
    if (hasValue(elementos_v) && ev === null) {
      return res.status(400).json({ message: "elementos_v debe ser 'Si' o 'No'" });
    }
    if (hasValue(elementos_f) && ef === null) {
      return res.status(400).json({ message: "elementos_f debe ser 'Si' o 'No'" });
    }

    try {
      const [result] = await pool.query(
        `INSERT INTO mantenimiento_equipo (equipo_id, requerimientos_equipo, elementos_v, voltaje, elementos_f, frecuencia)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          equipoIdNum,
          toNull(requerimientos_equipo),
          ev,
          toNull(voltaje && String(voltaje).slice(0,50)),
          ef,
          toNull(frecuencia && String(frecuencia).slice(0,50)),
        ]
      );
      res.status(201).json({ id: result.insertId, equipo_id: equipoIdNum });
    } catch (err) {
      console.error('Error POST /api/equipos/:id/mantenimientos', err);
      res.status(500).json({ message: 'Error creando mantenimiento de equipo' });
    }
  },
  // GET /api/equipos/:id/mantenimientos
  getMantenimientosEquipo: async (req, res) => {
    const { id } = req.params;
    const equipoIdNum = parseInt(id, 10);
    if (!equipoIdNum || isNaN(equipoIdNum)) {
      return res.status(400).json({ message: 'ID de equipo inválido' });
    }
    try {
      const [rows] = await pool.query(
        `SELECT id, equipo_id, requerimientos_equipo, elementos_v, voltaje, elementos_f, frecuencia
         FROM mantenimiento_equipo WHERE equipo_id = ? ORDER BY id DESC`,
        [equipoIdNum]
      );
      res.json(rows);
    } catch (err) {
      console.error('Error GET /api/equipos/:id/mantenimientos', err);
      res.status(500).json({ message: 'Error listando mantenimientos de equipo' });
    }
  },
  // POST /api/equipos/:id/verificaciones
  createVcc: async (req, res) => {
    try { await ensureVccTable(); } catch (e) { /* ignore table create race */ }
    const { id } = req.params; // equipo_id
    const {
      campo_medicion,
      exactitud,
      sujeto_verificar,
      sujeto_calibracion,
      resolucion_division,
      sujeto_calificacion,
      accesorios,
    } = req.body || {};

    const equipoIdNum = parseInt(id, 10);
    if (!equipoIdNum || isNaN(equipoIdNum)) {
      return res.status(400).json({ message: 'ID de equipo inválido' });
    }

    function normEnum(v) {
      if (v === undefined || v === null) return null;
      const s = String(v).trim().toLowerCase();
      if (s === 'si') return 'Si';
      if (s === 'no') return 'No';
      return null;
    }
    const hasVal = (v) => v !== undefined && v !== null && String(v).trim() !== '';
    const sv = normEnum(sujeto_verificar);
    const scb = normEnum(sujeto_calibracion);
    const scf = normEnum(sujeto_calificacion);
    if (hasVal(sujeto_verificar) && sv === null) return res.status(400).json({ message: "sujeto_verificar debe ser 'Si' o 'No'" });
    if (hasVal(sujeto_calibracion) && scb === null) return res.status(400).json({ message: "sujeto_calibracion debe ser 'Si' o 'No'" });
    if (hasVal(sujeto_calificacion) && scf === null) return res.status(400).json({ message: "sujeto_calificacion debe ser 'Si' o 'No'" });

    try {
      const [result] = await pool.query(
        `INSERT INTO verificacion_calibracion_calificacion
          (equipo_id, campo_medicion, exactitud, sujeto_verificar, sujeto_calibracion, resolucion_division, sujeto_calificacion, accesorios)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          equipoIdNum,
          toNull(campo_medicion && String(campo_medicion).slice(0, 100)),
          toNull(exactitud && String(exactitud).slice(0, 100)),
          sv,
          scb,
          toNull(resolucion_division && String(resolucion_division).slice(0, 100)),
          scf,
          toNull(accesorios),
        ]
      );
      res.status(201).json({ id: result.insertId, equipo_id: equipoIdNum });
    } catch (err) {
      console.error('Error POST /api/equipos/:id/verificaciones', err);
      res.status(500).json({ 
        message: 'Error creando verificación/calibración/calificación',
        code: err && err.code,
        errno: err && err.errno,
        sqlMessage: err && err.sqlMessage,
        sqlState: err && err.sqlState
      });
    }
  },

  // GET /api/equipos/:id/verificaciones
  getVcc: async (req, res) => {
    try { await ensureVccTable(); } catch (e) { /* ignore table create race */ }
    const { id } = req.params;
    const equipoIdNum = parseInt(id, 10);
    if (!equipoIdNum || isNaN(equipoIdNum)) {
      return res.status(400).json({ message: 'ID de equipo inválido' });
    }
    try {
      const [rows] = await pool.query(
        `SELECT id, equipo_id, campo_medicion, exactitud, sujeto_verificar, sujeto_calibracion, resolucion_division, sujeto_calificacion, accesorios
         FROM verificacion_calibracion_calificacion WHERE equipo_id = ? ORDER BY id DESC`,
        [equipoIdNum]
      );
      res.json(rows);
    } catch (err) {
      console.error('Error GET /api/equipos/:id/verificaciones', err);
      // Si la tabla no existe y no se pudo crear, devolvemos lista vacía para no romper el front
      if (err && (err.code === 'ER_NO_SUCH_TABLE' || err.errno === 1146)) {
        return res.json([]);
      }
      res.status(500).json({ 
        message: 'Error listando verificaciones/calibraciones/calificaciones',
        code: err && err.code,
        errno: err && err.errno,
        sqlMessage: err && err.sqlMessage,
        sqlState: err && err.sqlState
      });
    }
  },

  // POST /api/equipos/:id/historial (historial instrumento)
  createHistorialEquipo: async (req, res) => {
    try { await ensureHistorialTable(); } catch (e) { /* ignore */ }
    const { id } = req.params; // equipo_id
    const {
      numero,
      fecha,
      tipo_historial,
      codigo_registro,
      tolerancia_g,
      tolerancia_error_g,
      incertidumbre_u,
      realizo,
      superviso,
      observaciones,
    } = req.body || {};

    const equipoIdNum = parseInt(id, 10);
    if (!equipoIdNum || isNaN(equipoIdNum)) {
      return res.status(400).json({ message: 'ID de equipo inválido' });
    }

    // Normalizar decimales (permitir null / '')
    function normDec(v) {
      if (v === undefined || v === null || String(v).trim() === '') return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    }

    try {
      const [result] = await pool.query(
        `INSERT INTO historial_instrumento
          (equipo_id, numero, fecha, tipo_historial, codigo_registro, tolerancia_g, tolerancia_error_g, incertidumbre_u, realizo, superviso, observaciones)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          equipoIdNum,
          numero === undefined || numero === null || String(numero).trim() === '' ? null : parseInt(numero, 10),
          toNull(fecha),
          toNull(tipo_historial && String(tipo_historial).slice(0,100)),
          toNull(codigo_registro && String(codigo_registro).slice(0,100)),
          normDec(tolerancia_g),
          normDec(tolerancia_error_g),
            normDec(incertidumbre_u),
          toNull(realizo && String(realizo).slice(0,150)),
          toNull(superviso && String(superviso).slice(0,150)),
          toNull(observaciones),
        ]
      );
      res.status(201).json({ id: result.insertId, equipo_id: equipoIdNum });
    } catch (err) {
      console.error('Error POST /api/equipos/:id/historial', err);
      res.status(500).json({ message: 'Error creando historial de instrumento', code: err && err.code });
    }
  },

  // GET /api/equipos/:id/historial
  getHistorialEquipo: async (req, res) => {
    try { await ensureHistorialTable(); } catch (e) { /* ignore */ }
    const { id } = req.params;
    const equipoIdNum = parseInt(id, 10);
    if (!equipoIdNum || isNaN(equipoIdNum)) {
      return res.status(400).json({ message: 'ID de equipo inválido' });
    }
    try {
      const [rows] = await pool.query(
        `SELECT id, equipo_id, numero, fecha, tipo_historial, codigo_registro, tolerancia_g, tolerancia_error_g, incertidumbre_u, realizo, superviso, observaciones
         FROM historial_instrumento WHERE equipo_id = ? ORDER BY id DESC`,
        [equipoIdNum]
      );
      res.json(rows);
    } catch (err) {
      console.error('Error GET /api/equipos/:id/historial', err);
      res.status(500).json({ message: 'Error listando historial de instrumento' });
    }
  },

  // GET /api/equipos/:id/intervalos
  getIntervalosEquipo: async (req, res) => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS intervalo_calibracion_equipo (
          id INT AUTO_INCREMENT PRIMARY KEY,
          equipo_id INT NOT NULL,
          numero INT,
          unidad_nominal_g DECIMAL(10,4),
          calibracion_1 VARCHAR(100),
          fecha_c1 DATE,
          error_c1_g DECIMAL(10,4),
          calibracion_2 VARCHAR(100),
          fecha_c2 DATE,
          error_c2_g DECIMAL(10,4),
          diferencia_dias INT,
          desviacion DECIMAL(10,4),
          deriva DECIMAL(10,4),
          tolerancia_g DECIMAL(10,4),
          intervalo_calibraciones_dias INT,
          intervalo_calibraciones_anios DECIMAL(10,4),
          FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (e) { /* ignore */ }
    const { id } = req.params;
    const equipoIdNum = parseInt(id, 10);
    if (!equipoIdNum || isNaN(equipoIdNum)) {
      return res.status(400).json({ message: 'ID de equipo inválido' });
    }
    try {
      const [rows] = await pool.query(
        `SELECT * FROM intervalo_calibracion_equipo WHERE equipo_id = ? ORDER BY id DESC`,
        [equipoIdNum]
      );
      // SIEMPRE retorna 200 y un array (vacío si no hay datos)
      res.json(rows);
    } catch (err) {
      console.error('Error GET /api/equipos/:id/intervalos', err);
      res.status(500).json({ message: 'Error listando intervalos de calibración' });
    }
  },

  // POST /api/equipos/:id/intervalos
  createIntervaloEquipo: async (req, res) => {
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS intervalo_calibracion_equipo (
        id INT AUTO_INCREMENT PRIMARY KEY,
        equipo_id INT NOT NULL,
        numero INT,
        unidad_nominal_g DECIMAL(10,4),
        calibracion_1 VARCHAR(100),
        fecha_c1 DATE,
        error_c1_g DECIMAL(10,4),
        calibracion_2 VARCHAR(100),
        fecha_c2 DATE,
        error_c2_g DECIMAL(10,4),
        diferencia_dias INT,
        desviacion DECIMAL(10,4),
        deriva DECIMAL(10,4),
        tolerancia_g DECIMAL(10,4),
        intervalo_calibraciones_dias INT,
        intervalo_calibraciones_anios DECIMAL(10,4),
        FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
    } catch (e) { /* ignore */ }
    const { id } = req.params;
    const equipoIdNum = parseInt(id, 10);
    if (!equipoIdNum || isNaN(equipoIdNum)) {
      return res.status(400).json({ message: 'ID de equipo inválido' });
    }
    const {
      numero, unidad_nominal_g, calibracion_1, fecha_c1, error_c1_g,
      calibracion_2, fecha_c2, error_c2_g, diferencia_dias, desviacion,
      deriva, tolerancia_g, intervalo_calibraciones_dias, intervalo_calibraciones_anios
    } = req.body || {};
    try {
      const [result] = await pool.query(
        `INSERT INTO intervalo_calibracion_equipo
          (equipo_id, numero, unidad_nominal_g, calibracion_1, fecha_c1, error_c1_g, calibracion_2, fecha_c2, error_c2_g, diferencia_dias, desviacion, deriva, tolerancia_g, intervalo_calibraciones_dias, intervalo_calibraciones_anios)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          equipoIdNum,
          numero,
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
        ]
      );
      res.json({ message: 'Intervalo creado', id: result.insertId });
    } catch (err) {
      console.error('Error POST /api/equipos/:id/intervalos', err);
      res.status(500).json({ message: 'Error creando intervalo' });
    }
  },
};

module.exports = equiposController;
