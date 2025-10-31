const pool = require('../config/db');

const solicitudesController = {
  // ---------- CLIENTES CRUD ----------
  
  // List clientes
  getClientes: async (req, res) => {
    const q = req.query.q || '';
    try {
      const [rows] = await pool.query(
        `SELECT id_cliente, nombre_solicitante, numero_identificacion, correo_electronico, ciudad, activo
         FROM clientes
         WHERE nombre_solicitante LIKE ? OR correo_electronico LIKE ?
         ORDER BY id_cliente DESC
         LIMIT 200`,
        [`%${q}%`, `%${q}%`]
      );
      res.json(rows);
    } catch (err) {
      console.error('GET /clientes error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // Create cliente
  createCliente: async (req, res) => {
    const body = req.body || {};
    const required = ['nombre_solicitante', 'tipo_identificacion', 'numero_identificacion'];
    for (const f of required) if (!body[f]) return res.status(400).json({ message: `Missing ${f}` });
    
    try {
      let numeroVal = body.numero || null;
      if (!numeroVal) {
        try {
          const [rmax] = await pool.query('SELECT MAX(numero) AS max FROM clientes');
          const maxNum = (rmax && rmax[0] && rmax[0].max) ? parseInt(rmax[0].max, 10) : 0;
          numeroVal = maxNum + 1;
        } catch (e) {
          numeroVal = 1;
        }
      }

      const fechaVinc = body.fecha_vinculacion || new Date().toISOString().slice(0,10);
      const tipoUsuarioVal = body.tipo_usuario || 'Persona Natural';
      const sexoVal = body.sexo || 'Otro';

      const [result] = await pool.query(
        `INSERT INTO clientes (numero, fecha_vinculacion, tipo_usuario, razon_social, nit, nombre_solicitante, tipo_identificacion, numero_identificacion, sexo, tipo_poblacion, direccion, ciudad, departamento, celular, telefono, correo_electronico, tipo_vinculacion, registro_realizado_por, observaciones)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          numeroVal,
          fechaVinc,
          tipoUsuarioVal,
          body.razon_social || null,
          body.nit || null,
          body.nombre_solicitante,
          body.tipo_identificacion,
          body.numero_identificacion,
          sexoVal,
          body.tipo_poblacion || null,
          body.direccion || null,
          body.ciudad || null,
          body.departamento || null,
          body.celular || null,
          body.telefono || null,
          body.correo_electronico || null,
          body.tipo_vinculacion || null,
          body.registro_realizado_por || null,
          body.observaciones || null
        ]
      );
      res.status(201).json({ id_cliente: result.insertId });
    } catch (err) {
      console.error('POST /clientes error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // Get single cliente
  getClienteById: async (req, res) => {
    const id = req.params.id;
    try {
      const [rows] = await pool.query('SELECT * FROM clientes WHERE id_cliente = ?', [id]);
      if (!rows.length) return res.status(404).json({ message: 'Not found' });
      res.json(rows[0]);
    } catch (err) {
      console.error('GET /clientes/:id error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // Update cliente
  updateCliente: async (req, res) => {
    const id = req.params.id;
    const body = req.body || {};
    try {
      const fields = [];
      const values = [];
      for (const k of Object.keys(body)) {
        fields.push(`${k} = ?`);
        values.push(body[k]);
      }
      if (!fields.length) return res.status(400).json({ message: 'No fields to update' });
      values.push(id);
      await pool.query(`UPDATE clientes SET ${fields.join(', ')} WHERE id_cliente = ?`, values);
      res.json({ updated: true });
    } catch (err) {
      console.error('PUT /clientes/:id error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // Delete cliente
  deleteCliente: async (req, res) => {
    // VERIFICACIÓN POR ROL - Solo Administrador y Superadmin pueden eliminar
    if (req.user.rol !== 'Administrador' && req.user.rol !== 'Superadmin') {
      return res.status(403).json({ 
        message: 'No tienes permisos para eliminar clientes. Solo administradores pueden realizar esta acción.' 
      });
    }

    const id = req.params.id;
    try {
      await pool.query('DELETE FROM clientes WHERE id_cliente = ?', [id]);
      res.json({ deleted: true });
    } catch (err) {
      console.error('DELETE /clientes/:id error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // ---------- SOLICITUDES CRUD ----------

  // List solicitudes
  getSolicitudes: async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT s.id_solicitud, s.numero_solicitud, s.codigo, s.fecha_solicitud, s.nombre_muestra_producto, s.cantidad_muestras_analizar,
                s.servicio_viable, s.genero_cotizacion, s.cliente_respondio_encuesta, s.numero_informe_resultados,
                u.id_cliente, u.nombre_solicitante, u.correo_electronico
         FROM Solicitudes s
         LEFT JOIN clientes u ON s.id_cliente = u.id_cliente
         ORDER BY s.id_solicitud DESC
         LIMIT 500`
      );
      res.json(rows);
    } catch (err) {
      console.error('GET /solicitudes error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // Create solicitud
  createSolicitud: async (req, res) => {
    const b = req.body || {};
    if (!b.id_cliente) return res.status(400).json({ message: 'Missing id_cliente' });
    
    try {
      let numeroSol = b.numero_solicitud || null;
      if (!numeroSol) {
        try {
          const [rmax] = await pool.query('SELECT MAX(numero_solicitud) AS max FROM Solicitudes');
          const maxNum = (rmax && rmax[0] && rmax[0].max) ? parseInt(rmax[0].max, 10) : 0;
          numeroSol = maxNum + 1;
        } catch (e) { numeroSol = 1; }
      }

      const [result] = await pool.query(
        `INSERT INTO Solicitudes (numero_solicitud, id_cliente, codigo, fecha_solicitud, nombre_muestra_producto, lote_producto, fecha_vencimiento_producto, tipo_muestra, condiciones_empaque, tipo_analisis_requerido, requiere_varios_analisis, cantidad_muestras_analizar, fecha_estimada_entrega_muestra, puede_suministrar_informacion_adicional, servicio_viable, genero_cotizacion, valor_cotizacion, fecha_envio_oferta, realizo_seguimiento_oferta, observacion_oferta, fecha_limite_entrega_resultados, numero_informe_resultados, fecha_envio_resultados, cliente_respondio_encuesta, solicito_nueva_encuesta, observaciones_generales, mes_solicitud)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          numeroSol,
          b.id_cliente,
          b.codigo || null,
          b.fecha_solicitud || null,
          b.nombre_muestra_producto || null,
          b.lote_producto || null,
          b.fecha_vencimiento_producto || null,
          b.tipo_muestra || null,
          b.condiciones_empaque || null,
          b.tipo_analisis_requerido || null,
          b.requiere_varios_analisis ? 1 : 0,
          b.cantidad_muestras_analizar || null,
          b.fecha_estimada_entrega_muestra || null,
          b.puede_suministrar_informacion_adicional ? 1 : 0,
          b.servicio_viable ? 1 : 0,
          b.genero_cotizacion ? 1 : 0,
          b.valor_cotizacion || null,
          b.fecha_envio_oferta || null,
          b.realizo_seguimiento_oferta ? 1 : 0,
          b.observacion_oferta || null,
          b.fecha_limite_entrega_resultados || null,
          b.numero_informe_resultados || null,
          b.fecha_envio_resultados || null,
          b.cliente_respondio_encuesta ? 1 : 0,
          b.solicito_nueva_encuesta ? 1 : 0,
          b.observaciones_generales || null,
          b.mes_solicitud || null
        ]
      );
      res.status(201).json({ id_solicitud: result.insertId });
    } catch (err) {
      console.error('POST /solicitudes error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // Get single solicitud with cliente
  getSolicitudById: async (req, res) => {
    const id = req.params.id;
    try {
      const [rows] = await pool.query(
        `SELECT s.*, u.nombre_solicitante, u.correo_electronico FROM Solicitudes s LEFT JOIN clientes u ON s.id_cliente = u.id_cliente WHERE s.id_solicitud = ?`,
        [id]
      );
      if (!rows.length) return res.status(404).json({ message: 'Not found' });
      res.json(rows[0]);
    } catch (err) {
      console.error('GET /solicitudes/:id error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // Update solicitud
  updateSolicitud: async (req, res) => {
    const id = req.params.id;
    const body = req.body || {};
    try {
      const fields = [];
      const values = [];
      for (const k of Object.keys(body)) {
        fields.push(`${k} = ?`);
        values.push(body[k]);
      }
      if (!fields.length) return res.status(400).json({ message: 'No fields to update' });
      values.push(id);
      await pool.query(`UPDATE Solicitudes SET ${fields.join(', ')} WHERE id_solicitud = ?`, values);
      res.json({ updated: true });
    } catch (err) {
      console.error('PUT /solicitudes/:id error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // Delete solicitud
   deleteSolicitud: async (req, res) => {
    // VERIFICACIÓN POR ROL - Solo Administrador y Superadmin pueden eliminar
    if (req.user.rol !== 'Administrador' && req.user.rol !== 'Superadmin') {
      return res.status(403).json({ 
        message: 'No tienes permisos para eliminar solicitudes. Solo administradores pueden realizar esta acción.' 
      });
    }

    const id = req.params.id;
    try {
      await pool.query('DELETE FROM Solicitudes WHERE id_solicitud = ?', [id]);
      res.json({ deleted: true });
    } catch (err) {
      console.error('DELETE /solicitudes/:id error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // Create encuesta
  createEncuesta: async (req, res) => {
    const body = req.body || {};
    
    if (!body.id_solicitud) {
      return res.status(400).json({ message: 'Missing id_solicitud' });
    }
    
    try {
      const connection = await pool.getConnection();
      await connection.beginTransaction();
      
      try {
        if (body.fecha_encuesta || body.puntuacion_satisfaccion || body.comentarios || body.recomendaria_servicio !== undefined) {
          await connection.query(
            `INSERT INTO ResultadosEncuestas (id_solicitud, fecha_encuesta, puntuacion_satisfaccion, comentarios, recomendaria_servicio)
             VALUES (?, ?, ?, ?, ?)`,
            [
              body.id_solicitud,
              body.fecha_encuesta || null,
              body.puntuacion_satisfaccion || null,
              body.comentarios || null,
              body.recomendaria_servicio ? 1 : 0
            ]
          );
        }
        
        const updateFields = [];
        const updateValues = [];
        
        if (body.cliente_respondio_encuesta !== undefined) {
          updateFields.push('cliente_respondio_encuesta = ?');
          updateValues.push(body.cliente_respondio_encuesta ? 1 : 0);
        }
        
        if (body.solicito_nueva_encuesta !== undefined) {
          updateFields.push('solicito_nueva_encuesta = ?');
          updateValues.push(body.solicito_nueva_encuesta ? 1 : 0);
        }
        
        if (updateFields.length > 0) {
          updateValues.push(body.id_solicitud);
          await connection.query(
            `UPDATE Solicitudes SET ${updateFields.join(', ')} WHERE id_solicitud = ?`,
            updateValues
          );
        }
        
        await connection.commit();
        connection.release();
        
        res.json({ message: 'Encuesta creada exitosamente' });
      } catch (err) {
        await connection.rollback();
        connection.release();
        throw err;
      }
    } catch (err) {
      console.error('POST /encuestas error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
};

module.exports = solicitudesController;