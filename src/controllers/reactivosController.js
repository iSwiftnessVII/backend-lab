const pool = require('../config/db');

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
      res.json({ codigo, nombre: nombre || null, tipo_reactivo: tipo_reactivo || null, clasificacion_sga: clasificacion_sga || null, descripcion: descripcion || null });
    } catch (err) {
      console.error('Error PUT /catalogo/:codigo:', err);
      res.status(500).json({ message: 'Error actualizando catálogo' });
    }
  },

    deleteCatalogo: async (req, res) => {
    // VERIFICACIÓN POR ROL - Solo Administrador y Superadmin pueden eliminar
    if (req.user.rol !== 'Administrador' && req.user.rol !== 'Superadmin') {
      return res.status(403).json({ 
        message: 'No tienes permisos para eliminar del catálogo. Solo administradores pueden realizar esta acción.' 
      });
    }

    const { codigo } = req.params;
    try {
      const [result] = await pool.query('DELETE FROM catalogo_reactivos WHERE codigo = ?', [codigo]);
      if (result.affectedRows === 0) return res.status(404).json({ message: 'No encontrado' });
      res.json({ message: 'Eliminado del catálogo' });
    } catch (err) {
      console.error('Error DELETE /catalogo/:codigo:', err);
      res.status(500).json({ message: 'Error eliminando del catálogo' });
    }
  },

  // --- PDFs: Hoja de Seguridad ---

  // GET availability
  getHojaSeguridad: async (req, res) => {
    const { codigo } = req.params;
    try {
      const [rows] = await pool.query('SELECT id FROM hoja_seguridad WHERE codigo = ? AND contenido_pdf IS NOT NULL', [codigo]);
      if (!rows.length) return res.status(404).json({ message: 'No encontrada' });
      return res.json({ url: `catalogo/${encodeURIComponent(codigo)}/hoja-seguridad/view` });
    } catch (err) {
      console.error('Error GET /hoja-seguridad:', err);
      res.status(500).json({ message: 'Error consultando hoja de seguridad' });
    }
  },

  // VIEW stream
  viewHojaSeguridad: async (req, res) => {
    const { codigo } = req.params;
    try {
      const [rows] = await pool.query('SELECT contenido_pdf FROM hoja_seguridad WHERE codigo = ?', [codigo]);
      if (!rows.length || !rows[0].contenido_pdf) return res.status(404).type('text/plain').send('PDF no encontrado');
      res.setHeader('Content-Type', 'application/pdf');
      res.send(rows[0].contenido_pdf);
    } catch (err) {
      console.error('Error VIEW /hoja-seguridad:', err);
      res.status(500).type('text/plain').send('Error obteniendo PDF');
    }
  },

  // POST upload
  uploadHojaSeguridad: async (req, res) => {
    const { codigo } = req.params;
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
        `INSERT INTO hoja_seguridad (codigo, hoja_seguridad, contenido_pdf)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE hoja_seguridad = VALUES(hoja_seguridad), contenido_pdf = VALUES(contenido_pdf), fecha_subida = CURRENT_TIMESTAMP`,
        [codigo, file.originalname || 'hoja_seguridad.pdf', file.buffer]
      );
      res.status(201).json({ url: `catalogo/${encodeURIComponent(codigo)}/hoja-seguridad/view` });
    } catch (err) {
      console.error('Error POST /hoja-seguridad:', err);
      res.status(500).json({ message: 'Error subiendo PDF' });
    }
  },

  // DELETE
   deleteHojaSeguridad: async (req, res) => {
    // VERIFICACIÓN POR ROL - Solo Administrador y Superadmin pueden eliminar
    if (req.user.rol !== 'Administrador' && req.user.rol !== 'Superadmin') {
      return res.status(403).json({ 
        message: 'No tienes permisos para eliminar hojas de seguridad. Solo administradores pueden realizar esta acción.' 
      });
    }

    const { codigo } = req.params;
    try {
      const [result] = await pool.query('DELETE FROM hoja_seguridad WHERE codigo = ?', [codigo]);
      if (result.affectedRows === 0) return res.status(404).json({ message: 'No encontrada' });
      res.json({ message: 'Eliminada' });
    } catch (err) {
      console.error('Error DELETE /hoja-seguridad:', err);
      res.status(500).json({ message: 'Error eliminando PDF' });
    }
  },

  // --- PDFs: Certificado de análisis ---

  getCertAnalisis: async (req, res) => {
    const { codigo } = req.params;
    try {
      const [rows] = await pool.query('SELECT id FROM cert_analisis WHERE codigo = ? AND contenido_pdf IS NOT NULL', [codigo]);
      if (!rows.length) return res.status(404).json({ message: 'No encontrado' });
      return res.json({ url: `catalogo/${encodeURIComponent(codigo)}/cert-analisis/view` });
    } catch (err) {
      console.error('Error GET /cert-analisis:', err);
      res.status(500).json({ message: 'Error consultando certificado' });
    }
  },

  viewCertAnalisis: async (req, res) => {
    const { codigo } = req.params;
    try {
      const [rows] = await pool.query('SELECT contenido_pdf FROM cert_analisis WHERE codigo = ?', [codigo]);
      if (!rows.length || !rows[0].contenido_pdf) return res.status(404).type('text/plain').send('PDF no encontrado');
      res.setHeader('Content-Type', 'application/pdf');
      res.send(rows[0].contenido_pdf);
    } catch (err) {
      console.error('Error VIEW /cert-analisis:', err);
      res.status(500).type('text/plain').send('Error obteniendo PDF');
    }
  },

  uploadCertAnalisis: async (req, res) => {
    const { codigo } = req.params;
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
        `INSERT INTO cert_analisis (codigo, certificado_analisis, contenido_pdf)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE certificado_analisis = VALUES(certificado_analisis), contenido_pdf = VALUES(contenido_pdf), fecha_subida = CURRENT_TIMESTAMP`,
        [codigo, file.originalname || 'cert_analisis.pdf', file.buffer]
      );
      res.status(201).json({ url: `catalogo/${encodeURIComponent(codigo)}/cert-analisis/view` });
    } catch (err) {
      console.error('Error POST /cert-analisis:', err);
      res.status(500).json({ message: 'Error subiendo PDF' });
    }
  },

  deleteCertAnalisis: async (req, res) => {
    // VERIFICACIÓN POR ROL - Solo Administrador y Superadmin pueden eliminar
    if (req.user.rol !== 'Administrador' && req.user.rol !== 'Superadmin') {
      return res.status(403).json({ 
        message: 'No tienes permisos para eliminar certificados de análisis. Solo administradores pueden realizar esta acción.' 
      });
    }

    const { codigo } = req.params;
    try {
      const [result] = await pool.query('DELETE FROM cert_analisis WHERE codigo = ?', [codigo]);
      if (result.affectedRows === 0) return res.status(404).json({ message: 'No encontrado' });
      res.json({ message: 'Eliminado' });
    } catch (err) {
      console.error('Error DELETE /cert-analisis:', err);
      res.status(500).json({ message: 'Error eliminando PDF' });
    }
  },

  // --- Reactivos (CRUD) ---

  // GET /api/reactivos?q=
  getReactivos: async (req, res) => {
    const q = (req.query.q || '').trim().toLowerCase();
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit <= 0) limit = 0;
    if (limit > 500) limit = 500;
    
    try {
      if (!q) {
        if (limit > 0) {
          const [rows] = await pool.query('SELECT * FROM reactivos ORDER BY fecha_creacion DESC LIMIT ?', [limit]);
          return res.json(rows);
        } else {
          const [rows] = await pool.query('SELECT * FROM reactivos ORDER BY fecha_creacion DESC');
          return res.json(rows);
        }
      }
      
      if (limit > 0) {
        const [rows] = await pool.query(
          `SELECT * FROM reactivos
           WHERE LOWER(lote) LIKE ? OR LOWER(codigo) LIKE ? OR LOWER(nombre) LIKE ? OR LOWER(marca) LIKE ?
           ORDER BY fecha_creacion DESC LIMIT ?`,
          [likeParam(q), likeParam(q), likeParam(q), likeParam(q), limit]
        );
        return res.json(rows);
      } else {
        const [rows] = await pool.query(
          `SELECT * FROM reactivos
           WHERE LOWER(lote) LIKE ? OR LOWER(codigo) LIKE ? OR LOWER(nombre) LIKE ? OR LOWER(marca) LIKE ?
           ORDER BY fecha_creacion DESC`,
          [likeParam(q), likeParam(q), likeParam(q), likeParam(q)]
        );
        return res.json(rows);
      }
    } catch (err) {
      console.error('Error GET / (reactivos):', err);
      res.status(500).json({ message: 'Error listando reactivos' });
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
      res.json({ message: 'Actualizado' });
    } catch (err) {
      console.error('Error PUT /:lote (reactivos):', err);
      res.status(500).json({ message: 'Error actualizando reactivo' });
    }
  },

  // DELETE /api/reactivos/:lote
    deleteReactivo: async (req, res) => {
    // VERIFICACIÓN POR ROL - Solo Administrador y Superadmin pueden eliminar
    if (req.user.rol !== 'Administrador' && req.user.rol !== 'Superadmin') {
      return res.status(403).json({ 
        message: 'No tienes permisos para eliminar reactivos. Solo administradores pueden realizar esta acción.' 
      });
    }

    const { lote } = req.params;
    try {
      const [result] = await pool.query('DELETE FROM reactivos WHERE lote = ?', [lote]);
      if (result.affectedRows === 0) return res.status(404).json({ message: 'No encontrado' });
      res.json({ message: 'Eliminado' });
    } catch (err) {
      console.error('Error DELETE /:lote (reactivos):', err);
      res.status(500).json({ message: 'Error eliminando reactivo' });
    }
  }
};


module.exports = reactivosController;