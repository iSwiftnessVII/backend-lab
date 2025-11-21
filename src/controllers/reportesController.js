// backend/controllers/reportesController.js
const pool = require('../config/db');

const reportesController = {
  // Reporte de Inventario - Estado actual de todos los productos
  getInventario: async (req, res) => {
    // Verificar rol Administrador
    if (req.user.rol !== 'Administrador') {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere rol Administrador' });
    }
    
    try {
      const query = `
        -- Insumos
        SELECT 
          'INSUMO' as tipo_producto,
          id as id_producto,
          nombre,
          cantidad_existente as cantidad,
          presentacion,
          marca,
          referencia,
          fecha_adquisicion,
          ubicacion,
          NULL as fecha_vencimiento
        FROM insumos
        WHERE cantidad_existente > 0
        
        UNION ALL
        
        -- Reactivos
        SELECT 
          'REACTIVO' as tipo_producto,
          lote as id_producto,
          nombre,
          cantidad_total as cantidad,
          CONCAT(presentacion, ' ', presentacion_cant) as presentacion,
          marca,
          referencia,
          fecha_adquisicion,
          NULL as ubicacion,
          fecha_vencimiento
        FROM reactivos
        WHERE cantidad_total > 0
        
        UNION ALL
        
        -- Papelería
        SELECT 
          'PAPELERIA' as tipo_producto,
          id as id_producto,
          nombre,
          cantidad_existente as cantidad,
          presentacion,
          marca,
          NULL as referencia,
          fecha_adquisicion,
          ubicacion,
          NULL as fecha_vencimiento
        FROM papeleria
        WHERE cantidad_existente > 0
        
        UNION ALL
        
        -- Materiales Volumétricos
        SELECT 
          'MATERIAL_VOLUMETRICO' as tipo_producto,
          id as id_producto,
          nombre_material as nombre,
          cantidad,
          clase as presentacion,
          marca,
          referencia,
          fecha_adquisicion,
          NULL as ubicacion,
          NULL as fecha_vencimiento
        FROM materiales_volumetricos
        WHERE cantidad > 0
        
        UNION ALL
        
        -- Equipos
        SELECT 
          'EQUIPO' as tipo_producto,
          id as id_producto,
          nombre,
          1 as cantidad,  -- Cada equipo cuenta como 1
          modelo as presentacion,
          marca,
          numero_serie as referencia,
          fecha_adquisicion,
          NULL as ubicacion,
          NULL as fecha_vencimiento
        FROM equipos
        ORDER BY tipo_producto, nombre
      `;
      
      const [results] = await pool.query(query);
      res.json(results);
    } catch (error) {
      console.error('Error en reporte de inventario:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Reporte de Entradas
  getEntradas: async (req, res) => {
    // Verificar rol Administrador
    if (req.user.rol !== 'Administrador') {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere rol Administrador' });
    }
    
    try {
      const { fecha_desde, fecha_hasta } = req.query;
      
      let whereClause = "WHERE tipo_movimiento = 'ENTRADA'";
      const params = [];
      
      if (fecha_desde && fecha_hasta) {
        whereClause += " AND DATE(fecha) BETWEEN ? AND ?";
        params.push(fecha_desde, fecha_hasta);
      }
      
      const query = `
        SELECT 
          id_movimiento,
          producto_tipo,
          producto_referencia,
          usuario_id,
          fecha,
          tipo_movimiento
        FROM movimientos_inventario
        ${whereClause}
        ORDER BY fecha DESC
      `;
      
      const [results] = await pool.query(query, params);
      res.json(results);
    } catch (error) {
      console.error('Error en reporte de entradas:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Reporte de Salidas
  getSalidas: async (req, res) => {
    // Verificar rol Administrador
    if (req.user.rol !== 'Administrador') {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere rol Administrador' });
    }
    
    try {
      const { fecha_desde, fecha_hasta } = req.query;
      
      let whereClause = "WHERE tipo_movimiento = 'SALIDA'";
      const params = [];
      
      if (fecha_desde && fecha_hasta) {
        whereClause += " AND DATE(fecha) BETWEEN ? AND ?";
        params.push(fecha_desde, fecha_hasta);
      }
      
      const query = `
        SELECT 
          id_movimiento,
          producto_tipo,
          producto_referencia,
          usuario_id,
          fecha,
          tipo_movimiento
        FROM movimientos_inventario
        ${whereClause}
        ORDER BY fecha DESC
      `;
      
      const [results] = await pool.query(query, params);
      res.json(results);
    } catch (error) {
      console.error('Error en reporte de salidas:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Reporte de Vencimientos
  getVencimientos: async (req, res) => {
    // Verificar rol Administrador
    if (req.user.rol !== 'Administrador') {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere rol Administrador' });
    }
    
    try {
      const { dias = 30 } = req.query;
      const diasInt = parseInt(dias);
      
      const query = `
        SELECT 
          lote as id_producto,
          codigo,
          nombre,
          marca,
          referencia,
          presentacion,
          presentacion_cant,
          cantidad_total,
          fecha_adquisicion,
          fecha_vencimiento,
          DATEDIFF(fecha_vencimiento, CURDATE()) as dias_restantes
        FROM reactivos
        WHERE fecha_vencimiento IS NOT NULL 
          AND fecha_vencimiento >= CURDATE()
          AND fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
          AND cantidad_total > 0
        ORDER BY fecha_vencimiento ASC
      `;
      
      const [results] = await pool.query(query, [diasInt]);
      res.json(results);
    } catch (error) {
      console.error('Error en reporte de vencimientos:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
};

module.exports = reportesController;