const express = require('express');
const router = express.Router();
const pool = require('../db');

// ---------- USUARIOS CRUD ----------
// List usuarios (with optional search by nombre_solicitante)
router.get('/usuarios', async (req, res) => {
  const q = req.query.q || '';
  try {
    const [rows] = await pool.query(
      `SELECT id_usuario, nombre_solicitante, numero_identificacion, correo_electronico, ciudad, activo
       FROM usuarios
       WHERE nombre_solicitante LIKE ? OR correo_electronico LIKE ?
       ORDER BY id_usuario DESC
       LIMIT 200`,
      [`%${q}%`, `%${q}%`]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /usuarios error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create usuario
router.post('/usuarios', async (req, res) => {
  const body = req.body || {};
  const required = ['nombre_solicitante', 'tipo_identificacion', 'numero_identificacion'];
  for (const f of required) if (!body[f]) return res.status(400).json({ message: `Missing ${f}` });
  try {
    // ensure 'numero' is not null (schema requires NOT NULL UNIQUE)
  let numeroVal = body.numero || null;
    if (!numeroVal) {
      try {
        const [rmax] = await pool.query('SELECT MAX(numero) AS max FROM usuarios');
        const maxNum = (rmax && rmax[0] && rmax[0].max) ? parseInt(rmax[0].max, 10) : 0;
        numeroVal = maxNum + 1;
      } catch (e) {
        numeroVal = 1;
      }
    }

    // set defaults for NOT NULL columns if missing in request
    const fechaVinc = body.fecha_vinculacion || new Date().toISOString().slice(0,10);
    const tipoUsuarioVal = body.tipo_usuario || 'Persona Natural';
    const sexoVal = body.sexo || 'Otro';

    const [result] = await pool.query(
  `INSERT INTO usuarios (numero, fecha_vinculacion, tipo_usuario, razon_social, nit, nombre_solicitante, tipo_identificacion, numero_identificacion, sexo, tipo_poblacion, direccion, ciudad, departamento, celular, telefono, correo_electronico, tipo_vinculacion, registro_realizado_por, observaciones)
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
    res.status(201).json({ id_usuario: result.insertId });
  } catch (err) {
    console.error('POST /usuarios error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get single usuario
router.get('/usuarios/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id_usuario = ?', [id]);
    if (!rows.length) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /usuarios/:id error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update usuario
router.put('/usuarios/:id', async (req, res) => {
  const id = req.params.id;
  const body = req.body || {};
  try {
    // Simple update: allow partial updates
    const fields = [];
    const values = [];
    for (const k of Object.keys(body)) {
      fields.push(`${k} = ?`);
      values.push(body[k]);
    }
    if (!fields.length) return res.status(400).json({ message: 'No fields to update' });
    values.push(id);
    await pool.query(`UPDATE usuarios SET ${fields.join(', ')} WHERE id_usuario = ?`, values);
    res.json({ updated: true });
  } catch (err) {
    console.error('PUT /usuarios/:id error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete usuario
router.delete('/usuarios/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('DELETE FROM usuarios WHERE id_usuario = ?', [id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('DELETE /usuarios/:id error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ---------- SOLICITUDES CRUD ----------
// List solicitudes (with joined usuario info)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id_solicitud, s.numero_solicitud, s.codigo, s.fecha_solicitud, s.nombre_muestra_producto, s.cantidad_muestras_analizar,
              s.servicio_viable, s.genero_cotizacion, s.cliente_respondio_encuesta, s.numero_informe_resultados,
              u.id_usuario, u.nombre_solicitante, u.correo_electronico
       FROM Solicitudes s
       LEFT JOIN usuarios u ON s.id_usuario = u.id_usuario
       ORDER BY s.id_solicitud DESC
       LIMIT 500`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /solicitudes error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create solicitud
router.post('/', async (req, res) => {
  const b = req.body || {};
  if (!b.id_usuario) return res.status(400).json({ message: 'Missing id_usuario' });
  try {
    // ensure numero_solicitud is set
    let numeroSol = b.numero_solicitud || null;
    if (!numeroSol) {
      try {
        const [rmax] = await pool.query('SELECT MAX(numero_solicitud) AS max FROM Solicitudes');
        const maxNum = (rmax && rmax[0] && rmax[0].max) ? parseInt(rmax[0].max, 10) : 0;
        numeroSol = maxNum + 1;
      } catch (e) { numeroSol = 1; }
    }

    const [result] = await pool.query(
      `INSERT INTO Solicitudes (numero_solicitud, id_usuario, codigo, fecha_solicitud, nombre_muestra_producto, lote_producto, fecha_vencimiento_producto, tipo_muestra, condiciones_empaque, tipo_analisis_requerido, requiere_varios_analisis, cantidad_muestras_analizar, fecha_estimada_entrega_muestra, puede_suministrar_informacion_adicional, servicio_viable, genero_cotizacion, valor_cotizacion, fecha_envio_oferta, realizo_seguimiento_oferta, observacion_oferta, fecha_limite_entrega_resultados, numero_informe_resultados, fecha_envio_resultados, cliente_respondio_encuesta, solicito_nueva_encuesta, observaciones_generales, mes_solicitud)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        numeroSol,
        b.id_usuario,
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
});

// Get single solicitud with usuario
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const [rows] = await pool.query(
      `SELECT s.*, u.nombre_solicitante, u.correo_electronico FROM Solicitudes s LEFT JOIN usuarios u ON s.id_usuario = u.id_usuario WHERE s.id_solicitud = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /solicitudes/:id error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update solicitud (partial)
router.put('/:id', async (req, res) => {
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
});

// Delete solicitud
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('DELETE FROM Solicitudes WHERE id_solicitud = ?', [id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('DELETE /solicitudes/:id error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create encuesta
router.post('/encuestas', async (req, res) => {
  const body = req.body || {};
  
  if (!body.id_solicitud) {
    return res.status(400).json({ message: 'Missing id_solicitud' });
  }
  
  try {
    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Insert into ResultadosEncuestas if we have survey data
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
      
      // Update Solicitudes table with survey status
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
});

module.exports = router;
