const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');


const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB máximo
});

// Helpers
function likeParam(q) {
  return `%${(q || '').toLowerCase()}%`;
}

// GET /api/insumos/aux
router.get('/aux', async (req, res) => {
  try {
    res.json({ 
      tipos: [], 
      clasif: [], 
      unidades: [], 
      estado: [], 
      recipiente: [], 
      almacen: [] 
    });
  } catch (err) {
    console.error('Error /aux:', err);
    res.status(500).json({ message: 'Error obteniendo datos auxiliares' });
  }
});

// ========== CATÁLOGO DE INSUMOS ==========

// GET /api/insumos/catalogo?q=&limit=&offset=
router.get('/catalogo', async (req, res) => {
  const q = (req.query.q || '').trim();
  let limit = parseInt(req.query.limit, 10);
  let offset = parseInt(req.query.offset, 10);
  
  if (isNaN(limit) || limit <= 0) limit = 0; // 0 => sin límite
  if (isNaN(offset) || offset < 0) offset = 0;
  if (limit > 500) limit = 500; // Máximo de seguridad

  try {
    const baseSelect = 'SELECT item, nombre, descripcion FROM catalogo_insumos';
    const where = q ? ' WHERE LOWER(item) LIKE ? OR LOWER(nombre) LIKE ?' : '';
    const order = ' ORDER BY item';

    if (limit > 0) {
      // Con paginación: devolver {rows, total}
      const countQuery = `SELECT COUNT(*) as total FROM catalogo_insumos${where}`;
      let totalRows;
      
      if (q) {
        [totalRows] = await pool.query(countQuery, [likeParam(q), likeParam(q)]);
      } else {
        [totalRows] = await pool.query(countQuery);
      }
      
      const total = totalRows[0]?.total || 0;
      let rows;
      
      if (q) {
        [rows] = await pool.query(
          `${baseSelect}${where}${order} LIMIT ? OFFSET ?`,
          [likeParam(q), likeParam(q), limit, offset]
        );
      } else {
        [rows] = await pool.query(
          `${baseSelect}${order} LIMIT ? OFFSET ?`,
          [limit, offset]
        );
      }
      
      return res.json({ rows, total });
    } else {
      // Sin límite: devolver solo array
      let rows;
      
      if (q) {
        [rows] = await pool.query(
          `${baseSelect}${where}${order}`,
          [likeParam(q), likeParam(q)]
        );
      } else {
        [rows] = await pool.query(`${baseSelect}${order}`);
      }
      
      return res.json(rows);
    }
  } catch (err) {
    console.error('Error GET /catalogo:', err);
    res.status(500).json({ message: 'Error buscando catálogo' });
  }
});

// GET /api/insumos/catalogo/:item
router.get('/catalogo/:item', async (req, res) => {
  const { item } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT item, nombre, descripcion FROM catalogo_insumos WHERE item = ?',
      [item]
    );
    if (!rows.length) return res.status(404).json({ message: 'No encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error GET /catalogo/:item:', err);
    res.status(500).json({ message: 'Error obteniendo catálogo' });
  }
});

// POST /api/insumos/catalogo
router.post('/catalogo', async (req, res) => {
  const { item, nombre, descripcion } = req.body || {};
  
  if (!item || !nombre) {
    return res.status(400).json({ message: 'Item y nombre son requeridos' });
  }
  
  try {
    await pool.query(
      'INSERT INTO catalogo_insumos (item, nombre, descripcion) VALUES (?, ?, ?)',
      [item, nombre, descripcion || null]
    );
    res.status(201).json({ item, nombre, descripcion: descripcion || null });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Item ya existe en catálogo' });
    }
    console.error('Error POST /catalogo:', err);
    res.status(500).json({ message: 'Error creando catálogo' });
  }
});

// PUT /api/insumos/catalogo/:item
router.put('/catalogo/:item', async (req, res) => {
  const { item } = req.params;
  const { nombre, descripcion } = req.body || {};
  
  try {
    const [result] = await pool.query(
      'UPDATE catalogo_insumos SET nombre = ?, descripcion = ? WHERE item = ?',
      [nombre || null, descripcion || null, item]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'No encontrado' });
    }
    res.json({ item, nombre: nombre || null, descripcion: descripcion || null });
  } catch (err) {
    console.error('Error PUT /catalogo/:item:', err);
    res.status(500).json({ message: 'Error actualizando catálogo' });
  }
});

// ========== INSUMOS (CRUD) ==========

// GET /api/insumos?q=&limit=
router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  let limit = parseInt(req.query.limit, 10);
  
  if (isNaN(limit) || limit <= 0) limit = 0; // 0 => sin límite
  if (limit > 500) limit = 500; // Máximo de seguridad

  try {
    if (!q) {
      if (limit > 0) {
        const [rows] = await pool.query(
          'SELECT * FROM insumos ORDER BY id DESC LIMIT ?',
          [limit]
        );
        return res.json(rows);
      } else {
        const [rows] = await pool.query('SELECT * FROM insumos ORDER BY id DESC');
        return res.json(rows);
      }
    }

    // Con búsqueda
    const searchQuery = `
      SELECT * FROM insumos
      WHERE LOWER(item) LIKE ? OR LOWER(nombre) LIKE ? OR LOWER(marca) LIKE ?
      ORDER BY id DESC
    `;

    if (limit > 0) {
      const [rows] = await pool.query(
        `${searchQuery} LIMIT ?`,
        [likeParam(q), likeParam(q), likeParam(q), limit]
      );
      return res.json(rows);
    } else {
      const [rows] = await pool.query(
        searchQuery,
        [likeParam(q), likeParam(q), likeParam(q)]
      );
      return res.json(rows);
    }
  } catch (err) {
    console.error('Error GET / (insumos):', err);
    res.status(500).json({ message: 'Error listando insumos' });
  }
});

// GET /api/insumos/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM insumos WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ message: 'No encontrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error GET /:id:', err);
    res.status(500).json({ message: 'Error obteniendo insumo' });
  }
});

// POST /api/insumos
router.post('/', async (req, res) => {
  let {
    item,
    nombre,
    cantidad_adquirida,
    cantidad_existente,
    presentacion,
    marca,
    descripcion,
    fecha_adquisicion,
    ubicacion,
    observaciones
  } = req.body || {};

  // Validar campos requeridos según tu BD
  if (!item || !nombre || cantidad_adquirida == null || cantidad_existente == null) {
    return res.status(400).json({ 
      message: 'Faltan campos requeridos: item, nombre, cantidad_adquirida, cantidad_existente' 
    });
  }

  // Asegurarse de que item sea string
  item = String(item);

  try {
    await pool.query(
      `INSERT INTO insumos (
        item, nombre, cantidad_adquirida, cantidad_existente, 
        presentacion, marca, descripcion, fecha_adquisicion, ubicacion, observaciones
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item,
        nombre,
        cantidad_adquirida,
        cantidad_existente,
        presentacion || null,
        marca || null,
        descripcion || null,
        fecha_adquisicion || null,
        ubicacion || null,
        observaciones || null
      ]
    );
    res.status(201).json({ message: 'Insumo creado correctamente' });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'El insumo ya existe' });
    }
    console.error('Error POST / (insumos):', err);
    res.status(500).json({ message: 'Error creando insumo' });
  }
});


// PUT /api/insumos/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    item,
    nombre,
    cantidad_adquirida,
    cantidad_existente,
    presentacion,
    marca,
    descripcion,
    fecha_adquisicion,
    ubicacion,
    observaciones
  } = req.body || {};

  try {
    const [result] = await pool.query(
      `UPDATE insumos SET
        item = ?, nombre = ?, cantidad_adquirida = ?, cantidad_existente = ?,
        presentacion = ?, marca = ?, descripcion = ?, fecha_adquisicion = ?,
        ubicacion = ?, observaciones = ?
      WHERE id = ?`,
      [
        item,
        nombre,
        cantidad_adquirida,
        cantidad_existente,
        presentacion || null,
        marca || null,
        descripcion || null,
        fecha_adquisicion || null,
        ubicacion || null,
        observaciones || null,
        id
      ]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'No encontrado' });
    }
    res.json({ message: 'Insumo actualizado correctamente' });
  } catch (err) {
    console.error('Error PUT /:id (insumos):', err);
    res.status(500).json({ message: 'Error actualizando insumo' });
  }
});

// DELETE /api/insumos/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM insumos WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'No encontrado' });
    }
    res.json({ message: 'Insumo eliminado correctamente' });
  } catch (err) {
    console.error('Error DELETE /:id (insumos):', err);
    res.status(500).json({ message: 'Error eliminando insumo' });
  }
});

module.exports = router;