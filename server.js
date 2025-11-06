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

const app = express();
const port = process.env.PORT || 4000; 

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

app.get('/', (req, res) => {
  res.type('text/plain').send('Hello from app-lab-back (express)!');
});

app.listen(port, () => console.log(`✅ Server listening on port ${port}`));