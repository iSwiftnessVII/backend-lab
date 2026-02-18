const pool = require('../config/db');

function parseIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((id) => Number(id)).filter((id) => Number.isFinite(id));
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));
  }
  if (typeof value === 'number' && Number.isFinite(value)) return [value];
  return [];
}

const notificacionesController = {
  // GET /api/notificaciones/reads?ids=1,2
  getReads: async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Token requerido' });

    const ids = parseIds(req.query?.ids);
    const params = [userId];
    let sql = 'SELECT notificacion_id FROM notificaciones_usuario WHERE usuario_id = ? AND leida = 1';

    if (ids.length) {
      sql += ` AND notificacion_id IN (${ids.map(() => '?').join(',')})`;
      params.push(...ids);
    }

    try {
      const [rows] = await pool.query(sql, params);
      res.json({ readIds: rows.map((r) => Number(r.notificacion_id)).filter((id) => Number.isFinite(id)) });
    } catch (err) {
      console.error('Error GET /notificaciones/reads:', err);
      res.status(500).json({ message: 'Error obteniendo notificaciones' });
    }
  },

  // POST /api/notificaciones/reads { ids: [1,2] }
  markReads: async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Token requerido' });

    const ids = parseIds(req.body?.ids || req.body?.notificacion_id);
    if (!ids.length) {
      return res.status(400).json({ message: 'Ids requeridos' });
    }

    const values = ids.map(() => '(?, ?, 1, CURRENT_TIMESTAMP)').join(',');
    const params = [];
    for (const id of ids) {
      params.push(userId, id);
    }

    const sql = `
      INSERT INTO notificaciones_usuario (usuario_id, notificacion_id, leida, leida_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        leida = VALUES(leida),
        leida_at = VALUES(leida_at),
        updated_at = CURRENT_TIMESTAMP
    `;

    try {
      await pool.query(sql, params);
      res.json({ ok: true, updated: ids.length });
    } catch (err) {
      console.error('Error POST /notificaciones/reads:', err);
      res.status(500).json({ message: 'Error guardando notificaciones' });
    }
  }
};

module.exports = notificacionesController;
