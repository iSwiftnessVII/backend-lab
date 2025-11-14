const db = require('../config/db');

module.exports = {
  async listar(req, res){
    try {
      const [rows] = await db.query('SELECT * FROM materiales_volumetricos ORDER BY id DESC');
      res.json(rows);
    } catch (e){ res.status(500).json({ message: e.message || 'Error listando materiales' }); }
  },
  async obtener(req, res){
    try {
      const id = parseInt(req.params.id, 10);
      const [rows] = await db.query('SELECT * FROM materiales_volumetricos WHERE id = ?', [id]);
      if (!rows.length) return res.status(404).json({ message: 'No encontrado' });
      res.json(rows[0]);
    } catch (e){ res.status(500).json({ message: e.message || 'Error obteniendo material' }); }
  },
  async crear(req, res){
    try {
      const {
        item,
        nombre_material,
        clase,
        marca,
        referencia,
        fecha_adquisicion,
        cantidad,
        codigo_calibrado,
        fecha_calibracion,
        codigo_en_uso,
        codigo_fuera_de_uso,
        observaciones
      } = req.body || {};
      if (!item || !nombre_material) return res.status(400).json({ message: 'item y nombre_material son requeridos' });
      // Normalizar fechas a YYYY-MM-DD o null
      const normDate = (d) => {
        if (!d) return null;
        try { const t = new Date(d); if (isNaN(t.getTime())) return null; return t.toISOString().slice(0,10); } catch { return null; }
      };
      const [result] = await db.query(
        `INSERT INTO materiales_volumetricos (item, nombre_material, clase, marca, referencia, fecha_adquisicion, cantidad, codigo_calibrado, fecha_calibracion, codigo_en_uso, codigo_fuera_de_uso, observaciones)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [item, nombre_material, clase || null, marca || null, referencia || null, normDate(fecha_adquisicion), cantidad || null, codigo_calibrado || null, normDate(fecha_calibracion), codigo_en_uso || null, codigo_fuera_de_uso || null, observaciones || null]
      );
      
      // REGISTRO DE LOG - Con req.user.id
      if (req.user && req.user.id) {
        await db.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
          [req.user.id, 'CREAR', 'MATERIALES_VOLUMETRICOS']
        );

        // REGISTRO DE MOVIMIENTO
        await db.query(
          'INSERT INTO movimientos_inventario (producto_tipo, producto_referencia, usuario_id, tipo_movimiento) VALUES (?, ?, ?, ?)',
          ['EQUIPO', result.insertId.toString(), req.user.id, 'ENTRADA']
        );
      }

      res.status(201).json({ id: result.insertId });
    } catch (e){ res.status(500).json({ message: e.message || 'Error creando material' }); }
  },
  async actualizar(req, res){
    try {
      const id = parseInt(req.params.id, 10);
      const body = req.body || {};
      const [result] = await db.query('UPDATE materiales_volumetricos SET ? WHERE id = ?', [body, id]);
      
      // REGISTRO DE LOG - Con req.user.id
      if (req.user && req.user.id) {
        await db.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
          [req.user.id, 'ACTUALIZAR', 'MATERIALES_VOLUMETRICOS']
        );
      }

      res.json({ affectedRows: result.affectedRows });
    } catch (e){ res.status(500).json({ message: e.message || 'Error actualizando material' }); }
  },
  async eliminar(req, res){
    try {
      const id = parseInt(req.params.id, 10);
      const [result] = await db.query('DELETE FROM materiales_volumetricos WHERE id = ?', [id]);
      
      // REGISTRO DE LOG - Con req.user.id
      if (req.user && req.user.id) {
        await db.query(
          'INSERT INTO logs_acciones (usuario_id, accion, modulo) VALUES (?, ?, ?)',
          [req.user.id, 'ELIMINAR', 'MATERIALES_VOLUMETRICOS']
        );
      }

      res.json({ affectedRows: result.affectedRows });
    } catch (e){ res.status(500).json({ message: e.message || 'Error eliminando material' }); }
  }
};