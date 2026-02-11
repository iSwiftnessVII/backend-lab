const pool = require('../config/db');

const AUX_MODULES = new Set([
  'reactivos',
  'equipos',
  'referencia',
  'volumetricos',
  'insumos',
  'papeleria',
  'plantillas'
]);

function isReadMethod(method) {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

function requireAuxEdit(moduleKey) {
  return async (req, res, next) => {
    try {
      if (!moduleKey || !AUX_MODULES.has(moduleKey)) return next();
      if (!req.user || req.user.rol !== 'Auxiliar') return next();
      if (isReadMethod(req.method)) return next();

      const [rows] = await pool.query(
        'SELECT puede_editar FROM usuarios_permisos WHERE usuario_id = ? AND modulo = ? LIMIT 1',
        [req.user.id, moduleKey]
      );

      if (!rows.length) return next();
      const puedeEditar = Number(rows[0].puede_editar) === 1;
      if (puedeEditar) return next();

      return res.status(403).json({
        message: 'No tienes permisos para editar este apartado.'
      });
    } catch (err) {
      console.error('Error validando permisos auxiliar:', err);
      return res.status(500).json({ message: 'Error validando permisos auxiliar' });
    }
  };
}

module.exports = { requireAuxEdit, AUX_MODULES };
