const pool = require('../config/db');

// Material Referencia
const listarMateriales = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM material_referencia ORDER BY codigo_id');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const crearMaterial = async (req, res) => {
  const { codigo_id, nombre_material, rango_medicion, marca, serie, error_max_permitido, modelo } = req.body;
  
  try {
    const [result] = await pool.query(
      'INSERT INTO material_referencia (codigo_id, nombre_material, rango_medicion, marca, serie, error_max_permitido, modelo) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [codigo_id, nombre_material, rango_medicion, marca, serie, error_max_permitido, modelo]
    );

    if (req.user && req.user.id) {
      const fecha = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion, detalle) VALUES (?, ?, ?, ?, ?, ?)',
        ['MAT_REFERENCIA', 'CREAR', req.user.id, fecha, `Creación de material referencia: ${codigo_id}`, JSON.stringify(req.body)]
      );
    }

    res.json({ id: result.insertId, message: 'Material creado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const actualizarMaterial = async (req, res) => {
  const { codigo_id } = req.params;
  const { nombre_material, rango_medicion, marca, serie, error_max_permitido, modelo } = req.body;
  
  try {
    // 1. Obtener datos actuales
    const [rows] = await pool.query('SELECT * FROM material_referencia WHERE codigo_id = ?', [codigo_id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'No encontrado' });
    }
    const datosActuales = rows[0];

    // 2. Preparar nuevos datos
    const datosNuevos = {
      nombre_material,
      rango_medicion,
      marca,
      serie,
      error_max_permitido,
      modelo
    };

    // 3. Ejecutar Update
    await pool.query(
      'UPDATE material_referencia SET nombre_material = ?, rango_medicion = ?, marca = ?, serie = ?, error_max_permitido = ?, modelo = ? WHERE codigo_id = ?',
      [nombre_material, rango_medicion, marca, serie, error_max_permitido, modelo, codigo_id]
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

    if (Object.keys(cambios).length > 0) {
      detallesCambios = JSON.stringify(cambios);
    }

    if (req.user && req.user.id) {
      const fecha = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion, detalle) VALUES (?, ?, ?, ?, ?, ?)',
        ['MAT_REFERENCIA', 'ACTUALIZAR', req.user.id, fecha, `Actualización de material referencia: ${codigo_id}`, detallesCambios]
      );
    }

    res.json({ message: 'Material actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const eliminarMaterial = async (req, res) => {
  const { codigo_id } = req.params;
  
  try {
    await pool.query('DELETE FROM material_referencia WHERE codigo_id = ?', [codigo_id]);

    if (req.user && req.user.id) {
      const fecha = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion, detalle) VALUES (?, ?, ?, ?, ?, ?)',
        ['MAT_REFERENCIA', 'ELIMINAR', req.user.id, fecha, `Eliminación de material referencia: ${codigo_id}`, null]
      );
    }

    res.json({ message: 'Material eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const listarPdfsPorReferencia = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.query(
      'SELECT id, referencia_id, categoria, nombre_archivo, fecha_subida FROM pdfs_referencia WHERE referencia_id = ? ORDER BY fecha_subida ASC',
      [codigo]
    );
    const items = rows.map(r => ({
      id: r.id,
      nombre_archivo: r.nombre_archivo,
      categoria: r.categoria,
      fecha_subida: r.fecha_subida
    }));
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const subirPdfReferencia = async (req, res) => {
  try {
    const codigo = req.params.codigo || req.body.codigo_material;
    const categoria = req.body.categoria || null;
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'No se recibió archivo' });
    }
    const originalName = req.file.originalname || 'archivo.pdf';
    const buffer = req.file.buffer;
    const [result] = await pool.query(
      'INSERT INTO pdfs_referencia (referencia_id, categoria, nombre_archivo, archivo, fecha_subida) VALUES (?, ?, ?, ?, NOW())',
      [codigo, categoria, originalName, buffer]
    );
    const insertedId = result.insertId;

    if (req.user && req.user.id) {
      const fecha = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion, detalle) VALUES (?, ?, ?, ?, ?, ?)',
        ['MAT_REFERENCIA', 'SUBIR_PDF', req.user.id, fecha, `Subida de PDF para referencia: ${codigo}`, JSON.stringify({ codigo, categoria, nombre_archivo: originalName })]
      );
    }

    res.status(201).json({ id: insertedId, nombre_archivo: originalName, categoria });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const descargarPdfReferencia = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      'SELECT nombre_archivo, archivo FROM pdfs_referencia WHERE id = ? LIMIT 1',
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Archivo no encontrado' });
    const r = rows[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${r.nombre_archivo || 'archivo.pdf'}"`);
    res.send(r.archivo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const eliminarPdfReferencia = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener info antes de eliminar
    const [rows] = await pool.query('SELECT referencia_id, nombre_archivo FROM pdfs_referencia WHERE id = ?', [id]);
    
    const [result] = await pool.query('DELETE FROM pdfs_referencia WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    if (req.user && req.user.id && rows.length > 0) {
      const pdfInfo = rows[0];
      const fechaLog = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion, detalle) VALUES (?, ?, ?, ?, ?, ?)',
        ['MAT_REFERENCIA', 'ELIMINAR', req.user.id, fechaLog, `Eliminación de PDF para referencia: ${pdfInfo.referencia_id}`, JSON.stringify({ id, ...pdfInfo })]
      );
    }

    res.json({ message: 'Archivo eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Historial Referencia
const listarHistorialPorMaterial = async (req, res) => {
  const { codigo_material } = req.params;
  
  try {
    const [rows] = await pool.query(
      'SELECT * FROM historial_referencia WHERE codigo_material = ? ORDER BY consecutivo DESC',
      [codigo_material]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const crearHistorial = async (req, res) => {
  const { consecutivo, codigo_material, fecha, tipo_historial_instrumento, codigo_registro, realizo, superviso } = req.body;
  
  try {
    const [result] = await pool.query(
      'INSERT INTO historial_referencia (consecutivo, codigo_material, fecha, tipo_historial_instrumento, codigo_registro, realizo, superviso) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [consecutivo, codigo_material, fecha, tipo_historial_instrumento, codigo_registro, realizo, superviso]
    );

    if (req.user && req.user.id) {
      const fechaLog = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion, detalle) VALUES (?, ?, ?, ?, ?, ?)',
        ['MAT_REFERENCIA', 'CREAR', req.user.id, fechaLog, `Creación de historial para referencia: ${codigo_material}`, JSON.stringify(req.body)]
      );
    }

    res.json({ id: result.insertId, message: 'Historial creado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const actualizarHistorial = async (req, res) => {
  const { codigo_material, consecutivo } = req.params;
  const { tipo_historial_instrumento, codigo_registro, realizo, superviso } = req.body;
  
  try {
    // 1. Obtener datos actuales
    const [rows] = await pool.query('SELECT * FROM historial_referencia WHERE codigo_material = ? AND consecutivo = ?', [codigo_material, consecutivo]);
    if (rows.length === 0) return res.status(404).json({ message: 'No encontrado' });
    const datosActuales = rows[0];

    // 2. Preparar nuevos datos
    const datosNuevos = { tipo_historial_instrumento, codigo_registro, realizo, superviso };

    // 3. Update
    await pool.query(
      'UPDATE historial_referencia SET tipo_historial_instrumento = ?, codigo_registro = ?, realizo = ?, superviso = ? WHERE codigo_material = ? AND consecutivo = ?',
      [tipo_historial_instrumento, codigo_registro, realizo, superviso, codigo_material, consecutivo]
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

    if (Object.keys(cambios).length > 0) {
      detallesCambios = JSON.stringify(cambios);
    }

    if (req.user && req.user.id) {
      const fechaLog = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion, detalle) VALUES (?, ?, ?, ?, ?, ?)',
        ['MAT_REFERENCIA', 'ACTUALIZAR', req.user.id, fechaLog, `Actualización de historial para referencia: ${codigo_material}`, detallesCambios]
      );
    }

    res.json({ message: 'Historial actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const obtenerNextHistorial = async (req, res) => {
  const { codigo_material } = req.params;
  
  try {
    const [rows] = await pool.query(
      'SELECT MAX(consecutivo) as max FROM historial_referencia WHERE codigo_material = ?',
      [codigo_material]
    );
    const next = (rows[0].max || 0) + 1;
    res.json({ next });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Intervalo Referencia
const listarIntervaloPorMaterial = async (req, res) => {
  const { codigo_material } = req.params;
  
  try {
    const [rows] = await pool.query(
      'SELECT * FROM intervalo_referencia WHERE codigo_material = ? ORDER BY consecutivo DESC',
      [codigo_material]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const crearIntervalo = async (req, res) => {
  const {
    consecutivo, codigo_material, valor_nominal,
    fecha_c1, error_c1, fecha_c2, error_c2,
    diferencia_tiempo_dias, desviacion_abs, deriva, tolerancia,
    intervalo_calibracion_dias, intervalo_calibracion_anos, incertidumbre_exp
  } = req.body;
  
  try {
    const [result] = await pool.query(
      `INSERT INTO intervalo_referencia 
       (consecutivo, codigo_material, valor_nominal, fecha_c1, error_c1, fecha_c2, error_c2, 
        diferencia_tiempo_dias, desviacion_abs, deriva, tolerancia, intervalo_calibracion_dias, 
        intervalo_calibracion_anos, incertidumbre_exp) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        consecutivo, codigo_material, valor_nominal,
        fecha_c1, error_c1, fecha_c2, error_c2,
        diferencia_tiempo_dias, desviacion_abs, deriva, tolerancia,
        intervalo_calibracion_dias, intervalo_calibracion_anos, incertidumbre_exp
      ]
    );

    if (req.user && req.user.id) {
      const fechaLog = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion, detalle) VALUES (?, ?, ?, ?, ?, ?)',
        ['MAT_REFERENCIA', 'CREAR', req.user.id, fechaLog, `Creación de intervalo para referencia: ${codigo_material}`, JSON.stringify(req.body)]
      );
    }

    res.json({ id: result.insertId, message: 'Intervalo creado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const actualizarIntervalo = async (req, res) => {
  const { codigo_material, consecutivo } = req.params;
  const {
    valor_nominal, fecha_c1, error_c1, fecha_c2, error_c2,
    diferencia_tiempo_dias, desviacion_abs, deriva, tolerancia,
    intervalo_calibracion_dias, intervalo_calibracion_anos, incertidumbre_exp
  } = req.body;
  
  try {
    // 1. Obtener datos actuales
    const [rows] = await pool.query('SELECT * FROM intervalo_referencia WHERE codigo_material = ? AND consecutivo = ?', [codigo_material, consecutivo]);
    if (rows.length === 0) return res.status(404).json({ message: 'No encontrado' });
    const datosActuales = rows[0];

    // 2. Preparar nuevos datos
    const datosNuevos = {
        valor_nominal, fecha_c1, error_c1, fecha_c2, error_c2,
        diferencia_tiempo_dias, desviacion_abs, deriva, tolerancia,
        intervalo_calibracion_dias, intervalo_calibracion_anos, incertidumbre_exp
    };

    // 3. Update
    await pool.query(
      `UPDATE intervalo_referencia 
       SET valor_nominal = ?, fecha_c1 = ?, error_c1 = ?, fecha_c2 = ?, error_c2 = ?,
           diferencia_tiempo_dias = ?, desviacion_abs = ?, deriva = ?, tolerancia = ?,
           intervalo_calibracion_dias = ?, intervalo_calibracion_anos = ?, incertidumbre_exp = ?
       WHERE codigo_material = ? AND consecutivo = ?`,
      [
        valor_nominal, fecha_c1, error_c1, fecha_c2, error_c2,
        diferencia_tiempo_dias, desviacion_abs, deriva, tolerancia,
        intervalo_calibracion_dias, intervalo_calibracion_anos, incertidumbre_exp,
        codigo_material, consecutivo
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

    if (Object.keys(cambios).length > 0) {
      detallesCambios = JSON.stringify(cambios);
    }

    if (req.user && req.user.id) {
      const fechaLog = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      
      await pool.query(
        'INSERT INTO logs_acciones (modulo, accion, usuario_id, fecha, descripcion, detalle) VALUES (?, ?, ?, ?, ?, ?)',
        ['MAT_REFERENCIA', 'ACTUALIZAR', req.user.id, fechaLog, `Actualización de intervalo para referencia: ${codigo_material}`, detallesCambios]
      );
    }

    res.json({ message: 'Intervalo actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const obtenerNextIntervalo = async (req, res) => {
  const { codigo_material } = req.params;
  
  try {
    const [rows] = await pool.query(
      'SELECT MAX(consecutivo) as max FROM intervalo_referencia WHERE codigo_material = ?',
      [codigo_material]
    );
    const next = (rows[0].max || 0) + 1;
    res.json({ next });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  // Material Referencia
  listarMateriales,
  crearMaterial,
  actualizarMaterial,
  eliminarMaterial,
  
  // Historial Referencia
  listarHistorialPorMaterial,
  crearHistorial,
  actualizarHistorial,
  obtenerNextHistorial,
  
  // Intervalo Referencia
  listarIntervaloPorMaterial,
  crearIntervalo,
  actualizarIntervalo,
  obtenerNextIntervalo
  ,
  listarPdfsPorReferencia,
  subirPdfReferencia,
  descargarPdfReferencia,
  eliminarPdfReferencia
};
