const pool = require('../config/db');

function likeParam(q) {
  return `%${(q || '').toLowerCase()}%`;
}

function trimStr(v) { return typeof v === 'string' ? v.trim() : v; }
function toNull(v) { const t = trimStr(v); return t === '' || t === undefined ? null : t; }

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
      res.json({ message: 'Eliminado' });
    } catch (err) {
      console.error('Error DELETE /api/equipos/:id', err);
      res.status(500).json({ message: 'Error eliminando equipo' });
    }
  },
};

module.exports = equiposController;
