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
const ADMIN_MODULES = new Set([
  'auditoria'
]);

function isReadMethod(method) {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

async function hasModuleEnabled(userId, moduleKey) {
  const [rows] = await pool.query(
    'SELECT puede_editar FROM usuarios_permisos WHERE usuario_id = ? AND modulo = ? LIMIT 1',
    [userId, moduleKey]
  );
  if (!rows.length) return true;
  return Number(rows[0].puede_editar) === 1;
}

function requireAuxEdit(moduleKey) {
  return async (req, res, next) => {
    try {
      if (!moduleKey || !AUX_MODULES.has(moduleKey)) return next();
      if (!req.user || req.user.rol !== 'Auxiliar') return next();
      if (isReadMethod(req.method)) return next();

      const puedeEditar = await hasModuleEnabled(req.user.id, moduleKey);
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

function requireAdminAccess(moduleKey) {
  return async (req, res, next) => {
    try {
      if (!moduleKey || !ADMIN_MODULES.has(moduleKey)) return next();
      if (!req.user) return res.status(401).json({ message: 'Token requerido' });
      if (req.user.rol === 'Superadmin') return next();
      if (req.user.rol !== 'Administrador') return res.status(403).json({ message: 'No autorizado' });

      const canAccess = await hasModuleEnabled(req.user.id, moduleKey);
      if (canAccess) return next();

      return res.status(403).json({
        message: 'No tienes permisos para acceder a este apartado.'
      });
    } catch (err) {
      console.error('Error validando permisos administrador:', err);
      return res.status(500).json({ message: 'Error validando permisos administrador' });
    }
  };
}

module.exports = { requireAuxEdit, requireAdminAccess, AUX_MODULES, ADMIN_MODULES };
