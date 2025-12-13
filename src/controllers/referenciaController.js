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
    res.json({ id: result.insertId, message: 'Material creado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const actualizarMaterial = async (req, res) => {
  const { codigo_id } = req.params;
  const { nombre_material, rango_medicion, marca, serie, error_max_permitido, modelo } = req.body;
  
  try {
    await pool.query(
      'UPDATE material_referencia SET nombre_material = ?, rango_medicion = ?, marca = ?, serie = ?, error_max_permitido = ?, modelo = ? WHERE codigo_id = ?',
      [nombre_material, rango_medicion, marca, serie, error_max_permitido, modelo, codigo_id]
    );
    res.json({ message: 'Material actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const eliminarMaterial = async (req, res) => {
  const { codigo_id } = req.params;
  
  try {
    await pool.query('DELETE FROM material_referencia WHERE codigo_id = ?', [codigo_id]);
    res.json({ message: 'Material eliminado' });
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
    res.json({ id: result.insertId, message: 'Historial creado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const actualizarHistorial = async (req, res) => {
  const { codigo_material, consecutivo } = req.params;
  const { tipo_historial_instrumento, codigo_registro, realizo, superviso } = req.body;
  
  try {
    await pool.query(
      'UPDATE historial_referencia SET tipo_historial_instrumento = ?, codigo_registro = ?, realizo = ?, superviso = ? WHERE codigo_material = ? AND consecutivo = ?',
      [tipo_historial_instrumento, codigo_registro, realizo, superviso, codigo_material, consecutivo]
    );
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
};