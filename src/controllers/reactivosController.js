const pool = require('../config/db');
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (_) { nodemailer = null; }

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
      const baseSelect = 'SELECT codigo, nombre, tipo_reactivo, clasificacion_sga, descripcion FROM catalogo_reactivos';
      const where = q ? ' WHERE LOWER(codigo) LIKE ? OR LOWER(nombre) LIKE ?' : '';
      const order = ' ORDER BY codigo';
      
      if (limit > 0) {
        const countQuery = `SELECT COUNT(*) as total FROM catalogo_reactivos${q ? ' WHERE LOWER(codigo) LIKE ? OR LOWER(nombre) LIKE ?' : ''}`;
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
      console.error('Error GET /catalogo:', err);
      res.status(500).json({ message: 'Error buscando catálogo' });
    }
  },

  // GET /api/reactivos/catalogo/:codigo
  getCatalogoItem: async (req, res) => {
    const { codigo } = req.params;
    try {
      const [rows] = await pool.query('SELECT codigo, nombre, tipo_reactivo, clasificacion_sga, descripcion FROM catalogo_reactivos WHERE codigo = ?', [codigo]);
      if (!rows.length) return res.status(404).json({ message: 'No encontrado' });
      res.json(rows[0]);
    } catch (err) {
      console.error('Error GET /catalogo/:codigo:', err);
      res.status(500).json({ message: 'Error obteniendo catálogo' });
    }
  },

  // POST /api/reactivos/catalogo
  createCatalogo: async (req, res) => {
    const { codigo, nombre, tipo_reactivo, clasificacion_sga, descripcion } = req.body || {};
    if (!codigo || !nombre || !tipo_reactivo || !clasificacion_sga) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }
    try {
      await pool.query(
        'INSERT INTO catalogo_reactivos (codigo, nombre, tipo_reactivo, clasificacion_sga, descripcion) VALUES (?, ?, ?, ?, ?)',
        [codigo, nombre, tipo_reactivo, clasificacion_sga, descripcion || null]
      );
      if (req.user && req.user.id) {
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
          [req.user.id, 'CREAR', 'CATALOGO_REACTIVOS']
        );
      }
      res.status(201).json({ codigo, nombre, tipo_reactivo, clasificacion_sga, descripcion: descripcion || null });
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'Código ya existe en catálogo' });
      }
      console.error('Error POST /catalogo:', err);
      res.status(500).json({ message: 'Error creando catálogo' });
    }
  },

  // PUT /api/reactivos/catalogo/:codigo
  updateCatalogo: async (req, res) => {
    const { codigo } = req.params;
    const { nombre, tipo_reactivo, clasificacion_sga, descripcion } = req.body || {};
    try {
      const [result] = await pool.query(
        'UPDATE catalogo_reactivos SET nombre = ?, tipo_reactivo = ?, clasificacion_sga = ?, descripcion = ? WHERE codigo = ?',
        [nombre || null, tipo_reactivo || null, clasificacion_sga || null, descripcion || null, codigo]
      );
      if (result.affectedRows === 0) return res.status(404).json({ message: 'No encontrado' });
      if (req.user && req.user.id) {
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
          [req.user.id, 'ACTUALIZAR', 'CATALOGO_REACTIVOS']
        );
      }
      res.json({ codigo, nombre: nombre || null, tipo_reactivo: tipo_reactivo || null, clasificacion_sga: clasificacion_sga || null, descripcion: descripcion || null });
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
      const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM reactivos WHERE codigo = ?', [codigo]);
      const cnt = rows?.[0]?.cnt || 0;
      if (cnt > 0) {
        return res.status(409).json({
          message: `No se puede eliminar del catálogo: existen ${cnt} reactivo(s) que referencian este código`,
          codigo,
          dependientes: cnt
        });
      }

      const [result] = await pool.query('DELETE FROM catalogo_reactivos WHERE codigo = ?', [codigo]);
      if (result.affectedRows === 0) return res.status(404).json({ message: 'No encontrado' });

      // REGISTRO DE LOG - Solo si hay usuario autenticado
      if (req.user && req.user.id) {
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
          [req.user.id, 'ELIMINAR', 'CATALOGO_REACTIVOS']
        );
      }

      res.json({ message: 'Eliminado del catálogo' });
    } catch (err) {
      if (err && err.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(409).json({
          message: 'No se puede eliminar del catálogo: hay registros que dependen de este código',
          codigo
        });
      }
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
         WHERE r.codigo = ? AND hs.contenido_pdf IS NOT NULL
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
         WHERE r.codigo = ?
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
            await pool.query(
                'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
                [req.user.id, 'SUBIR_PDF', 'REACTIVOS']
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
                'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
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
         WHERE r.codigo = ? AND ca.contenido_pdf IS NOT NULL
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
         WHERE r.codigo = ?
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
        'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
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
      await pool.query(
        'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
        [req.user.id, 'ELIMINAR_PDF', 'REACTIVOS']
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
      // Base SELECT y WHERE dinámico
      const baseSelect = 'SELECT * FROM reactivos';
      const whereClause = q ? ` WHERE LOWER(lote) LIKE ? OR LOWER(codigo) LIKE ? OR LOWER(nombre) LIKE ? OR LOWER(marca) LIKE ?` : '';
      const orderClause = ' ORDER BY fecha_creacion DESC';

      // Sin límite: devolver array completo (comportamiento existente)
      if (limit === 0) {
        if (!q) {
          const [rows] = await pool.query(baseSelect + orderClause);
          return res.json(rows);
        } else {
          const params = [likeParam(q), likeParam(q), likeParam(q), likeParam(q)];
          const [rows] = await pool.query(baseSelect + whereClause + orderClause, params);
            return res.json(rows);
        }
      }

      // Con límite: devolver objeto { rows, total }
      let total = 0;
      if (!q) {
        const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM reactivos');
        total = countRows[0]?.total || 0;
        const [rows] = await pool.query(baseSelect + orderClause + ' LIMIT ? OFFSET ?', [limit, offset]);
        return res.json({ rows, total });
      } else {
        const countSql = 'SELECT COUNT(*) AS total FROM reactivos' + whereClause;
        const params = [likeParam(q), likeParam(q), likeParam(q), likeParam(q)];
        const [countRows] = await pool.query(countSql, params);
        total = countRows[0]?.total || 0;
        const [rows] = await pool.query(baseSelect + whereClause + orderClause + ' LIMIT ? OFFSET ?', [...params, limit, offset]);
        return res.json({ rows, total });
      }
    } catch (err) {
      console.error('Error GET / (reactivos):', err);
      res.status(500).json({ message: 'Error listando reactivos' });
    }
  },

  // GET /api/reactivos/total - devuelve solo el total de filas (uso liviano para fallback en frontend)
  getReactivosTotal: async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT COUNT(*) AS total FROM reactivos');
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
      const [rows] = await pool.query('SELECT * FROM reactivos WHERE lote = ?', [lote]);
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
        cantidad_total = presentacion * presentacion_cant;
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
                'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
                [req.user.id, 'CREAR', 'REACTIVOS']
            );

            // REGISTRO DE MOVIMIENTO
            await pool.query(
                'INSERT INTO movimientos_inventario (producto_tipo, producto_referencia, usuario_id, tipo_movimiento) VALUES (?, ?, ?, ?)',
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
      const codigo = trimStr(r.codigo);
      const nombre = trimStr(r.nombre);
      const presentacion = numOrNull(r.presentacion);
      const presentacion_cant = numOrNull(r.presentacion_cant);
      let cantidad_total = r.cantidad_total != null ? numOrNull(r.cantidad_total) : null;
      if (cantidad_total == null && presentacion != null && presentacion_cant != null) {
        cantidad_total = presentacion * presentacion_cant;
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

      const [result] = await pool.query(
        `UPDATE reactivos SET
          codigo = ?, nombre = ?, marca = ?, referencia = ?, cas = ?, presentacion = ?, presentacion_cant = ?, cantidad_total = ?,
          fecha_adquisicion = ?, fecha_vencimiento = ?, observaciones = ?, tipo_id = ?, clasificacion_id = ?, unidad_id = ?, estado_id = ?,
          almacenamiento_id = ?, tipo_recipiente_id = ?
        WHERE lote = ?`,
        [
          codigo, nombre, marca, referencia, cas, presentacion, presentacion_cant, cantidad_total,
          fecha_adquisicion, fecha_vencimiento, observaciones, tipo_id, clasificacion_id, unidad_id, estado_id,
          almacenamiento_id, tipo_recipiente_id, lote
        ]
      );
      if (result.affectedRows === 0) return res.status(404).json({ message: 'No encontrado' });

      // REGISTRO DE LOG - MODIFICADO
        if (req.user && req.user.id) {
            await pool.query(
                'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
                [req.user.id, 'ACTUALIZAR', 'REACTIVOS']
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


  // Exportación Excel de reactivos
  const ExcelJS = require('exceljs');
  reactivosController.exportReactivosExcel = async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM reactivos ORDER BY fecha_creacion DESC');
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Reactivos');

      if (!rows.length) {
        sheet.addRow(['No hay reactivos']);
      } else {
        // Cabeceras dinámicas basadas en keys del primer registro
        const headers = Object.keys(rows[0]);
        sheet.addRow(headers);
        for (const r of rows) {
          sheet.addRow(headers.map(h => r[h]));
        }
        // Estilos simples
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B8B5' } };
          cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        });
        sheet.columns.forEach(col => { col.width = Math.min(40, Math.max(12, col.header ? String(col.header).length + 2 : 15)); });
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const filename = 'reactivos_' + new Date().toISOString().slice(0,19).replace(/[:T]/g,'-') + '.xlsx';
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      console.error('Error exportando Excel reactivos:', err);
      res.status(500).json({ message: 'Error exportando reactivos a Excel' });
    }
  };

    const { lote } = req.params;
    try {
        const [result] = await pool.query('DELETE FROM reactivos WHERE lote = ?', [lote]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'No encontrado' });

        // REGISTRO DE LOG - MODIFICADO
        if (req.user && req.user.id) {
            await pool.query(
                'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
                [req.user.id, 'ELIMINAR', 'REACTIVOS']
            );
        }

        res.json({ message: 'Eliminado' });
    } catch (err) {
        console.error('Error DELETE /:lote (reactivos):', err);
        res.status(500).json({ message: 'Error eliminando reactivo' });
    }
  },

  // Exportación Excel de reactivos (propiedad del controlador)
  exportReactivosExcel: async (req, res) => {
    try {
      const ExcelJS = require('exceljs');

      // Datos base de reactivos
      const [rows] = await pool.query('SELECT * FROM reactivos ORDER BY fecha_creacion DESC');

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

// Job: enviar notificaciones de vencimiento (ejecutar diariamente)
reactivosController.ejecutarNotificacionesVencimiento = async () => {
  try {
    await ensureSuscripcionesTable();
    const [subs] = await pool.query('SELECT email FROM suscripciones_reactivos WHERE activo = 1');
    const emails = subs.map(s => s.email).filter(Boolean);
    if (!emails.length) return;

    const [rows] = await pool.query('SELECT lote, codigo, nombre, fecha_vencimiento FROM reactivos WHERE fecha_vencimiento IS NOT NULL');
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
    }

    // Construir contenido si hay items
    const hayItems = thresholds.some(t => grupos[t.days].length);
    if (!hayItems) return;

    let text = 'Alertas de vencimiento de reactivos:\n\n';
    let html = '<h3>Alertas de vencimiento de reactivos</h3>';
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
  } catch (err) {
    console.error('Error ejecutarNotificacionesVencimiento:', err);
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
      `INSERT INTO catalogo_reactivos (codigo, nombre, tipo_reactivo, clasificacion_sga, descripcion)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)`,
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
        almacenamiento_id, tipo_recipiente_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
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
