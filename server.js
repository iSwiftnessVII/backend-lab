require('dotenv').config();

const express = require('express');
const cors = require('cors');
require('./src/config/db');

const authRoutes = require('./src/routes/auth');
const solicitudesRoutes = require('./src/routes/solicitudes');
const reactivosRoutes = require('./src/routes/reactivos');
const insumosRoutes = require('./src/routes/insumos');
const papeleriaRoutes = require('./src/routes/papeleria');
const usuariosRoutes = require('./src/routes/usuarios');
const equiposRoutes = require('./src/routes/equipos');
const dashboardRoutes = require('./src/routes/dashboard');
const materialesVolRoutes = require('./src/routes/materialesVolumetricos');
const logsRoutes = require('./src/routes/logs');
const reportesRoutes = require('./src/routes/reportes');

const app = express();
let desiredPort = parseInt(process.env.PORT, 10) || 4000;

// CORS más permisivo para desarrollo
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:4000', 'http://localhost:4200'],
  credentials: true
}));

app.use(express.json());

// Log de todas las peticiones para debug
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/solicitudes', solicitudesRoutes);
app.use('/api/reactivos', reactivosRoutes);
app.use('/api/insumos', insumosRoutes);
app.use('/api/papeleria', papeleriaRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/equipos', equiposRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/materiales-volumetricos', materialesVolRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/reportes', reportesRoutes);

function logEquiposRoutes() {
  try {
    const stack = equiposRoutes.stack || [];
    console.log('🔎 Rutas /api/equipos registradas:');
    stack.forEach(l => {
      if (l.route) {
        const methods = Object.keys(l.route.methods).map(m => m.toUpperCase()).join(',');
        console.log(`  ${methods} ${'/api/equipos' + l.route.path}`);
      }
    });
  } catch (e) {
    console.log('No se pudieron listar rutas de equipos', e);
  }
}

function start(port, attempt = 1) {
  const server = app.listen(port, () => {
    console.log(`✅ Server listening on port ${port}`);
    logEquiposRoutes();
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`⚠️  Puerto ${port} en uso. Intento ${attempt}.`);
      if (attempt < 3) {
        const nextPort = port + 1;
        console.log(`🔁 Reintentando en puerto ${nextPort}...`);
        start(nextPort, attempt + 1);
      } else {
        console.error('❌ No se pudo iniciar el servidor tras varios intentos. Libera el puerto o configura PORT.');
      }
    } else {
      console.error('❌ Error iniciando servidor:', err);
    }
  });
}

start(desiredPort);
