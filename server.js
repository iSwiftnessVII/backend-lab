require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('./src/config/db');

// Importar rutas
const authRoutes = require('./src/routes/auth');
const solicitudesRoutes = require('./src/routes/solicitudes');
const reactivosRoutes = require('./src/routes/reactivos');
const insumosRoutes = require('./src/routes/insumos');
const papeleriaRoutes = require('./src/routes/papeleria');
const usuariosRoutes = require('./src/routes/usuarios');
const dashboardRoutes = require('./src/routes/dashboard');
const logsRoutes = require('./src/routes/logs');
const reportesRoutes = require('./src/routes/reportes');
const equiposRoutes = require('./src/routes/equipos');


const app = express();
const PORT = parseInt(process.env.PORT, 10) || 4000;
const MAX_PORT_ATTEMPTS = 5;

// Configuración de CORS
const corsOptions = {
  origin: function (origin, callback) {
    // Lista de orígenes permitidos
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:4000', 
      'http://localhost:4200',
      // Agregar aquí otros orígenes en producción
      process.env.FRONTEND_URL
    ].filter(Boolean);

    // En desarrollo, permitir cualquier origen
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    // En producción, verificar el origen
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Middlewares de seguridad y rendimiento
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(compression());
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Límites diferentes para prod/dev
  message: {
    error: 'Demasiadas peticiones desde esta IP, intenta nuevamente en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing con límites
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ error: 'JSON malformado' });
      throw new Error('JSON malformado');
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging mejorado
app.use((req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logMessage = `${timestamp} - ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms - IP: ${req.ip} - User-Agent: ${req.get('User-Agent') || 'Unknown'}`;
    
    if (res.statusCode >= 400) {
      console.error('❌ ' + logMessage);
    } else {
      console.log('✅ ' + logMessage);
    }
  });

  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/solicitudes', solicitudesRoutes);
app.use('/api/reactivos', reactivosRoutes);
app.use('/api/insumos', insumosRoutes);
app.use('/api/papeleria', papeleriaRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/equipos', equiposRoutes);


// Ruta de bienvenida
app.get('/', (req, res) => {
  res.json({
    message: 'API del Laboratorio - Servidor funcionando correctamente',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      solicitudes: '/api/solicitudes',
      reactivos: '/api/reactivos',
      insumos: '/api/insumos',
      papeleria: '/api/papeleria',
      usuarios: '/api/usuarios',
      dashboard: '/api/dashboard',
      logs: '/api/logs',
      reportes: '/api/reportes'
    }
  });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Manejo global de errores
app.use((error, req, res, next) => {
  console.error('🔥 Error global:', error);

  // Errores de CORS
  if (error.message === 'No permitido por CORS') {
    return res.status(403).json({
      error: 'Origen no permitido',
      message: 'El dominio desde el que intentas acceder no está autorizado'
    });
  }

  // Errores de JSON malformado
  if (error.message === 'JSON malformado') {
    return res.status(400).json({
      error: 'JSON malformado',
      message: 'El cuerpo de la solicitud contiene JSON inválido'
    });
  }

  // Error genérico del servidor
  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'production' 
      ? 'Ha ocurrido un error inesperado' 
      : error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Función mejorada para iniciar el servidor
function startServer(port = PORT, attempt = 1) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port)
      .once('listening', () => {
        console.log(`🎉 Servidor iniciado exitosamente!`);
        console.log(`📍 Puerto: ${port}`);
        console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🕒 Hora: ${new Date().toISOString()}`);
        console.log(`🔗 URL: http://localhost:${port}`);
        resolve(server);
      })
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`⚠️  Puerto ${port} está en uso. Intento ${attempt} de ${MAX_PORT_ATTEMPTS}`);
          
          if (attempt < MAX_PORT_ATTEMPTS) {
            const nextPort = port + 1;
            console.log(`🔄 Intentando con puerto ${nextPort}...`);
            setTimeout(() => {
              startServer(nextPort, attempt + 1)
                .then(resolve)
                .catch(reject);
            }, 1000);
          } else {
            reject(new Error(`No se pudo iniciar el servidor después de ${MAX_PORT_ATTEMPTS} intentos. Puertos ${PORT}-${PORT + MAX_PORT_ATTEMPTS - 1} están en uso.`));
          }
        } else {
          reject(new Error(`Error al iniciar el servidor: ${err.message}`));
        }
      });
  });
}

// Manejo graceful de shutdown
function setupGracefulShutdown(server) {
  const shutdown = (signal) => {
    console.log(`\n📢 Recibida señal ${signal}. Cerrando servidor...`);
    
    server.close((err) => {
      if (err) {
        console.error('❌ Error cerrando servidor:', err);
        process.exit(1);
      }
      
      console.log('✅ Servidor cerrado exitosamente.');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error('⚠️  Forzando cierre del servidor...');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Iniciar la aplicación
if (require.main === module) {
  startServer()
    .then(server => {
      setupGracefulShutdown(server);
    })
    .catch(error => {
      console.error('💥 Error crítico al iniciar el servidor:', error.message);
      process.exit(1);
    });
}

module.exports = app;