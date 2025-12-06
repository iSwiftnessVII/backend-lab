const pool = require('../config/db');

const solicitudesController = {
  // ---------- DEPARTAMENTOS Y CIUDADES ----------
  getDepartamentos: async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT codigo, nombre FROM departamentos ORDER BY nombre ASC');
      res.json(rows);
    } catch (err) {
      console.error('GET /departamentos error', err);
      res.status(500).json({ message: 'Error obteniendo departamentos' });
    }
  },

  getCiudades: async (req, res) => {
    const codigoDepartamento = req.query.departamento;
    try {
      let query = 'SELECT codigo, nombre, codigo_departamento FROM ciudades';
      let params = [];
      if (codigoDepartamento) {
        query += ' WHERE codigo_departamento = ?';
        params.push(codigoDepartamento);
      }
      query += ' ORDER BY nombre ASC';
      const [rows] = await pool.query(query, params);
      res.json(rows);
    } catch (err) {
      console.error('GET /ciudades error', err);
      res.status(500).json({ message: 'Error obteniendo ciudades' });
    }
  },

  // ---------- CLIENTES CRUD ----------
  getClientes: async (req, res) => {
    const q = req.query.q || '';
    try {
      const [rows] = await pool.query(
        `SELECT id_cliente, nombre_solicitante, numero_identificacion, correo_electronico, id_ciudad, id_departamento, activo
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

      const fechaVinc = body.fecha_vinculacion || new Date().toISOString().slice(0, 10);
      const tipoUsuarioVal = body.tipo_usuario || 'Persona Natural';
      const sexoVal = body.sexo || 'Otro';

      const [result] = await pool.query(
        `INSERT INTO clientes (numero, fecha_vinculacion, tipo_usuario, razon_social, nit, nombre_solicitante, tipo_identificacion, numero_identificacion, sexo, tipo_poblacion, direccion, id_ciudad, id_departamento, celular, telefono, correo_electronico, tipo_vinculacion, registro_realizado_por, observaciones)
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
          body.id_ciudad || null,
          body.id_departamento || null,
          body.celular || null,
          body.telefono || null,
          body.correo_electronico || null,
          body.tipo_vinculacion || null,
          body.registro_realizado_por || null,
          body.observaciones || null
        ]
      );

      if (req.user && req.user.id) {
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
          [req.user.id, 'CREAR', 'CLIENTES']
        );
      }

      res.status(201).json({ id_cliente: result.insertId });
    } catch (err) {
      console.error('POST /clientes error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

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

      if (req.user && req.user.id) {
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
          [req.user.id, 'ACTUALIZAR', 'CLIENTES']
        );
      }

      res.json({ updated: true });
    } catch (err) {
      console.error('PUT /clientes/:id error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  deleteCliente: async (req, res) => {
    const id = req.params.id;

    try {
      if (req.user && req.user.rol !== 'Administrador' && req.user.rol !== 'Superadmin') {
        return res.status(403).json({ 
          message: 'No tienes permisos para eliminar clientes. Solo administradores pueden realizar esta acción.' 
        });
      }

      const [result] = await pool.query('DELETE FROM clientes WHERE id_cliente = ?', [id]);
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Cliente no encontrado' });
      }

      if (req.user && req.user.id) {
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
          [req.user.id, 'ELIMINAR', 'CLIENTES']
        );
      }

      res.json({ deleted: true });
    } catch (err) {
      console.error('DELETE /clientes/:id error', err);
      res.status(500).json({ message: 'Error eliminando cliente' });
    }
  },

  // ---------- SOLICITUDES CRUD ----------
  getSolicitudes: async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT 
            s.solicitud_id, s.id_cliente, s.tipo_solicitud, s.nombre_muestra, s.fecha_solicitud, s.lote_producto,
            s.fecha_vencimiento_muestra, s.tipo_muestra, s.tipo_empaque, s.analisis_requerido, s.req_analisis,
            s.cant_muestras, s.solicitud_recibida, s.fecha_entrega_muestra, s.recibe_personal, s.cargo_personal, s.observaciones,
            u.nombre_solicitante, u.correo_electronico
         FROM Solicitudes s
         LEFT JOIN clientes u ON s.id_cliente = u.id_cliente
         ORDER BY s.solicitud_id DESC
         LIMIT 500`
      );
      res.json(rows);
    } catch (err) {
      console.error('GET /solicitudes error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // Joined detail list: Solicitudes + oferta + revision_oferta + seguimiento_encuesta
  getSolicitudesDetalle: async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT 
           s.solicitud_id,
           s.id_cliente,
           s.tipo_solicitud,
           s.nombre_muestra,
           s.fecha_solicitud,
           s.lote_producto,
           s.fecha_vencimiento_muestra,
           s.tipo_muestra,
           s.tipo_empaque,
           s.analisis_requerido,
           s.req_analisis,
           s.cant_muestras,
           s.solicitud_recibida,
           s.fecha_entrega_muestra,
           s.recibe_personal,
           s.cargo_personal,
           s.observaciones,
           u.nombre_solicitante,
           u.correo_electronico,
           o.genero_cotizacion,
           o.valor_cotizacion,
           o.fecha_envio_oferta,
           o.realizo_seguimiento_oferta,
           o.observacion_oferta,
           r.fecha_limite_entrega,
           r.fecha_envio_resultados,
           r.servicio_es_viable,
           e.fecha_encuesta,
           e.comentarios,
           e.recomendaria_servicio,
           e.cliente_respondio,
           e.solicito_nueva_encuesta
         FROM Solicitudes s
         LEFT JOIN clientes u ON s.id_cliente = u.id_cliente
         LEFT JOIN oferta o ON o.id_solicitud = s.solicitud_id
         LEFT JOIN revision_oferta r ON r.id_solicitud = s.solicitud_id
         LEFT JOIN seguimiento_encuesta e ON e.id_solicitud = s.solicitud_id
         ORDER BY s.solicitud_id DESC
         LIMIT 500`
      );
      res.json(rows || []);
    } catch (err) {
      console.error('GET /solicitudes/detalle/lista error', err);
      res.status(500).json({ message: 'Error obteniendo detalle de solicitudes' });
    }
  },

  getSolicitudDetalleById: async (req, res) => {
    const id = req.params.id;
    try {
      const [rows] = await pool.query(
        `SELECT 
           s.solicitud_id,
           s.id_cliente,
           s.tipo_solicitud,
           s.nombre_muestra,
           s.fecha_solicitud,
           s.lote_producto,
           s.fecha_vencimiento_muestra,
           s.tipo_muestra,
           s.tipo_empaque,
           s.analisis_requerido,
           s.req_analisis,
           s.cant_muestras,
           s.solicitud_recibida,
           s.fecha_entrega_muestra,
           s.recibe_personal,
           s.cargo_personal,
           s.observaciones,
           u.nombre_solicitante,
           u.correo_electronico,
           o.genero_cotizacion,
           o.valor_cotizacion,
           o.fecha_envio_oferta,
           o.realizo_seguimiento_oferta,
           o.observacion_oferta,
           r.fecha_limite_entrega,
           r.fecha_envio_resultados,
           r.servicio_es_viable,
           e.fecha_encuesta,
           e.comentarios,
           e.recomendaria_servicio,
           e.cliente_respondio,
           e.solicito_nueva_encuesta
         FROM Solicitudes s
         LEFT JOIN clientes u ON s.id_cliente = u.id_cliente
         LEFT JOIN oferta o ON o.id_solicitud = s.solicitud_id
         LEFT JOIN revision_oferta r ON r.id_solicitud = s.solicitud_id
         LEFT JOIN seguimiento_encuesta e ON e.id_solicitud = s.solicitud_id
         WHERE s.solicitud_id = ?
         LIMIT 1`,
        [id]
      );
      if (!rows || rows.length === 0) return res.status(404).json({ message: 'Solicitud no encontrada' });
      res.json(rows[0]);
    } catch (err) {
      console.error('GET /solicitudes/detalle/:id error', err);
      res.status(500).json({ message: 'Error obteniendo detalle de solicitud' });
    }
  },

  createSolicitud: async (req, res) => {
    const b = req.body || {};
    if (!b.id_cliente) return res.status(400).json({ message: 'Missing id_cliente' });

    try {
      let sql;
      let params;
      
      if (b.solicitud_id) {
        sql = `INSERT INTO Solicitudes (
          solicitud_id, id_cliente, tipo_solicitud, nombre_muestra, fecha_solicitud, lote_producto,
          fecha_vencimiento_muestra, tipo_muestra, tipo_empaque, analisis_requerido,
          req_analisis, cant_muestras, solicitud_recibida, fecha_entrega_muestra,
          recibe_personal, cargo_personal, observaciones
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
        params = [
          b.solicitud_id,
          b.id_cliente,
          b.tipo_solicitud || null,
          b.nombre_muestra || null,
          b.fecha_solicitud || null,
          b.lote_producto || null,
          b.fecha_vencimiento_muestra || null,
          b.tipo_muestra || null,
          b.tipo_empaque || null,
          b.analisis_requerido || null,
          b.req_analisis ? 1 : 0,
          b.cant_muestras || null,
          b.solicitud_recibida || null,
          b.fecha_entrega_muestra || null,
          b.recibe_personal || null,
          b.cargo_personal || null,
          b.observaciones || null
        ];
      } else {
        sql = `INSERT INTO Solicitudes (
          id_cliente, tipo_solicitud, nombre_muestra, fecha_solicitud, lote_producto,
          fecha_vencimiento_muestra, tipo_muestra, tipo_empaque, analisis_requerido,
          req_analisis, cant_muestras, solicitud_recibida, fecha_entrega_muestra,
          recibe_personal, cargo_personal, observaciones
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
        params = [
          b.id_cliente,
          b.tipo_solicitud || null,
          b.nombre_muestra || null,
          b.fecha_solicitud || null,
          b.lote_producto || null,
          b.fecha_vencimiento_muestra || null,
          b.tipo_muestra || null,
          b.tipo_empaque || null,
          b.analisis_requerido || null,
          b.req_analisis ? 1 : 0,
          b.cant_muestras || null,
          b.solicitud_recibida || null,
          b.fecha_entrega_muestra || null,
          b.recibe_personal || null,
          b.cargo_personal || null,
          b.observaciones || null
        ];
      }

      const [result] = await pool.query(sql, params);

      if (req.user && req.user.id) {
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
          [req.user.id, 'CREAR', 'SOLICITUDES']
        );
      }

      res.status(201).json({ solicitud_id: result.insertId });
    } catch (err) {
      console.error('POST /solicitudes error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  getSolicitudById: async (req, res) => {
    const id = req.params.id;
    try {
      const [rows] = await pool.query(
        `SELECT s.*, u.nombre_solicitante, u.correo_electronico FROM Solicitudes s LEFT JOIN clientes u ON s.id_cliente = u.id_cliente WHERE s.solicitud_id = ?`,
        [id]
      );
      if (!rows.length) return res.status(404).json({ message: 'Not found' });
      res.json(rows[0]);
    } catch (err) {
      console.error('GET /solicitudes/:id error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

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
      await pool.query(`UPDATE Solicitudes SET ${fields.join(', ')} WHERE solicitud_id = ?`, values);

      if (req.user && req.user.id) {
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
          [req.user.id, 'ACTUALIZAR', 'SOLICITUDES']
        );
      }

      res.json({ updated: true });
    } catch (err) {
      console.error('PUT /solicitudes/:id error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // ---------- OFERTA ----------
  createOrUpdateOferta: async (req, res) => {
    const id_solicitud = req.params.id_solicitud || req.body.id_solicitud;
    if (!id_solicitud) return res.status(400).json({ message: 'Missing id_solicitud' });
    const b = req.body || {};
    
    try {
      const [update] = await pool.query(
        `UPDATE oferta SET genero_cotizacion = ?, valor_cotizacion = ?, fecha_envio_oferta = ?, realizo_seguimiento_oferta = ?, observacion_oferta = ?
         WHERE id_solicitud = ?`,
        [
          b.genero_cotizacion ? 1 : 0,
          b.valor_cotizacion || null,
          b.fecha_envio_oferta || null,
          b.realizo_seguimiento_oferta ? 1 : 0,
          b.observacion_oferta || null,
          id_solicitud
        ]
      );
      
      if (!update.affectedRows) {
        await pool.query(
          `INSERT INTO oferta (id_solicitud, genero_cotizacion, valor_cotizacion, fecha_envio_oferta, realizo_seguimiento_oferta, observacion_oferta)
           VALUES (?,?,?,?,?,?)`,
          [
            id_solicitud,
            b.genero_cotizacion ? 1 : 0,
            b.valor_cotizacion || null,
            b.fecha_envio_oferta || null,
            b.realizo_seguimiento_oferta ? 1 : 0,
            b.observacion_oferta || null
          ]
        );
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('createOrUpdateOferta error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // ---------- REVISIÓN DE OFERTA ----------
  createOrUpdateRevision: async (req, res) => {
    const id_solicitud = req.params.id_solicitud || req.body.id_solicitud;
    if (!id_solicitud) return res.status(400).json({ message: 'Missing id_solicitud' });
    const b = req.body || {};
    
    try {
      const [update] = await pool.query(
        `UPDATE revision_oferta SET fecha_limite_entrega = ?, fecha_envio_resultados = ?, servicio_es_viable = ?
         WHERE id_solicitud = ?`,
        [
          b.fecha_limite_entrega || null,
          b.fecha_envio_resultados || null,
          b.servicio_es_viable ? 1 : 0,
          id_solicitud
        ]
      );
      
      if (!update.affectedRows) {
        await pool.query(
          `INSERT INTO revision_oferta (id_solicitud, fecha_limite_entrega, fecha_envio_resultados, servicio_es_viable)
           VALUES (?,?,?,?)`,
          [
            id_solicitud,
            b.fecha_limite_entrega || null,
            b.fecha_envio_resultados || null,
            b.servicio_es_viable ? 1 : 0
          ]
        );
      }
      
      res.json({ ok: true });
    } catch (err) {
      console.error('createOrUpdateRevision error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // ---------- SEGUIMIENTO ENCUESTA ----------
  createOrUpdateSeguimientoEncuesta: async (req, res) => {
    const id_solicitud = req.params.id_solicitud || req.body.id_solicitud;
    if (!id_solicitud) return res.status(400).json({ message: 'Missing id_solicitud' });
    const b = req.body || {};
    
    try {
      const [update] = await pool.query(
        `UPDATE seguimiento_encuesta SET fecha_encuesta = ?, comentarios = ?, recomendaria_servicio = ?, cliente_respondio = ?, solicito_nueva_encuesta = ?
         WHERE id_solicitud = ?`,
        [
          b.fecha_encuesta || null,
          b.comentarios || null,
          b.recomendaria_servicio ? 1 : 0,
          b.cliente_respondio ? 1 : 0,
          b.solicito_nueva_encuesta ? 1 : 0,
          id_solicitud
        ]
      );
      
      if (!update.affectedRows) {
        await pool.query(
          `INSERT INTO seguimiento_encuesta (id_solicitud, fecha_encuesta, comentarios, recomendaria_servicio, cliente_respondio, solicito_nueva_encuesta)
           VALUES (?,?,?,?,?,?)`,
          [
            id_solicitud,
            b.fecha_encuesta || null,
            b.comentarios || null,
            b.recomendaria_servicio ? 1 : 0,
            b.cliente_respondio ? 1 : 0,
            b.solicito_nueva_encuesta ? 1 : 0
          ]
        );
      }
      
      res.json({ ok: true });
    } catch (err) {
      console.error('createOrUpdateSeguimientoEncuesta error', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  deleteSolicitud: async (req, res) => {
    const id = req.params.id;

    try {
      if (req.user && req.user.rol !== 'Administrador' && req.user.rol !== 'Superadmin') {
        return res.status(403).json({ 
          message: 'No tienes permisos para eliminar solicitudes. Solo administradores pueden realizar esta acción.' 
        });
      }

      const [result] = await pool.query('DELETE FROM Solicitudes WHERE solicitud_id = ?', [id]);
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Solicitud no encontrada' });
      }

      if (req.user && req.user.id) {
        await pool.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
          [req.user.id, 'ELIMINAR', 'SOLICITUDES']
        );
      }

      res.json({ deleted: true });
    } catch (err) {
      console.error('DELETE /solicitudes/:id error', err);
      res.status(500).json({ message: 'Error eliminando solicitud' });
    }
  },

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

        if (req.user && req.user.id) {
          await connection.query(
            'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
            [req.user.id, 'CREAR_ENCUESTA', 'SOLICITUDES']
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