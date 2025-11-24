const pool = require('../config/db');

const dashboardController = {
  // Métricas principales (totales)
  getMetricasPrincipales: async (req, res) => {
    try {
      // Ejecutar consultas en paralelo para mejor performance
      const [
        totalInsumos,
        totalReactivos,
        totalSolicitudes,
        totalClientes,
        totalPapeleriaCatalogo
      ] = await Promise.all([
        // Total insumos
        pool.query('SELECT COUNT(*) as total FROM insumos'),
        
        // Total reactivos  
        pool.query('SELECT COUNT(*) as total FROM reactivos'),
        
        // Total solicitudes
        pool.query('SELECT COUNT(*) as total FROM Solicitudes'),
        
        // Total clientes activos
        pool.query('SELECT COUNT(*) as total FROM clientes WHERE activo = 1'),

        // Total papeleria (inventario)
        pool.query('SELECT COUNT(*) as total FROM papeleria')

      ]);

      res.json({
        totalInsumos: totalInsumos[0][0].total,
        totalReactivos: totalReactivos[0][0].total,
        totalSolicitudes: totalSolicitudes[0][0].total,
        totalClientes: totalClientes[0][0].total,
        totalPapeleria: totalPapeleriaCatalogo[0][0].total
      });

    } catch (err) {
      console.error('Error en getMetricasPrincipales:', err);
      res.status(500).json({ message: 'Error obteniendo métricas principales' });
    }
  },

  // Reactivos próximos a vencer (30 días)
  getReactivosProximosVencer: async (req, res) => {
    try {
      const [reactivos] = await pool.query(
        `SELECT lote, codigo, nombre, fecha_vencimiento 
         FROM reactivos 
         WHERE fecha_vencimiento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
         ORDER BY fecha_vencimiento ASC`
      );
      res.json(reactivos);
    } catch (err) {
      console.error('Error en getReactivosProximosVencer:', err);
      res.status(500).json({ message: 'Error obteniendo reactivos próximos a vencer' });
    }
  }
};

module.exports = dashboardController;