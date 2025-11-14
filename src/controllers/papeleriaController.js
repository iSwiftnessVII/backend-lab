const pool = require('../config/db');

function likeParam(q) {
  return `%${(q || '').toLowerCase()}%`;
}

const papeleriaController = {
  // ===== Catálogo de papelería =====
  async getCatalogo(req, res) {
    const q = (req.query.q || '').trim();
    let limit = parseInt(req.query.limit, 10);
    let offset = parseInt(req.query.offset, 10);
    if (isNaN(limit) || limit <= 0) limit = 0;
    if (isNaN(offset) || offset < 0) offset = 0;
    if (limit > 500) limit = 500;
    try {
      const baseSelect = 'SELECT item, nombre, descripcion FROM catalogo_papeleria';
      const where = q ? ' WHERE CAST(item AS CHAR) LIKE ? OR LOWER(nombre) LIKE ?' : '';
      const order = ' ORDER BY item DESC';
      if (limit > 0) {
        const countQuery = `SELECT COUNT(*) as total FROM catalogo_papeleria${where}`;
        let totalRows;
        if (q) { [totalRows] = await pool.query(countQuery, [likeParam(q), likeParam(q)]); }
        else { [totalRows] = await pool.query(countQuery); }
        const total = totalRows[0]?.total || 0;
        let rows;
        if (q) {
          [rows] = await pool.query(`${baseSelect}${where}${order} LIMIT ? OFFSET ?`, [likeParam(q), likeParam(q), limit, offset]);
        } else {
          [rows] = await pool.query(`${baseSelect}${order} LIMIT ? OFFSET ?`, [limit, offset]);
        }
        return res.json({ rows, total });
      } else {
        let rows;
        if (q) {
          [rows] = await pool.query(`${baseSelect}${where}${order}`, [likeParam(q), likeParam(q)]);
        } else {
          [rows] = await pool.query(`${baseSelect}${order}`);
        }
        return res.json(rows);
      }
    } catch (err) {
      console.error('papeleria getCatalogo', err);
      res.status(500).json({ message: 'Error buscando catálogo' });
    }
  },

  async getCatalogoItem(req, res) {
    const { item } = req.params;
    try {
      const [rows] = await pool.query('SELECT item, nombre, descripcion FROM catalogo_papeleria WHERE CAST(item AS UNSIGNED) = CAST(? AS UNSIGNED)', [item]);
      if (!rows.length) return res.status(404).json({ message: 'No encontrado' });
      res.json(rows[0]);
    } catch (err) { console.error(err); res.status(500).json({ message: 'Error' }); }
  },

  async getCatalogoItemImagen(req, res) {
    const { item } = req.params;
    try {
      const [rows] = await pool.query('SELECT imagen FROM catalogo_papeleria WHERE CAST(item AS UNSIGNED) = CAST(? AS UNSIGNED)', [item]);
      if (!rows.length) return res.status(404).send('No encontrado');
      const img = rows[0]?.imagen;
      if (!img) return res.status(204).end();
      res.setHeader('Content-Type', 'image/jpeg');
      res.send(img);
    } catch (err) { console.error(err); res.status(500).send('Error obteniendo imagen'); }
  },

  async createCatalogo(req, res) {
    const { item, nombre, descripcion } = req.body || {};
    const imagenBuffer = req.file?.buffer || null;
    if (!item || !nombre) return res.status(400).json({ message: 'Item y nombre son requeridos' });
    const itemNum = parseInt(item, 10);
    if (Number.isNaN(itemNum)) return res.status(400).json({ message: 'El item debe ser numérico' });
    try {
      await pool.query('INSERT INTO catalogo_papeleria (item, nombre, descripcion, imagen) VALUES (?, ?, ?, ?)', [itemNum, nombre, descripcion || null, imagenBuffer]);
      
      // REGISTRO DE LOG - Con req.user.id
      if (req.user && req.user.id) {
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
          [req.user.id, 'CREAR', 'CATALOGO_PAPELERIA']
        );
      }

      res.status(201).json({ item: itemNum, nombre, descripcion: descripcion || null });
    } catch (err) {
      if (err && (err.code === 'ER_DATA_TOO_LONG' || err.errno === 1406)) {
        return res.status(413).json({ message: 'Imagen demasiado grande para la columna. Usa MEDIUMBLOB o <5MB.' });
      }
      if (err && err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'El item ya existe en catálogo' });
      console.error(err); res.status(500).json({ message: 'Error creando catálogo' });
    }
  },

  async deleteCatalogo(req, res) {
    const { item } = req.params;
    try {
      if (req.user && req.user.rol !== 'Administrador' && req.user.rol !== 'Superadmin') {
        return res.status(403).json({ message: 'No tienes permisos para eliminar. Solo administradores.' });
      }
      // Pre-check con equivalencia numérica
      const [existRows] = await pool.query('SELECT COUNT(*) AS cnt FROM catalogo_papeleria WHERE CAST(item AS UNSIGNED) = CAST(? AS UNSIGNED)', [item]);
      const exists = (existRows && existRows[0] && Number(existRows[0].cnt)) || 0;
      console.log('[PRECHECK DELETE catalogo_papeleria] item =', item, 'exists =', exists);
      if (!exists) return res.status(404).json({ message: `No encontrado en catálogo (item: ${item})` });

      // Borrar por equivalencia numérica
      const [result] = await pool.query('DELETE FROM catalogo_papeleria WHERE CAST(item AS UNSIGNED) = CAST(? AS UNSIGNED)', [item]);
      console.log('[DELETE catalogo_papeleria] item =', item, 'affectedRows =', result.affectedRows);
      if (result.affectedRows === 0) return res.status(404).json({ message: 'No encontrado' });
      
      // REGISTRO DE LOG - Con req.user.id
      if (req.user && req.user.id) {
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
          [req.user.id, 'ELIMINAR', 'CATALOGO_PAPELERIA']
        );
      }

      res.json({ deleted: result.affectedRows, message: 'Item de catálogo eliminado correctamente' });
    } catch (err) {
      if (err && (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED' || err.errno === 1451)) {
        return res.status(409).json({ message: 'No se puede eliminar: existen registros de papelería que usan este item de catálogo.' });
      }
      console.error('Error DELETE /catalogo/:item (papeleria):', err);
      res.status(500).json({ message: 'Error eliminando item de catálogo' });
    }
  },

  // ===== Inventario de papelería (CRUD) =====
  // GET /api/papeleria?q=&limit=
  async getPapeleria(req, res) {
    const q = (req.query.q || '').trim().toLowerCase();
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit <= 0) limit = 0;
    if (limit > 500) limit = 500;
    try {
      if (!q) {
        if (limit > 0) {
          const [rows] = await pool.query('SELECT * FROM papeleria ORDER BY id DESC LIMIT ?', [limit]);
          return res.json(rows);
        } else {
          const [rows] = await pool.query('SELECT * FROM papeleria ORDER BY id DESC');
          return res.json(rows);
        }
      }

      const searchQuery = `
        SELECT * FROM papeleria
        WHERE CAST(item_catalogo AS CHAR) LIKE ? OR LOWER(nombre) LIKE ? OR LOWER(marca) LIKE ?
        ORDER BY id DESC
      `;

      if (limit > 0) {
        const [rows] = await pool.query(
          `${searchQuery} LIMIT ?`,
          [likeParam(q), likeParam(q), likeParam(q), limit]
        );
        return res.json(rows);
      } else {
        const [rows] = await pool.query(searchQuery, [likeParam(q), likeParam(q), likeParam(q)]);
        return res.json(rows);
      }
    } catch (err) {
      console.error('Error GET / (papeleria):', err);
      res.status(500).json({ message: 'Error listando papelería' });
    }
  },

  // GET /api/papeleria/:id
  async getPapeleriaById(req, res) {
    const { id } = req.params;
    try {
      const [rows] = await pool.query('SELECT * FROM papeleria WHERE id = ?', [id]);
      if (!rows.length) return res.status(404).json({ message: 'No encontrado' });
      res.json(rows[0]);
    } catch (err) {
      console.error('Error GET /:id (papeleria):', err);
      res.status(500).json({ message: 'Error obteniendo papelería' });
    }
  },

  // POST /api/papeleria
  async createPapeleria(req, res) {
    const {
      item_catalogo,
      nombre,
      cantidad_adquirida,
      cantidad_existente,
      presentacion,
      marca,
      descripcion,
      fecha_adquisicion,
      ubicacion,
      observaciones
    } = req.body || {};

    if (!item_catalogo || !nombre || cantidad_adquirida == null || cantidad_existente == null) {
      return res.status(400).json({
        message: 'Faltan campos requeridos: item_catalogo, nombre, cantidad_adquirida, cantidad_existente'
      });
    }

    try {
      const [result] = await pool.query(
        `INSERT INTO papeleria (
          item_catalogo, nombre, cantidad_adquirida, cantidad_existente,
          presentacion, marca, descripcion, fecha_adquisicion, ubicacion, observaciones
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item_catalogo,
          nombre,
          cantidad_adquirida,
          cantidad_existente,
          presentacion || null,
          marca || null,
          descripcion || null,
          fecha_adquisicion || null,
          ubicacion || null,
          observaciones || null
        ]
      );

      // REGISTRO DE LOG - Con req.user.id
      if (req.user && req.user.id) {
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
          [req.user.id, 'CREAR', 'PAPELERIA']
        );

        // REGISTRO DE MOVIMIENTO
        await pool.query(
          'INSERT INTO movimientos_inventario (producto_tipo, producto_referencia, usuario_id, tipo_movimiento) VALUES (?, ?, ?, ?)',
          ['PAPELERIA', result.insertId.toString(), req.user.id, 'ENTRADA']
        );
      }

      res.status(201).json({ message: 'Papelería creada correctamente' });
    } catch (err) {
      console.error('Error POST / (papeleria):', err);
      res.status(500).json({ message: 'Error creando papelería' });
    }
  },

  // PUT /api/papeleria/:id
  async updatePapeleria(req, res) {
    const { id } = req.params;
    const {
      item_catalogo,
      nombre,
      cantidad_adquirida,
      cantidad_existente,
      presentacion,
      marca,
      descripcion,
      fecha_adquisicion,
      ubicacion,
      observaciones
    } = req.body || {};

    try {
      const [result] = await pool.query(
        `UPDATE papeleria SET
          item_catalogo = ?, nombre = ?, cantidad_adquirida = ?, cantidad_existente = ?,
          presentacion = ?, marca = ?, descripcion = ?, fecha_adquisicion = ?, ubicacion = ?, observaciones = ?
        WHERE id = ?`,
        [
          item_catalogo,
          nombre,
          cantidad_adquirida,
          cantidad_existente,
          presentacion || null,
          marca || null,
          descripcion || null,
          fecha_adquisicion || null,
          ubicacion || null,
          observaciones || null,
          id
        ]
      );
      if (result.affectedRows === 0) return res.status(404).json({ message: 'No encontrado' });

      // REGISTRO DE LOG - Con req.user.id
      if (req.user && req.user.id) {
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
          [req.user.id, 'ACTUALIZAR', 'PAPELERIA']
        );
      }

      res.json({ message: 'Papelería actualizada correctamente' });
    } catch (err) {
      console.error('Error PUT /:id (papeleria):', err);
      res.status(500).json({ message: 'Error actualizando papelería' });
    }
  },

  // PATCH /api/papeleria/:id/existencias
  async ajustarExistencias(req, res) {
    const { id } = req.params;
    const { delta, cantidad } = req.body || {};
    try {
      if (typeof cantidad !== 'undefined') {
        const c = Number(cantidad);
        if (!Number.isFinite(c) || c < 0) {
          return res.status(400).json({ message: 'Cantidad inválida. Debe ser >= 0' });
        }
        const [result] = await pool.query('UPDATE papeleria SET cantidad_existente = ? WHERE id = ?', [c, id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'No encontrado' });
      } else if (typeof delta !== 'undefined') {
        const d = Number(delta);
        if (!Number.isFinite(d) || d === 0) {
          return res.status(400).json({ message: 'Delta inválido. Debe ser distinto de 0' });
        }
        const [result] = await pool.query(
          'UPDATE papeleria SET cantidad_existente = GREATEST(0, cantidad_existente + ?) WHERE id = ?',
          [d, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'No encontrado' });
      } else {
        return res.status(400).json({ message: 'Provee cantidad (>=0) o delta (!=0)' });
      }

      const [rows] = await pool.query('SELECT cantidad_existente FROM papeleria WHERE id = ?', [id]);
      const nuevo = rows[0]?.cantidad_existente;

      // REGISTRO DE LOG - Con req.user.id
      if (req.user && req.user.id) {
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
          [req.user.id, 'AJUSTAR_EXISTENCIAS', 'PAPELERIA']
        );

        // REGISTRO DE MOVIMIENTO
        await pool.query(
          'INSERT INTO movimientos_inventario (producto_tipo, producto_referencia, usuario_id, tipo_movimiento) VALUES (?, ?, ?, ?)',
          ['PAPELERIA', id.toString(), req.user.id, 'AJUSTE']
        );
      }

      return res.json({ id, cantidad_existente: nuevo });
    } catch (err) {
      console.error('Error PATCH /:id/existencias (papeleria):', err);
      res.status(500).json({ message: 'Error ajustando existencias' });
    }
  },

  // DELETE /api/papeleria/:id
  async deletePapeleria(req, res) {
    const { id } = req.params;
    try {
      if (req.user && req.user.rol !== 'Administrador' && req.user.rol !== 'Superadmin') {
        return res.status(403).json({ message: 'No tienes permisos para eliminar. Solo administradores.' });
      }
      const [result] = await pool.query('DELETE FROM papeleria WHERE id = ?', [id]);
      if (result.affectedRows === 0) return res.status(404).json({ message: 'No encontrado' });

      // REGISTRO DE LOG - Con req.user.id
      if (req.user && req.user.id) {
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
          [req.user.id, 'ELIMINAR', 'PAPELERIA']
        );
      }

      res.json({ message: 'Papelería eliminada correctamente' });
    } catch (err) {
      console.error('Error DELETE /:id (papeleria):', err);
      res.status(500).json({ message: 'Error eliminando papelería' });
    }
  }
};

module.exports = papeleriaController;