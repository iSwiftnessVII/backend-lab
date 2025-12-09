const pool = require('../config/db');
const fs = require('fs').promises;
const path = require('path');

const UPLOADS_BASE = path.join(__dirname, '..', '..', 'uploads', 'referencia');

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (_) {
    // ignore
  }
}

// ==================== MATERIAL REFERENCIA ====================
exports.crearMaterial = async (req, res) => {
  try {
    const { codigo_id, nombre_material, rango_medicion, marca, serie, error_max_permitido, modelo } = req.body;

    const sql = `INSERT INTO material_referencia (
      codigo_id, nombre_material, rango_medicion, marca, serie, error_max_permitido, modelo
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`;

    await pool.execute(sql, [
      codigo_id,
      nombre_material,
      rango_medicion || null,
      marca || null,
      serie || null,
      error_max_permitido || null,
      modelo || null
    ]);

    res.status(201).json({ message: 'Material de referencia registrado correctamente' });
  } catch (error) {
    console.error('Error al registrar material de referencia:', error);
    res.status(500).json({ message: 'Error al registrar material de referencia', error: error.message });
  }
};

exports.listarMateriales = async (_req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM material_referencia ORDER BY codigo_id');
    res.json(rows);
  } catch (error) {
    console.error('Error al listar materiales de referencia:', error);
    res.status(500).json({ message: 'Error al listar materiales de referencia', error: error.message });
  }
};

exports.obtenerMaterialCompleto = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.execute('SELECT * FROM material_referencia WHERE codigo_id = ?', [codigo]);
    if (!rows.length) return res.status(404).json({ message: 'Material no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener material de referencia:', error);
    res.status(500).json({ message: 'Error al obtener material de referencia', error: error.message });
  }
};

exports.actualizarMaterial = async (req, res) => {
  try {
    const { codigo } = req.params;
    const { nombre_material, rango_medicion, marca, serie, error_max_permitido, modelo } = req.body;

    const sql = `UPDATE material_referencia SET 
      nombre_material = ?,
      rango_medicion = ?,
      marca = ?,
      serie = ?,
      error_max_permitido = ?,
      modelo = ?
    WHERE codigo_id = ?`;

    const [result] = await pool.execute(sql, [
      nombre_material,
      rango_medicion || null,
      marca || null,
      serie || null,
      error_max_permitido || null,
      modelo || null,
      codigo
    ]);

    if (!result.affectedRows) return res.status(404).json({ message: 'Material no encontrado' });
    const [updated] = await pool.execute('SELECT * FROM material_referencia WHERE codigo_id = ?', [codigo]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Error al actualizar material de referencia:', error);
    res.status(500).json({ message: 'Error al actualizar material de referencia', error: error.message });
  }
};

exports.eliminarMaterial = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [result] = await pool.execute('DELETE FROM material_referencia WHERE codigo_id = ?', [codigo]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Material no encontrado' });
    res.json({ message: 'Material de referencia eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar material de referencia:', error);
    res.status(500).json({ message: 'Error al eliminar material de referencia', error: error.message });
  }
};

// ==================== HISTORIAL REFERENCIA ====================
exports.crearHistorial = async (req, res) => {
  try {
    const { consecutivo, codigo_material, fecha, tipo_historial_instrumento, codigo_registro, realizo, superviso } = req.body;

    const sql = `INSERT INTO historial_referencia (
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
    console.error('Error al registrar historial referencia:', error);
    res.status(500).json({ message: 'Error al registrar historial referencia', error: error.message });
  }
};

exports.listarHistorialPorMaterial = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.execute('SELECT * FROM historial_referencia WHERE codigo_material = ? ORDER BY consecutivo', [codigo]);
    res.json(rows);
  } catch (error) {
    console.error('Error al listar historial referencia:', error);
    res.status(500).json({ message: 'Error al listar historial referencia', error: error.message });
  }
};

exports.obtenerNextHistorial = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.execute('SELECT MAX(consecutivo) as maxConsecutivo FROM historial_referencia WHERE codigo_material = ?', [codigo]);
    const maxConsecutivo = rows[0]?.maxConsecutivo || 0;
    res.json({ nextConsecutivo: maxConsecutivo + 1 });
  } catch (error) {
    console.error('Error al obtener siguiente consecutivo historial referencia:', error);
    res.status(500).json({ message: 'Error al obtener siguiente consecutivo historial referencia', error: error.message });
  }
};

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

    if (!updates.length) return res.status(400).json({ message: 'No hay campos para actualizar' });

    values.push(codigo, consecutivo);
    const sql = `UPDATE historial_referencia SET ${updates.join(', ')} WHERE codigo_material = ? AND consecutivo = ?`;
    const [result] = await pool.execute(sql, values);

    if (!result.affectedRows) return res.status(404).json({ message: 'Registro de historial no encontrado' });

    const [updated] = await pool.execute('SELECT * FROM historial_referencia WHERE codigo_material = ? AND consecutivo = ?', [codigo, consecutivo]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Error al actualizar historial referencia:', error);
    res.status(500).json({ message: 'Error al actualizar historial referencia', error: error.message });
  }
};

// ==================== INTERVALO REFERENCIA ====================
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

    const sql = `INSERT INTO intervalo_referencia (
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
    console.error('Error al registrar intervalo referencia:', error);
    res.status(500).json({ message: 'Error al registrar intervalo referencia', error: error.message });
  }
};

exports.listarIntervaloPorMaterial = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.execute('SELECT * FROM intervalo_referencia WHERE codigo_material = ? ORDER BY consecutivo', [codigo]);
    res.json(rows);
  } catch (error) {
    console.error('Error al listar intervalo referencia:', error);
    res.status(500).json({ message: 'Error al listar intervalo referencia', error: error.message });
  }
};

exports.obtenerNextIntervalo = async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await pool.execute('SELECT MAX(consecutivo) as maxConsecutivo FROM intervalo_referencia WHERE codigo_material = ?', [codigo]);
    const maxConsecutivo = rows[0]?.maxConsecutivo || 0;
    res.json({ nextConsecutivo: maxConsecutivo + 1 });
  } catch (error) {
    console.error('Error al obtener siguiente consecutivo intervalo referencia:', error);
    res.status(500).json({ message: 'Error al obtener siguiente consecutivo intervalo referencia', error: error.message });
  }
};

exports.actualizarIntervalo = async (req, res) => {
  try {
    const { codigo, consecutivo } = req.params;
    const allowedFields = [
      'valor_nominal',
      'fecha_c1',
      'error_c1',
      'fecha_c2',
      'error_c2',
      'diferencia_tiempo_dias',
      'desviacion_abs',
      'deriva',
      'tolerancia',
      'intervalo_calibracion_dias',
      'intervalo_calibracion_anos',
      'incertidumbre_exp'
    ];

    const updates = [];
    const values = [];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    });

    if (!updates.length) return res.status(400).json({ message: 'No hay campos para actualizar' });

    values.push(codigo, consecutivo);
    const sql = `UPDATE intervalo_referencia SET ${updates.join(', ')} WHERE codigo_material = ? AND consecutivo = ?`;
    const [result] = await pool.execute(sql, values);

    if (!result.affectedRows) return res.status(404).json({ message: 'Registro de intervalo no encontrado' });

    const [updated] = await pool.execute('SELECT * FROM intervalo_referencia WHERE codigo_material = ? AND consecutivo = ?', [codigo, consecutivo]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Error al actualizar intervalo referencia:', error);
    res.status(500).json({ message: 'Error al actualizar intervalo referencia', error: error.message });
  }
};

// ==================== PDFs ====================
exports.listarPdfsPorMaterial = async (req, res) => {
  try {
    const { codigo } = req.params;
    const materialDir = path.join(UPLOADS_BASE, String(codigo));
    await ensureDir(materialDir);
    const files = await fs.readdir(materialDir);
    const pdfs = files
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .map((file, idx) => ({
        id: `${codigo}-${file}`,
        name: file,
        url: `/uploads/referencia/${codigo}/${encodeURIComponent(file)}`,
        displayName: `${idx + 1}. ${file}`
      }));
    res.json(pdfs);
  } catch (error) {
    console.error('Error al listar PDFs referencia:', error);
    res.status(500).json({ message: 'Error al listar PDFs referencia', error: error.message });
  }
};

exports.subirPdfMaterial = async (req, res) => {
  try {
    const { codigo } = req.params;
    if (!req.file) return res.status(400).json({ message: 'Archivo no proporcionado' });

    const materialDir = path.join(UPLOADS_BASE, String(codigo));
    await ensureDir(materialDir);

    const originalName = req.file.originalname || 'archivo.pdf';
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const targetPath = path.join(materialDir, safeName);
    await fs.writeFile(targetPath, req.file.buffer);

    res.status(201).json({
      message: 'PDF subido correctamente',
      file: {
        id: `${codigo}-${safeName}`,
        name: safeName,
        url: `/uploads/referencia/${codigo}/${encodeURIComponent(safeName)}`
      }
    });
  } catch (error) {
    console.error('Error al subir PDF referencia:', error);
    res.status(500).json({ message: 'Error al subir PDF referencia', error: error.message });
  }
};

exports.descargarPdf = async (req, res) => {
  try {
    const { id } = req.params; // format: codigo-filename
    const [codigo, ...fileParts] = id.split('-');
    const filename = fileParts.join('-');
    const filePath = path.join(UPLOADS_BASE, codigo, filename);
    res.download(filePath, filename, err => {
      if (err) {
        console.error('Error al descargar PDF referencia:', err);
        return res.status(404).json({ message: 'Archivo no encontrado' });
      }
    });
  } catch (error) {
    console.error('Error al descargar PDF referencia:', error);
    res.status(500).json({ message: 'Error al descargar PDF referencia', error: error.message });
  }
};

exports.eliminarPdf = async (req, res) => {
  try {
    const { id } = req.params; // format: codigo-filename
    const [codigo, ...fileParts] = id.split('-');
    const filename = fileParts.join('-');
    const filePath = path.join(UPLOADS_BASE, codigo, filename);
    await fs.unlink(filePath);
    res.json({ message: 'PDF eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar PDF referencia:', error);
    res.status(500).json({ message: 'Error al eliminar PDF referencia', error: error.message });
  }
};
