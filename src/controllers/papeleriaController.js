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

function validPresentacion(v) {
  const s = String(v || '').trim();
  return s === 'unidad' || s === 'paquete' || s === 'caja' || s === 'cajas' ? s : null;
}

function detectImageMimeType(buffer) {
  if (!buffer || buffer.length < 4) return 'application/octet-stream';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif';
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }
  return 'application/octet-stream';
}

function attachImagenUrl(rows) {
  return (rows || []).map((r) => {
    const tiene = Number(r?.tiene_imagen) === 1 || r?.tiene_imagen === true;
    return {
      ...r,
      imagen_url: tiene && r?.id ? `/api/papeleria/${r.id}/imagen` : null
    };
  });
}

const papeleriaController = {
  getPapeleria: async (req, res) => {
    const q = (req.query.q || '').trim();
    let limit = parseInt(req.query.limit, 10);
    let offset = parseInt(req.query.offset, 10);
    if (isNaN(limit) || limit <= 0) limit = 0;
    if (isNaN(offset) || offset < 0) offset = 0;
    if (limit > 5000) limit = 5000;

    try {
      const select =
        'SELECT id, nombre, cantidad_adquirida, cantidad_existente, presentacion, marca, descripcion, fecha_adquisicion, ubicacion, observaciones, (imagen IS NOT NULL) AS tiene_imagen FROM papeleria';
      const where = q
        ? ' WHERE LOWER(nombre) LIKE ? OR LOWER(marca) LIKE ? OR LOWER(ubicacion) LIKE ? OR LOWER(descripcion) LIKE ? OR LOWER(observaciones) LIKE ?'
        : '';
      const order = ' ORDER BY id DESC';

      if (limit > 0) {
        const countQuery = `SELECT COUNT(*) as total FROM papeleria${q ? ' WHERE LOWER(nombre) LIKE ? OR LOWER(marca) LIKE ? OR LOWER(ubicacion) LIKE ? OR LOWER(descripcion) LIKE ? OR LOWER(observaciones) LIKE ?' : ''}`;
        let totalRows;
        if (q) {
          const p = likeParam(q);
          [totalRows] = await pool.query(countQuery, [p, p, p, p, p]);
        } else {
          [totalRows] = await pool.query(countQuery);
        }
        const total = totalRows[0]?.total || 0;
        let rows;
        if (q) {
          const p = likeParam(q);
          [rows] = await pool.query(`${select}${where}${order} LIMIT ? OFFSET ?`, [p, p, p, p, p, limit, offset]);
        } else {
          [rows] = await pool.query(`${select}${order} LIMIT ? OFFSET ?`, [limit, offset]);
        }
        return res.json({ rows: attachImagenUrl(rows), total });
      }

      let rows;
      if (q) {
        const p = likeParam(q);
        [rows] = await pool.query(`${select}${where}${order}`, [p, p, p, p, p]);
      } else {
        [rows] = await pool.query(`${select}${order}`);
      }
      return res.json(attachImagenUrl(rows));
    } catch (err) {
      console.error('Error GET /api/papeleria:', err);
      res.status(500).json({ message: 'Error listando papelería' });
    }
  },

  getPapeleriaImagen: async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });

    try {
      const [rows] = await pool.query('SELECT imagen FROM papeleria WHERE id = ?', [id]);
      if (!rows.length) return res.status(404).json({ message: 'No encontrado' });
      const img = rows[0]?.imagen || null;
      if (!img || img.length === 0) return res.status(404).json({ message: 'Sin imagen' });

      const buf = Buffer.isBuffer(img) ? img : Buffer.from(img);
      res.setHeader('Content-Type', detectImageMimeType(buf));
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(buf);
    } catch (err) {
      console.error('Error GET /api/papeleria/:id/imagen:', err);
      return res.status(500).json({ message: 'Error obteniendo imagen' });
    }
  },

  getPapeleriaById: async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });

    try {
      const [rows] = await pool.query(
        'SELECT id, nombre, cantidad_adquirida, cantidad_existente, presentacion, marca, descripcion, fecha_adquisicion, ubicacion, observaciones, (imagen IS NOT NULL) AS tiene_imagen FROM papeleria WHERE id = ?',
        [id]
      );
      if (!rows.length) return res.status(404).json({ message: 'No encontrado' });
      const r = rows[0];
      res.json({
        ...r,
        imagen_url: (Number(r?.tiene_imagen) === 1 || r?.tiene_imagen === true) ? `/api/papeleria/${r.id}/imagen` : null
      });
    } catch (err) {
      console.error('Error GET /api/papeleria/:id:', err);
      res.status(500).json({ message: 'Error obteniendo papelería' });
    }
  },

  createPapeleria: async (req, res) => {
    const body = req.body || {};
    const nombre = toNull(body.nombre);
    const cantidad_adquirida = intOrNull(body.cantidad_adquirida);
    const cantidad_existente = intOrNull(body.cantidad_existente);
    const presentacion = validPresentacion(body.presentacion);
    const marca = toNull(body.marca);
    const descripcion = toNull(body.descripcion);
    const fecha_adquisicion = toNull(body.fecha_adquisicion);
    const ubicacion = toNull(body.ubicacion);
    const observaciones = toNull(body.observaciones);
    const imagen = req.file?.buffer || null;

    if (!nombre || cantidad_adquirida === null || cantidad_existente === null || !presentacion) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }

    try {
      const [result] = await pool.query(
        'INSERT INTO papeleria (nombre, cantidad_adquirida, cantidad_existente, presentacion, marca, descripcion, fecha_adquisicion, ubicacion, observaciones, imagen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          nombre,
          cantidad_adquirida,
          cantidad_existente,
          presentacion,
          marca,
          descripcion,
          fecha_adquisicion,
          ubicacion,
          observaciones,
          imagen
        ]
      );
      res.status(201).json({ id: result.insertId, message: 'Papelería creada' });
    } catch (err) {
      console.error('Error POST /api/papeleria:', err);
      res.status(500).json({ message: 'Error creando papelería' });
    }
  },

  updatePapeleria: async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });

    const body = req.body || {};
    const nombre = toNull(body.nombre);
    const cantidad_adquirida = intOrNull(body.cantidad_adquirida);
    const cantidad_existente = intOrNull(body.cantidad_existente);
    const presentacion = validPresentacion(body.presentacion);
    const marca = toNull(body.marca);
    const descripcion = toNull(body.descripcion);
    const fecha_adquisicion = toNull(body.fecha_adquisicion);
    const ubicacion = toNull(body.ubicacion);
    const observaciones = toNull(body.observaciones);
    const imagen = req.file?.buffer || null;

    if (!nombre || cantidad_adquirida === null || cantidad_existente === null || !presentacion) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }

    try {
      const [exists] = await pool.query('SELECT id FROM papeleria WHERE id = ?', [id]);
      if (!exists.length) return res.status(404).json({ message: 'No encontrado' });

      if (imagen) {
        await pool.query(
          'UPDATE papeleria SET nombre = ?, cantidad_adquirida = ?, cantidad_existente = ?, presentacion = ?, marca = ?, descripcion = ?, fecha_adquisicion = ?, ubicacion = ?, observaciones = ?, imagen = ? WHERE id = ?',
          [
            nombre,
            cantidad_adquirida,
            cantidad_existente,
            presentacion,
            marca,
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
          'UPDATE papeleria SET nombre = ?, cantidad_adquirida = ?, cantidad_existente = ?, presentacion = ?, marca = ?, descripcion = ?, fecha_adquisicion = ?, ubicacion = ?, observaciones = ? WHERE id = ?',
          [
            nombre,
            cantidad_adquirida,
            cantidad_existente,
            presentacion,
            marca,
            descripcion,
            fecha_adquisicion,
            ubicacion,
            observaciones,
            id
          ]
        );
      }

      res.json({ message: 'Papelería actualizada' });
    } catch (err) {
      console.error('Error PUT /api/papeleria/:id:', err);
      res.status(500).json({ message: 'Error actualizando papelería' });
    }
  },

  deletePapeleria: async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });

    try {
      const [result] = await pool.query('DELETE FROM papeleria WHERE id = ?', [id]);
      if (!result.affectedRows) return res.status(404).json({ message: 'No encontrado' });
      res.json({ message: 'Papelería eliminada' });
    } catch (err) {
      console.error('Error DELETE /api/papeleria/:id:', err);
      res.status(500).json({ message: 'Error eliminando papelería' });
    }
  }
};

module.exports = papeleriaController;
