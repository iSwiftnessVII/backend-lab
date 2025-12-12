// referencia controller removed — stub returning 410 Gone
module.exports = (function(){
  const gone = (_req, res) => res.status(410).json({ message: 'Material referencia removed' });
  const handlers = [
    'crearMaterial','listarMateriales','obtenerMaterialCompleto','actualizarMaterial','eliminarMaterial',
    'crearHistorial','listarHistorialPorMaterial','obtenerNextHistorial','actualizarHistorial',
    'crearIntervalo','listarIntervaloPorMaterial','obtenerNextIntervalo','actualizarIntervalo',
    'listarPdfsPorMaterial','subirPdfMaterial','descargarPdf','eliminarPdf'
  ];
  const api = {};
  handlers.forEach(h => api[h] = gone);
  return api;
})();
