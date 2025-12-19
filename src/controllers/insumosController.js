const pool = require('../config/db');

function likeParam(q) {
  return `%${(q || '').toLowerCase()}%`;
}

function trimStr(v) {
  return typeof v === 'string' ? v.trim() : v;
}

function toNull(v) {
  const t = trimStr(v);
  return t === '' || t === undefined ? null : t;
}

function intOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

const insumosController = {
  getInsumos: async (req, res) => {
    const q = (req.query.q || '').trim();
    let limit = parseInt(req.query.limit, 10);
    let offset = parseInt(req.query.offset, 10);
    if (isNaN(limit) || limit <= 0) limit = 0;
    if (isNaN(offset) || offset < 0) offset = 0;
    if (limit > 5000) limit = 5000;

    try {
      const select =
        'SELECT id, nombre, cantidad_adquirida, cantidad_existente, presentacion, marca, referencia, descripcion, fecha_adquisicion, ubicacion, observaciones FROM insumos';
      const where = q
        ? ' WHERE LOWER(nombre) LIKE ? OR LOWER(marca) LIKE ? OR LOWER(referencia) LIKE ? OR LOWER(ubicacion) LIKE ? OR LOWER(descripcion) LIKE ? OR LOWER(observaciones) LIKE ?'
        : '';
      const order = ' ORDER BY id DESC';

      if (limit > 0) {
        const countQuery = `SELECT COUNT(*) as total FROM insumos${q ? ' WHERE LOWER(nombre) LIKE ? OR LOWER(marca) LIKE ? OR LOWER(referencia) LIKE ? OR LOWER(ubicacion) LIKE ? OR LOWER(descripcion) LIKE ? OR LOWER(observaciones) LIKE ?' : ''}`;
        let totalRows;
        if (q) {
          const p = likeParam(q);
          [totalRows] = await pool.query(countQuery, [p, p, p, p, p, p]);
        } else {
          [totalRows] = await pool.query(countQuery);
        }
        const total = totalRows[0]?.total || 0;
        let rows;
        if (q) {
          const p = likeParam(q);
          [rows] = await pool.query(`${select}${where}${order} LIMIT ? OFFSET ?`, [p, p, p, p, p, p, limit, offset]);
        } else {
          [rows] = await pool.query(`${select}${order} LIMIT ? OFFSET ?`, [limit, offset]);
        }
        return res.json({ rows, total });
      }

      let rows;
      if (q) {
        const p = likeParam(q);
        [rows] = await pool.query(`${select}${where}${order}`, [p, p, p, p, p, p]);
      } else {
        [rows] = await pool.query(`${select}${order}`);
      }
      return res.json(rows);
    } catch (err) {
      console.error('Error GET /api/insumos:', err);
      res.status(500).json({ message: 'Error listando insumos' });
    }
  },

  getInsumoById: async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });

    try {
      const [rows] = await pool.query(
        'SELECT id, nombre, cantidad_adquirida, cantidad_existente, presentacion, marca, referencia, descripcion, fecha_adquisicion, ubicacion, observaciones FROM insumos WHERE id = ?',
        [id]
      );
      if (!rows.length) return res.status(404).json({ message: 'No encontrado' });
      res.json(rows[0]);
    } catch (err) {
      console.error('Error GET /api/insumos/:id:', err);
      res.status(500).json({ message: 'Error obteniendo insumo' });
    }
  },

  createInsumo: async (req, res) => {
    const body = req.body || {};
    const nombre = toNull(body.nombre);
    const cantidad_adquirida = intOrNull(body.cantidad_adquirida);
    const cantidad_existente = intOrNull(body.cantidad_existente);
    const presentacion = toNull(body.presentacion);
    const marca = toNull(body.marca);
    const referencia = toNull(body.referencia);
    const descripcion = toNull(body.descripcion);
    const fecha_adquisicion = toNull(body.fecha_adquisicion);
    const ubicacion = toNull(body.ubicacion);
    const observaciones = toNull(body.observaciones);
    const imagen = req.file?.buffer || null;

    if (!nombre || cantidad_adquirida === null || cantidad_existente === null) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }

    try {
      const [result] = await pool.query(
        'INSERT INTO insumos (nombre, cantidad_adquirida, cantidad_existente, presentacion, marca, referencia, descripcion, fecha_adquisicion, ubicacion, observaciones, imagen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          nombre,
          cantidad_adquirida,
          cantidad_existente,
          presentacion,
          marca,
          referencia,
          descripcion,
          fecha_adquisicion,
          ubicacion,
          observaciones,
          imagen
        ]
      );
      res.status(201).json({ id: result.insertId, message: 'Insumo creado' });
    } catch (err) {
      console.error('Error POST /api/insumos:', err);
      res.status(500).json({ message: 'Error creando insumo' });
    }
  },

  updateInsumo: async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });

    const body = req.body || {};
    const nombre = toNull(body.nombre);
    const cantidad_adquirida = intOrNull(body.cantidad_adquirida);
    const cantidad_existente = intOrNull(body.cantidad_existente);
    const presentacion = toNull(body.presentacion);
    const marca = toNull(body.marca);
    const referencia = toNull(body.referencia);
    const descripcion = toNull(body.descripcion);
    const fecha_adquisicion = toNull(body.fecha_adquisicion);
    const ubicacion = toNull(body.ubicacion);
    const observaciones = toNull(body.observaciones);
    const imagen = req.file?.buffer || null;

    if (!nombre || cantidad_adquirida === null || cantidad_existente === null) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }

    try {
      const [exists] = await pool.query('SELECT id FROM insumos WHERE id = ?', [id]);
      if (!exists.length) return res.status(404).json({ message: 'No encontrado' });

      if (imagen) {
        await pool.query(
          'UPDATE insumos SET nombre = ?, cantidad_adquirida = ?, cantidad_existente = ?, presentacion = ?, marca = ?, referencia = ?, descripcion = ?, fecha_adquisicion = ?, ubicacion = ?, observaciones = ?, imagen = ? WHERE id = ?',
          [
            nombre,
            cantidad_adquirida,
            cantidad_existente,
            presentacion,
            marca,
            referencia,
            descripcion,
            fecha_adquisicion,
            ubicacion,
            observaciones,
            imagen,
            id
          ]
        );
      } else {
        await pool.query(
          'UPDATE insumos SET nombre = ?, cantidad_adquirida = ?, cantidad_existente = ?, presentacion = ?, marca = ?, referencia = ?, descripcion = ?, fecha_adquisicion = ?, ubicacion = ?, observaciones = ? WHERE id = ?',
          [
            nombre,
            cantidad_adquirida,
            cantidad_existente,
            presentacion,
            marca,
            referencia,
            descripcion,
            fecha_adquisicion,
            ubicacion,
            observaciones,
            id
          ]
        );
      }

      res.json({ message: 'Insumo actualizado' });
    } catch (err) {
      console.error('Error PUT /api/insumos/:id:', err);
      res.status(500).json({ message: 'Error actualizando insumo' });
    }
  },

  deleteInsumo: async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });

    try {
      const [result] = await pool.query('DELETE FROM insumos WHERE id = ?', [id]);
      if (!result.affectedRows) return res.status(404).json({ message: 'No encontrado' });
      res.json({ message: 'Insumo eliminado' });
    } catch (err) {
      console.error('Error DELETE /api/insumos/:id:', err);
      res.status(500).json({ message: 'Error eliminando insumo' });
    }
  }
};

module.exports = insumosController;

