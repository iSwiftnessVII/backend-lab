// Registrar intervalo de equipo
exports.crearIntervalo = async (req, res) => {
  try {
    const {
      consecutivo,
      equipo_id,
      unidad_nominal_g,
      calibracion_1,
      fecha_c1,
      error_c1_g,
      calibracion_2,
      fecha_c2,
      error_c2_g,
      diferencia_dias,
      desviacion,
      deriva,
      tolerancia_g,
      intervalo_calibraciones_dias,
      intervalo_calibraciones_anios
    } = req.body;

    const sql = `INSERT INTO intervalo_hv (
      consecutivo, equipo_id, unidad_nominal_g, calibracion_1, fecha_c1, error_c1_g, calibracion_2, fecha_c2, error_c2_g, diferencia_dias, desviacion, deriva, tolerancia_g, intervalo_calibraciones_dias, intervalo_calibraciones_anios
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await pool.execute(sql, [
      consecutivo,
      equipo_id,
      unidad_nominal_g,
      calibracion_1,
      fecha_c1,
      error_c1_g,
      calibracion_2,
      fecha_c2,
      error_c2_g,
      diferencia_dias,
      desviacion,
      deriva,
      tolerancia_g,
      intervalo_calibraciones_dias,
      intervalo_calibraciones_anios
    ]);

    res.status(201).json({ message: 'Intervalo registrado correctamente' });
  } catch (error) {
    console.error('Error al registrar intervalo:', error);
    res.status(500).json({ message: 'Error al registrar intervalo', error });
  }
};
// Registrar historial de equipo
exports.crearHistorial = async (req, res) => {
  try {
    const {
      consecutivo,
      equipo_id,
      fecha,
      tipo_historial,
      codigo_registro,
      tolerancia_g,
      tolerancia_error_g,
      incertidumbre_u,
      realizo,
      superviso,
      observaciones
    } = req.body;

    const sql = `INSERT INTO historial_hv (
      consecutivo, equipo_id, fecha, tipo_historial, codigo_registro, tolerancia_g, tolerancia_error_g, incertidumbre_u, realizo, superviso, observaciones
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await pool.execute(sql, [
      consecutivo,
      equipo_id,
      fecha,
      tipo_historial,
      codigo_registro,
      tolerancia_g,
      tolerancia_error_g,
      incertidumbre_u,
      realizo,
      superviso,
      observaciones
    ]);

    res.status(201).json({ message: 'Historial registrado correctamente' });
  } catch (error) {
    console.error('Error al registrar historial:', error);
    res.status(500).json({ message: 'Error al registrar historial', error });
  }
};
const pool = require('../config/db');

// Registrar un nuevo equipo
exports.crearEquipo = async (req, res) => {
  try {
    const {
      codigo_identificacion,
      nombre,
      modelo,
      marca,
      inventario_sena,
      ubicacion,
      acreditacion,
      tipo_manual,
      numero_serie,
      tipo,
      clasificacion,
      manual_usuario,
      puesta_en_servicio,
      fecha_adquisicion,
      requerimientos_equipo,
      elementos_electricos,
      voltaje,
      elementos_mecanicos,
      frecuencia,
      campo_medicion,
      exactitud,
      sujeto_verificar,
      sujeto_calibracion,
      resolucion_division,
      sujeto_calificacion,
      accesorios
    } = req.body;

    const sql = `INSERT INTO hv_equipos (
      codigo_identificacion, nombre, modelo, marca, inventario_sena, ubicacion, acreditacion, tipo_manual, numero_serie, tipo, clasificacion, manual_usuario, puesta_en_servicio, fecha_adquisicion, requerimientos_equipo, elementos_electricos, voltaje, elementos_mecanicos, frecuencia, campo_medicion, exactitud, sujeto_verificar, sujeto_calibracion, resolucion_division, sujeto_calificacion, accesorios
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await pool.execute(sql, [
      codigo_identificacion,
      nombre,
      modelo,
      marca,
      inventario_sena,
      ubicacion,
      acreditacion,
      tipo_manual,
      numero_serie,
      tipo,
      clasificacion,
      manual_usuario,
      puesta_en_servicio,
      fecha_adquisicion,
      requerimientos_equipo,
      elementos_electricos,
      voltaje,
      elementos_mecanicos,
      frecuencia,
      campo_medicion,
      exactitud,
      sujeto_verificar,
      sujeto_calibracion,
      resolucion_division,
      sujeto_calificacion,
      accesorios
    ]);

    res.status(201).json({ message: 'Equipo registrado correctamente' });
  } catch (error) {
    console.error('Error al registrar equipo:', error);
    res.status(500).json({ message: 'Error al registrar equipo', error });
  }
};

// Listar todos los equipos registrados
exports.listarEquipos = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        codigo_identificacion,
        nombre,
        modelo,
        marca,
        inventario_sena,
        ubicacion,
        acreditacion,
        tipo_manual,
        numero_serie,
        tipo,
        clasificacion,
        manual_usuario,
        puesta_en_servicio,
        fecha_adquisicion,
        requerimientos_equipo,
        elementos_electricos,
        voltaje,
        elementos_mecanicos,
        frecuencia,
        campo_medicion,
        exactitud,
        sujeto_verificar,
        sujeto_calibracion,
        resolucion_division,
        sujeto_calificacion,
        accesorios
      FROM hv_equipos 
      ORDER BY codigo_identificacion
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error al listar equipos:', error);
    res.status(500).json({ message: 'Error al listar equipos', error });
  }
};

// Registrar ficha técnica
exports.crearFichaTecnica = async (req, res) => {
  try {
    const {
      codigo_identificador,
      nombre,
      marca,
      modelo,
      serie,
      fabricante,
      fecha_adq,
      uso,
      fecha_func,
      precio,
      accesorios,
      manual_ope,
      idioma_manual,
      magnitud,
      resolucion,
      precision_med,
      exactitud,
      rango_de_medicion,
      rango_de_uso,
      voltaje,
      potencia,
      amperaje,
      frecuencia,
      ancho,
      alto,
      peso_kg,
      profundidad,
      temperatura_c,
      humedad_porcentaje,
      limitaciones_e_interferencias,
      otros,
      especificaciones_software,
      proveedor,
      email,
      telefono,
      fecha_de_instalacion,
      alcance_del_servicio,
      garantia,
      observaciones,
      recibido_por,
      cargo_y_firma,
      fecha
    } = req.body;

    const sql = `INSERT INTO ficha_tecnica_de_equipos (
      codigo_identificador, nombre, marca, modelo, serie, fabricante, fecha_adq, uso, 
      fecha_func, precio, accesorios, manual_ope, idioma_manual, magnitud, resolucion, 
      precision_med, exactitud, rango_de_medicion, rango_de_uso, voltaje, potencia, 
      amperaje, frecuencia, ancho, alto, peso_kg, profundidad, temperatura_c, 
      humedad_porcentaje, limitaciones_e_interferencias, otros, especificaciones_software, 
      proveedor, email, telefono, fecha_de_instalacion, alcance_del_servicio, garantia, 
      observaciones, recibido_por, cargo_y_firma, fecha
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await pool.execute(sql, [
      codigo_identificador, nombre, marca, modelo, serie, fabricante, fecha_adq, uso,
      fecha_func, precio, accesorios, manual_ope, idioma_manual, magnitud, resolucion,
      precision_med, exactitud, rango_de_medicion, rango_de_uso, voltaje, potencia,
      amperaje, frecuencia, ancho, alto, peso_kg, profundidad, temperatura_c,
      humedad_porcentaje, limitaciones_e_interferencias, otros, especificaciones_software,
      proveedor, email, telefono, fecha_de_instalacion, alcance_del_servicio, garantia,
      observaciones, recibido_por, cargo_y_firma, fecha
    ]);

    res.status(201).json({ message: 'Ficha técnica registrada correctamente' });
  } catch (error) {
    console.error('Error al registrar ficha técnica:', error);
    res.status(500).json({ message: 'Error al registrar ficha técnica', error });
  }
};

// Obtener equipo completo por código
exports.obtenerEquipoCompleto = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.execute(
      'SELECT * FROM hv_equipos WHERE codigo_identificacion = ?', 
      [codigo]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Equipo no encontrado' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener equipo:', error);
    res.status(500).json({ message: 'Error al obtener equipo', error });
  }
};