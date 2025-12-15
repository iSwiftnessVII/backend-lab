const pool = require('../config/db');
const fs = require('fs').promises;
const path = require('path');

const UPLOADS_BASE = path.join(__dirname, '..', '..', 'uploads', 'volumetricos');

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    // ignore
  }
}

// ==================== MATERIAL VOLUMÉTRICO ====================

// Crear material volumétrico
exports.crearMaterial = async (req, res) => {
  try {
    const {
      codigo_id,
      nombre_material,
      volumen_nominal,
      rango_volumen,
      marca,
      resolucion,
      error_max_permitido,
      modelo
    } = req.body;

    const sql = `INSERT INTO material_volumetrico (
      codigo_id, nombre_material, volumen_nominal, rango_volumen, marca, resolucion, error_max_permitido, modelo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    await pool.execute(sql, [
      codigo_id,
      nombre_material,
      volumen_nominal,
      rango_volumen || null,
      marca || null,
      resolucion || null,
      error_max_permitido || null,
      modelo || null
    ]);

    res.status(201).json({ message: 'Material volumétrico registrado correctamente' });
  } catch (error) {
    console.error('Error al registrar material volumétrico:', error);
    res.status(500).json({ message: 'Error al registrar material volumétrico', error: error.message });
  }
};

// Listar todos los materiales volumétricos
exports.listarMateriales = async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM material_volumetrico ORDER BY codigo_id');
    res.json(rows);
  } catch (error) {
    console.error('Error al listar materiales volumétricos:', error);
    res.status(500).json({ message: 'Error al listar materiales volumétricos', error: error.message });
  }
};

// Obtener material completo por código
exports.obtenerMaterialCompleto = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.execute('SELECT * FROM material_volumetrico WHERE codigo_id = ?', [codigo]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Material no encontrado' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener material volumétrico:', error);
    res.status(500).json({ message: 'Error al obtener material volumétrico', error: error.message });
  }
};

// Actualizar material volumétrico
exports.actualizarMaterial = async (req, res) => {
  try {
    const { codigo } = req.params;
    const {
      nombre_material,
      volumen_nominal,
      rango_volumen,
      marca,
      resolucion,
      error_max_permitido,
      modelo
    } = req.body;

    const sql = `UPDATE material_volumetrico SET 
      nombre_material = ?, 
      volumen_nominal = ?, 
      rango_volumen = ?, 
      marca = ?, 
      resolucion = ?, 
      error_max_permitido = ?, 
      modelo = ?
    WHERE codigo_id = ?`;

    const [result] = await pool.execute(sql, [
      nombre_material,
      volumen_nominal,
      rango_volumen || null,
      marca || null,
      resolucion || null,
      error_max_permitido || null,
      modelo || null,
      codigo
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Material no encontrado' });
    }

    const [updated] = await pool.execute('SELECT * FROM material_volumetrico WHERE codigo_id = ?', [codigo]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Error al actualizar material volumétrico:', error);
    res.status(500).json({ message: 'Error al actualizar material volumétrico', error: error.message });
  }
};

// Eliminar material volumétrico
exports.eliminarMaterial = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [result] = await pool.execute('DELETE FROM material_volumetrico WHERE codigo_id = ?', [codigo]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Material no encontrado' });
    }
    
    res.json({ message: 'Material volumétrico eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar material volumétrico:', error);
    res.status(500).json({ message: 'Error al eliminar material volumétrico', error: error.message });
  }
};

// ==================== HISTORIAL VOLUMÉTRICO ====================

// Crear historial volumétrico
exports.crearHistorial = async (req, res) => {
  try {
    const {
      consecutivo,
      codigo_material,
      fecha,
      tipo_historial_instrumento,
      codigo_registro,
      realizo,
      superviso
    } = req.body;

    const sql = `INSERT INTO historial_volumetrico (
      consecutivo, codigo_material, fecha, tipo_historial_instrumento, codigo_registro, realizo, superviso
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`;

    await pool.execute(sql, [
      consecutivo,
      codigo_material,
      fecha,
      tipo_historial_instrumento || null,
      codigo_registro || null,
      realizo || null,
      superviso || null
    ]);

    res.status(201).json({ message: 'Historial registrado correctamente' });
  } catch (error) {
    console.error('Error al registrar historial:', error);
    res.status(500).json({ message: 'Error al registrar historial', error: error.message });
  }
};

// Listar historial por material
exports.listarHistorialPorMaterial = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.execute(
      'SELECT * FROM historial_volumetrico WHERE codigo_material = ? ORDER BY consecutivo',
      [codigo]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al listar historial:', error);
    res.status(500).json({ message: 'Error al listar historial', error: error.message });
  }
};

// Obtener siguiente consecutivo de historial
exports.obtenerNextHistorial = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.execute(
      'SELECT MAX(consecutivo) as maxConsecutivo FROM historial_volumetrico WHERE codigo_material = ?',
      [codigo]
    );
    const maxConsecutivo = rows[0]?.maxConsecutivo || 0;
    res.json({ nextConsecutivo: maxConsecutivo + 1 });
  } catch (error) {
    console.error('Error al obtener siguiente consecutivo:', error);
    res.status(500).json({ message: 'Error al obtener siguiente consecutivo', error: error.message });
  }
};

// Actualizar historial
exports.actualizarHistorial = async (req, res) => {
  try {
    const { codigo, consecutivo } = req.params;
    const allowedFields = ['fecha', 'tipo_historial_instrumento', 'codigo_registro', 'realizo', 'superviso'];
    
    const updates = [];
    const values = [];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No hay campos para actualizar' });
    }

    values.push(codigo, consecutivo);
    const sql = `UPDATE historial_volumetrico SET ${updates.join(', ')} WHERE codigo_material = ? AND consecutivo = ?`;
    
    const [result] = await pool.execute(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Registro de historial no encontrado' });
    }

    const [updated] = await pool.execute(
      'SELECT * FROM historial_volumetrico WHERE codigo_material = ? AND consecutivo = ?',
      [codigo, consecutivo]
    );
    res.json(updated[0]);
  } catch (error) {
    console.error('Error al actualizar historial:', error);
    res.status(500).json({ message: 'Error al actualizar historial', error: error.message });
  }
};

// ==================== INTERVALO VOLUMÉTRICO ====================

// Crear intervalo volumétrico
exports.crearIntervalo = async (req, res) => {
  try {
    const {
      consecutivo,
      codigo_material,
      valor_nominal,
      fecha_c1,
      error_c1,
      fecha_c2,
      error_c2,
      diferencia_tiempo_dias,
      desviacion_abs,
      deriva,
      tolerancia,
      intervalo_calibracion_dias,
      intervalo_calibracion_anos,
      incertidumbre_exp
    } = req.body;

    const sql = `INSERT INTO intervalo_volumetrico (
      consecutivo, codigo_material, valor_nominal, fecha_c1, error_c1, fecha_c2, error_c2,
      diferencia_tiempo_dias, desviacion_abs, deriva, tolerancia, intervalo_calibracion_dias,
      intervalo_calibracion_anos, incertidumbre_exp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await pool.execute(sql, [
      consecutivo,
      codigo_material,
      valor_nominal,
      fecha_c1,
      error_c1,
      fecha_c2,
      error_c2,
      diferencia_tiempo_dias || null,
      desviacion_abs || null,
      deriva || null,
      tolerancia || null,
      intervalo_calibracion_dias || null,
      intervalo_calibracion_anos || null,
      incertidumbre_exp || null
    ]);

    res.status(201).json({ message: 'Intervalo registrado correctamente' });
  } catch (error) {
    console.error('Error al registrar intervalo:', error);
    res.status(500).json({ message: 'Error al registrar intervalo', error: error.message });
  }
};

// Listar intervalo por material
exports.listarIntervaloPorMaterial = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.execute(
      'SELECT * FROM intervalo_volumetrico WHERE codigo_material = ? ORDER BY consecutivo',
      [codigo]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al listar intervalo:', error);
    res.status(500).json({ message: 'Error al listar intervalo', error: error.message });
  }
};

// Obtener siguiente consecutivo de intervalo
exports.obtenerNextIntervalo = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.execute(
      'SELECT MAX(consecutivo) as maxConsecutivo FROM intervalo_volumetrico WHERE codigo_material = ?',
      [codigo]
    );
    const maxConsecutivo = rows[0]?.maxConsecutivo || 0;
    res.json({ nextConsecutivo: maxConsecutivo + 1 });
  } catch (error) {
    console.error('Error al obtener siguiente consecutivo:', error);
    res.status(500).json({ message: 'Error al obtener siguiente consecutivo', error: error.message });
  }
};

// Actualizar intervalo
exports.actualizarIntervalo = async (req, res) => {
  try {
    const { codigo, consecutivo } = req.params;
    const allowedFields = [
      'valor_nominal', 'fecha_c1', 'error_c1', 'fecha_c2', 'error_c2',
      'diferencia_tiempo_dias', 'desviacion_abs', 'deriva', 'tolerancia',
      'intervalo_calibracion_dias', 'intervalo_calibracion_anos', 'incertidumbre_exp'
    ];
    
    const updates = [];
    const values = [];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No hay campos para actualizar' });
    }

    values.push(codigo, consecutivo);
    const sql = `UPDATE intervalo_volumetrico SET ${updates.join(', ')} WHERE codigo_material = ? AND consecutivo = ?`;
    
    const [result] = await pool.execute(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Registro de intervalo no encontrado' });
    }

    const [updated] = await pool.execute(
      'SELECT * FROM intervalo_volumetrico WHERE codigo_material = ? AND consecutivo = ?',
      [codigo, consecutivo]
    );
    res.json(updated[0]);
  } catch (error) {
    console.error('Error al actualizar intervalo:', error);
    res.status(500).json({ message: 'Error al actualizar intervalo', error: error.message });
  }
};

// ==================== PDFs ====================

// Listar PDFs por material
exports.listarPdfsPorMaterial = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.execute(
      'SELECT id, material_id, categoria, nombre_archivo, fecha_subida FROM pdfs_material WHERE material_id = ? ORDER BY fecha_subida ASC',
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
    console.error('Error listar PDFs:', error);
    res.status(500).json({ message: 'Error listando PDFs', error: error.message });
  }
};

// Subir PDF para material
exports.subirPdfMaterial = async (req, res) => {
  try {
    const { codigo } = req.params;
    const categoria = req.body.categoria || null;
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'No se recibió archivo' });
    }
    const originalName = req.file.originalname || 'archivo.pdf';
    const buffer = req.file.buffer;
    const [result] = await pool.execute(
      'INSERT INTO pdfs_material (material_id, categoria, nombre_archivo, archivo, fecha_subida) VALUES (?, ?, ?, ?, NOW())',
      [codigo, categoria, originalName, buffer]
    );
    const insertedId = result.insertId;
    res.status(201).json({ id: insertedId, nombre_archivo: originalName, categoria });
  } catch (error) {
    console.error('Error subir PDF:', error);
    res.status(500).json({ message: 'Error subiendo PDF', error: error.message });
  }
};

// Descargar PDF por id
exports.descargarPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      'SELECT nombre_archivo, archivo FROM pdfs_material WHERE id = ? LIMIT 1',
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Archivo no encontrado' });
    const r = rows[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${r.nombre_archivo || 'archivo.pdf'}"`);
    res.send(r.archivo);
  } catch (error) {
    console.error('Error descargar PDF:', error);
    res.status(500).json({ message: 'Error descargando PDF', error: error.message });
  }
};

// Eliminar PDF por id
exports.eliminarPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.execute('DELETE FROM pdfs_material WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }
    res.json({ message: 'Archivo eliminado' });
  } catch (error) {
    console.error('Error eliminar PDF:', error);
    res.status(500).json({ message: 'Error eliminando PDF', error: error.message });
  }
};
