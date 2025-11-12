const pool = require('../config/db');

const logsController = {
    // Obtener logs con filtros
    getLogs: async (req, res) => {
        try {
            const {
                page = 1,
                limit = 50,
                modulo,
                accion,
                usuario_id,
                fecha_desde,
                fecha_hasta
            } = req.query;

            const offset = (page - 1) * limit;

            let whereConditions = ['1=1'];
            let queryParams = [];

            if (modulo) {
                whereConditions.push('l.modulo = ?');
                queryParams.push(modulo);
            }

            if (accion) {
                whereConditions.push('l.accion = ?');
                queryParams.push(accion);
            }

            if (usuario_id) {
                whereConditions.push('l.usuario_id = ?');
                queryParams.push(usuario_id);
            }

            if (fecha_desde) {
                whereConditions.push('l.fecha >= ?');
                queryParams.push(fecha_desde);
            }

            if (fecha_hasta) {
                whereConditions.push('l.fecha <= ?');
                queryParams.push(fecha_hasta);
            }

            // Consulta principal con JOIN para obtener email de usuario
            const [logs] = await pool.query(
                `SELECT l.*, u.email as usuario_email
   FROM logs_acciones l
   LEFT JOIN usuarios u ON l.usuario_id = u.id_usuario
   WHERE ${whereConditions.join(' AND ')}
   ORDER BY l.fecha DESC
   LIMIT ? OFFSET ?`,
                [...queryParams, parseInt(limit), offset]
            );

            // Contar total para paginación
            const [total] = await pool.query(
                `SELECT COUNT(*) as total 
                 FROM logs_acciones l
                 WHERE ${whereConditions.join(' AND ')}`,
                queryParams
            );

            res.json({
                success: true,
                data: logs,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: total[0].total,
                    pages: Math.ceil(total[0].total / limit)
                }
            });

        } catch (error) {
            console.error('Error obteniendo logs:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    },

    // Obtener movimientos de inventario
    getMovimientosInventario: async (req, res) => {
        try {
            const {
                page = 1,
                limit = 50,
                producto_tipo,
                tipo_movimiento,
                fecha_desde,
                fecha_hasta
            } = req.query;

            const offset = (page - 1) * limit;

            let whereConditions = ['1=1'];
            let queryParams = [];

            if (producto_tipo) {
                whereConditions.push('mi.producto_tipo = ?');
                queryParams.push(producto_tipo);
            }

            if (tipo_movimiento) {
                whereConditions.push('mi.tipo_movimiento = ?');
                queryParams.push(tipo_movimiento);
            }

            if (fecha_desde) {
                whereConditions.push('mi.fecha >= ?');
                queryParams.push(fecha_desde);
            }

            if (fecha_hasta) {
                whereConditions.push('mi.fecha <= ?');
                queryParams.push(fecha_hasta);
            }

            const [movimientos] = await pool.query(
                `SELECT mi.*, u.email as usuario_nombre
   FROM movimientos_inventario mi
   LEFT JOIN usuarios u ON mi.usuario_id = u.id_usuario
   WHERE ${whereConditions.join(' AND ')}
   ORDER BY mi.fecha DESC
   LIMIT ? OFFSET ?`,
                [...queryParams, parseInt(limit), offset]
            );

            const [total] = await pool.query(
                `SELECT COUNT(*) as total 
                 FROM movimientos_inventario mi
                 WHERE ${whereConditions.join(' AND ')}`,
                queryParams
            );

            res.json({
                success: true,
                data: movimientos,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: total[0].total,
                    pages: Math.ceil(total[0].total / limit)
                }
            });

        } catch (error) {
            console.error('Error obteniendo movimientos:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    },

    // Obtener estadísticas de logs
    getEstadisticasLogs: async (req, res) => {
        try {
            const [estadisticas] = await pool.query(`
                SELECT 
                    COUNT(*) as total_acciones,
                    COUNT(DISTINCT usuario_id) as usuarios_activos,
                    modulo,
                    COUNT(*) as cantidad
                FROM logs_acciones 
                WHERE fecha >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY modulo
                ORDER BY cantidad DESC
            `);

            const [accionesFrecuentes] = await pool.query(`
                SELECT 
                    accion,
                    COUNT(*) as cantidad
                FROM logs_acciones 
                WHERE fecha >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                GROUP BY accion
                ORDER BY cantidad DESC
                LIMIT 10
            `);

            res.json({
                success: true,
                data: {
                    estadisticas,
                    accionesFrecuentes
                }
            });

        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
};

module.exports = logsController;