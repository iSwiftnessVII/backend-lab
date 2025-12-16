const pool = require('../config/db');

// Helpers (se mantienen en el controller)
function likeParam(q) {
  return `%${(q || '').toLowerCase()}%`;
}

const insumosController = {
  // GET /api/insumos/aux
  getAux: async (req, res) => {
    try {
      res.json({
        tipos: [],
        clasif: [],
        unidades: [],
        estado: [],
        recipiente: [],
        almacen: []
      });
    } catch (err) {
      console.error('Error /aux:', err);
      res.status(500).json({ message: 'Error obteniendo datos auxiliares' });
    }
  },

  // ========== CATÁLOGO DE INSUMOS ==========

  // GET /api/insumos/catalogo?q=&limit=&offset=
  getCatalogo: async (req, res) => {
    const q = (req.query.q || '').trim();
    let limit = parseInt(req.query.limit, 10);
    let offset = parseInt(req.query.offset, 10);

    if (isNaN(limit) || limit <= 0) limit = 0;
    if (isNaN(offset) || offset < 0) offset = 0;
    if (limit > 500) limit = 500;

    try {
      const baseSelect = 'SELECT item, nombre, descripcion FROM catalogo_insumos';
      const where = q ? ' WHERE CAST(item AS CHAR) LIKE ? OR LOWER(nombre) LIKE ?' : '';
      const order = ' ORDER BY item DESC';

      if (limit > 0) {
        const countQuery = `SELECT COUNT(*) as total FROM catalogo_insumos${where}`;
        let totalRows;

        if (q) {
          [totalRows] = await pool.query(countQuery, [likeParam(q), likeParam(q)]);
        } else {
          [totalRows] = await pool.query(countQuery);
        }

        const total = totalRows[0]?.total || 0;
        let rows;

        if (q) {
          [rows] = await pool.query(
            `${baseSelect}${where}${order} LIMIT ? OFFSET ?`,
            [likeParam(q), likeParam(q), limit, offset]
          );
        } else {
          [rows] = await pool.query(
            `${baseSelect}${order} LIMIT ? OFFSET ?`,
            [limit, offset]
          );
        }

        return res.json({ rows, total });
      } else {
        let rows;

        if (q) {
          [rows] = await pool.query(
            `${baseSelect}${where}${order}`,
            [likeParam(q), likeParam(q)]
          );
        } else {
          [rows] = await pool.query(`${baseSelect}${order}`);
        }

        return res.json(rows);
      }
    } catch (err) {
      console.error('Error GET /catalogo:', err);
      res.status(500).json({ message: 'Error buscando catálogo' });
    }
  },

  // GET /api/insumos/catalogo/:item
  getCatalogoItem: async (req, res) => {
    const { item } = req.params;
    try {
      const [rows] = await pool.query(
        'SELECT item, nombre, descripcion FROM catalogo_insumos WHERE CAST(item AS UNSIGNED) = CAST(? AS UNSIGNED)',
        [item]
      );
      if (!rows.length) return res.status(404).json({ message: 'No encontrado' });
      res.json(rows[0]);
    } catch (err) {
      console.error('Error GET /catalogo/:item:', err);
      res.status(500).json({ message: 'Error obteniendo catálogo' });
    }
  },

  // GET /api/insumos/catalogo/:item/imagen
  getCatalogoItemImagen: async (req, res) => {
    const { item } = req.params;
    try {
      const [rows] = await pool.query('SELECT imagen FROM catalogo_insumos WHERE CAST(item AS UNSIGNED) = CAST(? AS UNSIGNED)', [item]);
      if (!rows.length) return res.status(404).send('No encontrado');
      const img = rows[0]?.imagen;
      if (!img) return res.status(204).end(); // sin contenido
      res.setHeader('Content-Type', 'image/jpeg');
      res.send(img);
    } catch (err) {
      console.error('Error GET /catalogo/:item/imagen:', err);
      res.status(500).send('Error obteniendo imagen');
    }
  },

  // POST /api/insumos/catalogo (multipart) - item requerido (sin AUTO_INCREMENT)
  createCatalogo: async (req, res) => {
    const { item, nombre, descripcion } = req.body || {};
    const imagenBuffer = req.file?.buffer || null;

    if (!item || !nombre) {
      return res.status(400).json({ message: 'Item y nombre son requeridos' });
    }
    const itemNum = parseInt(item, 10);
    if (Number.isNaN(itemNum)) {
      return res.status(400).json({ message: 'El item debe ser numérico' });
    }

    try {
      await pool.query(
        'INSERT INTO catalogo_insumos (item, nombre, descripcion, imagen) VALUES (?, ?, ?, ?)',
        [itemNum, nombre, descripcion || null, imagenBuffer]
      );

      // REGISTRO DE LOG - Con req.user.id
      if (req.user && req.user.id) {
        const fecha = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/Bogota',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date());
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha) VALUES (?, ?, ?, ?)',
          [req.user.id, 'CREAR', 'CATALOGO_INSUMOS', fecha]
        );
      }

      return res.status(201).json({ item: itemNum, nombre, descripcion: descripcion || null });
    } catch (err) {
      if (err && (err.code === 'ER_DATA_TOO_LONG' || err.errno === 1406)) {
        return res.status(413).json({ message: 'Imagen demasiado grande para la columna. Aumenta el tipo a MEDIUMBLOB o reduce el tamaño (<5MB).' });
      }
      if (err && err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'El item ya existe en catálogo' });
      }
      console.error('Error POST /catalogo:', err);
      res.status(500).json({ message: 'Error creando catálogo' });
    }
  },

  // PUT /api/insumos/catalogo/:item (multipart opcional 'imagen')
  updateCatalogo: async (req, res) => {
    const { item } = req.params;
    const { nombre, descripcion } = req.body || {};
    const imagenBuffer = req.file?.buffer;

    try {
      let query = 'UPDATE catalogo_insumos SET nombre = ?, descripcion = ?';
      const params = [nombre || null, descripcion || null];
      if (imagenBuffer) {
        query += ', imagen = ?';
        params.push(imagenBuffer);
      }
      query += ' WHERE CAST(item AS UNSIGNED) = CAST(? AS UNSIGNED)';
      params.push(item);

      const [result] = await pool.query(query, params);
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'No encontrado' });
      }

      // REGISTRO DE LOG - Con req.user.id
      if (req.user && req.user.id) {
        const fecha = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/Bogota',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date());
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha) VALUES (?, ?, ?, ?)',
          [req.user.id, 'ACTUALIZAR', 'CATALOGO_INSUMOS', fecha]
        );
      }

      res.json({ item, nombre: nombre || null, descripcion: descripcion || null });
    } catch (err) {
      if (err && (err.code === 'ER_DATA_TOO_LONG' || err.errno === 1406)) {
        return res.status(413).json({ message: 'Imagen demasiado grande para la columna. Aumenta el tipo a MEDIUMBLOB o reduce el tamaño (<5MB).' });
      }
      console.error('Error PUT /catalogo/:item:', err);
      res.status(500).json({ message: 'Error actualizando catálogo' });
    }
  },

  // DELETE /api/insumos/catalogo/:item
  deleteCatalogo: async (req, res) => {
    const { item } = req.params;
    try {
      // Permisos: solo Admin/Superadmin
      if (req.user && req.user.rol !== 'Administrador' && req.user.rol !== 'Superadmin') {
        return res.status(403).json({ message: 'No tienes permisos para eliminar. Solo administradores.' });
      }
      // Pre-check: verificar existencia por equivalencia numérica (soporta '001' vs 1)
      const [existRows] = await pool.query(
        'SELECT COUNT(*) AS cnt FROM catalogo_insumos WHERE CAST(item AS UNSIGNED) = CAST(? AS UNSIGNED)',
        [item]
      );
      const exists = (existRows && existRows[0] && Number(existRows[0].cnt)) || 0;
      console.log('[PRECHECK DELETE catalogo_insumos] item =', item, 'exists =', exists);
      if (!exists) return res.status(404).json({ message: `No encontrado en catálogo (item: ${item})` });

      // Borrar todos los registros que coincidan por equivalencia numérica
      const [result] = await pool.query(
        'DELETE FROM catalogo_insumos WHERE CAST(item AS UNSIGNED) = CAST(? AS UNSIGNED)',
        [item]
      );
      console.log('[DELETE catalogo_insumos] item =', item, 'affectedRows =', result.affectedRows);
      if (result.affectedRows === 0) return res.status(404).json({ message: 'No encontrado' });
      res.json({ deleted: result.affectedRows, message: 'Item de catálogo eliminado correctamente' });
    } catch (err) {
      // Manejar error por restricción de llave foránea (hay insumos usando este item)
      if (err && (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED' || err.errno === 1451)) {
        return res.status(409).json({ message: 'No se puede eliminar: existen insumos que usan este item de catálogo.' });
      }
      console.error('Error DELETE /catalogo/:item (insumos):', err);
      res.status(500).json({ message: 'Error eliminando item de catálogo' });
    }
  },

  // ========== INSUMOS (CRUD) ==========

  // GET /api/insumos?q=&limit=
  getInsumos: async (req, res) => {
    const q = (req.query.q || '').trim().toLowerCase();
    let limit = parseInt(req.query.limit, 10);

    if (isNaN(limit) || limit <= 0) limit = 0;
    if (limit > 500) limit = 500;

    try {
      if (!q) {
        if (limit > 0) {
          const [rows] = await pool.query(
            'SELECT * FROM insumos ORDER BY id DESC LIMIT ?',
            [limit]
          );
          return res.json(rows);
        } else {
          const [rows] = await pool.query('SELECT * FROM insumos ORDER BY id DESC');
          return res.json(rows);
        }
      }

      const searchQuery = `
        SELECT * FROM insumos
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
        const [rows] = await pool.query(
          searchQuery,
          [likeParam(q), likeParam(q), likeParam(q)]
        );
        return res.json(rows);
      }
    } catch (err) {
      console.error('Error GET / (insumos):', err);
      res.status(500).json({ message: 'Error listando insumos' });
    }
  },

  // GET /api/insumos/:id
  getInsumoById: async (req, res) => {
    const { id } = req.params;
    try {
      const [rows] = await pool.query('SELECT * FROM insumos WHERE id = ?', [id]);
      if (!rows.length) {
        return res.status(404).json({ message: 'No encontrado' });
      }
      res.json(rows[0]);
    } catch (err) {
      console.error('Error GET /:id:', err);
      res.status(500).json({ message: 'Error obteniendo insumo' });
    }
  },

  // POST /api/insumos
  createInsumo: async (req, res) => {
    let {
      item_catalogo,
      nombre,
      cantidad_adquirida,
      cantidad_existente,
      presentacion,
      marca,
      referencia,
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
        `INSERT INTO insumos (
          item_catalogo, nombre, cantidad_adquirida, cantidad_existente, 
          presentacion, marca, referencia, descripcion, fecha_adquisicion, ubicacion, observaciones
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item_catalogo,
          nombre,
          cantidad_adquirida,
          cantidad_existente,
          presentacion || null,
          marca || null,
          referencia || null,
          descripcion || null,
          fecha_adquisicion || null,
          ubicacion || null,
          observaciones || null
        ]
      );

      const id = result.insertId;

      // REGISTRO DE LOG - Con req.user.id
      if (req.user && req.user.id) {
        const fecha = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/Bogota',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date());
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha) VALUES (?, ?, ?, ?)',
          [req.user.id, 'CREAR', 'INSUMOS', fecha]
        );

        // REGISTRO DE MOVIMIENTO
        await pool.query(
          'INSERT INTO movimientos_inventario (producto_tipo, producto_referencia, usuario_id, tipo_movimiento, fecha) VALUES (?, ?, ?, ?, ?)',
          ['INSUMO', id.toString(), req.user.id, 'ENTRADA', fecha]
        );
      }

      res.status(201).json({ message: 'Insumo creado correctamente' });
    } catch (err) {
      if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.errno === 1452) {
        return res.status(400).json({ message: 'El item de catálogo especificado no existe.' });
      }
      if (err.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
        return res.status(400).json({ message: 'Valor inválido para uno de los campos.' });
      }
      console.error('Error POST / (insumos):', err);
      res.status(500).json({ message: 'Error creando insumo', error: err.message });
    }
  },

  // PUT /api/insumos/:id
  updateInsumo: async (req, res) => {
    const { id } = req.params;
    const {
      item_catalogo,
      nombre,
      cantidad_adquirida,
      cantidad_existente,
      presentacion,
      marca,
      referencia,
      descripcion,
      fecha_adquisicion,
      ubicacion,
      observaciones
    } = req.body || {};

    try {
      // 1. Obtener datos actuales
      const [rows] = await pool.query('SELECT * FROM insumos WHERE id = ?', [id]);
      if (rows.length === 0) {
        return res.status(404).json({ message: 'No encontrado' });
      }
      const datosActuales = rows[0];

      // 2. Preparar nuevos datos
      const datosNuevos = {
        item_catalogo,
        nombre,
        cantidad_adquirida,
        cantidad_existente,
        presentacion: presentacion || null,
        marca: marca || null,
        referencia: referencia || null,
        descripcion: descripcion || null,
        fecha_adquisicion: fecha_adquisicion || null,
        ubicacion: ubicacion || null,
        observaciones: observaciones || null
      };

      // 3. Ejecutar Update
      await pool.query(
        `UPDATE insumos SET
          item_catalogo = ?, nombre = ?, cantidad_adquirida = ?, cantidad_existente = ?,
          presentacion = ?, marca = ?, referencia = ?, descripcion = ?, fecha_adquisicion = ?,
          ubicacion = ?, observaciones = ?
        WHERE id = ?`,
        [
          datosNuevos.item_catalogo,
          datosNuevos.nombre,
          datosNuevos.cantidad_adquirida,
          datosNuevos.cantidad_existente,
          datosNuevos.presentacion,
          datosNuevos.marca,
          datosNuevos.referencia,
          datosNuevos.descripcion,
          datosNuevos.fecha_adquisicion,
          datosNuevos.ubicacion,
          datosNuevos.observaciones,
          id
        ]
      );

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

      // Enriquecer IDs con nombres
      if (cambios.item_catalogo) {
        const oldId = datosActuales.item_catalogo;
        const newId = datosNuevos.item_catalogo;
        const ids = [oldId, newId].filter(id => id != null);
        
        if (ids.length > 0) {
            try {
                const [rows] = await pool.query('SELECT item, nombre FROM catalogo_insumos WHERE item IN (?)', [ids]);
                const nameMap = {};
                rows.forEach(r => nameMap[r.item] = r.nombre);

                cambios['item_catalogo'] = {
                    anterior: (oldId ? (nameMap[oldId] || oldId) : '(vacío)'),
                    nuevo: (newId ? (nameMap[newId] || newId) : '(vacío)')
                };
            } catch (errName) {
                console.error('Error obteniendo nombres para log insumos:', errName);
            }
        }
      }

      if (Object.keys(cambios).length > 0) {
        detallesCambios = JSON.stringify(cambios);
      }

      // REGISTRO DE LOG
      if (req.user && req.user.id) {
        const fecha = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/Bogota',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date());

        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, detalle) VALUES (?, ?, ?, ?, ?)',
          [req.user.id, 'ACTUALIZAR', 'INSUMOS', fecha, detallesCambios]
        );
      }

      res.json({ message: 'Insumo actualizado correctamente' });
    } catch (err) {
      console.error('Error PUT /:id (insumos):', err);
      res.status(500).json({ message: 'Error actualizando insumo' });
    }
  },

  // DELETE /api/insumos/:id
  deleteInsumo: async (req, res) => {
    const { id } = req.params;

    try {
      // VERIFICACIÓN POR ROL - Con req.user.rol
      if (req.user && req.user.rol !== 'Administrador' && req.user.rol !== 'Superadmin') {
        return res.status(403).json({
          message: 'No tienes permisos para eliminar insumos. Solo administradores pueden realizar esta acción.'
        });
      }

      const [result] = await pool.query('DELETE FROM insumos WHERE id = ?', [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'No encontrado' });
      }

      // REGISTRO DE LOG - Con req.user.id
      if (req.user && req.user.id) {
        const fecha = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/Bogota',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date());
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha) VALUES (?, ?, ?, ?)',
          [req.user.id, 'ELIMINAR', 'INSUMOS', fecha]
        );
      }

      res.json({ message: 'Insumo eliminado correctamente' });
    } catch (err) {
      console.error('Error DELETE /:id (insumos):', err);
      res.status(500).json({ message: 'Error eliminando insumo' });
    }
  },

  // PATCH /api/insumos/:id/existencias
  ajustarExistencias: async (req, res) => {
    const { id } = req.params;
    const { delta, cantidad } = req.body || {};

    try {
      if (typeof cantidad !== 'undefined') {
        const c = Number(cantidad);
        if (!Number.isFinite(c) || c < 0) {
          return res.status(400).json({ message: 'Cantidad inválida. Debe ser >= 0' });
        }
        const [result] = await pool.query(
          'UPDATE insumos SET cantidad_existente = ? WHERE id = ?', [c, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'No encontrado' });
      } else if (typeof delta !== 'undefined') {
        const d = Number(delta);
        if (!Number.isFinite(d) || d === 0) {
          return res.status(400).json({ message: 'Delta inválido. Debe ser distinto de 0' });
        }
        const [result] = await pool.query(
          'UPDATE insumos SET cantidad_existente = GREATEST(0, cantidad_existente + ?) WHERE id = ?', [d, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'No encontrado' });
      } else {
        return res.status(400).json({ message: 'Provee cantidad (>=0) o delta (!=0)' });
      }

      const [rows] = await pool.query('SELECT cantidad_existente FROM insumos WHERE id = ?', [id]);
      const nuevo = rows[0]?.cantidad_existente;

      // REGISTRO DE LOG - Con req.user.id
      if (req.user && req.user.id) {
        const fecha = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/Bogota',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date());
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha) VALUES (?, ?, ?, ?)',
          [req.user.id, 'AJUSTAR_EXISTENCIAS', 'INSUMOS', fecha]
        );

        // REGISTRO DE MOVIMIENTO
        await pool.query(
          'INSERT INTO movimientos_inventario (producto_tipo, producto_referencia, usuario_id, tipo_movimiento, fecha) VALUES (?, ?, ?, ?, ?)',
          ['INSUMO', id.toString(), req.user.id, 'AJUSTE', fecha]
        );
      }

      return res.json({ id, cantidad_existente: nuevo });
    } catch (err) {
      console.error('Error PATCH /:id/existencias (insumos):', err);
      res.status(500).json({ message: 'Error ajustando existencias' });
    }
  }
};

module.exports = insumosController;