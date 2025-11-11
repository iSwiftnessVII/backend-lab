const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

let pool;

try {
  pool = mysql.createPool({
    host: process.env.HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    // IMPORTANT: use a dedicated DB port env (DB_PORT) and do NOT reuse PORT (server port)
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 4000,
    ssl: {
      ca: fs.readFileSync(path.join(__dirname, "certs", "ca.pem")),
    },
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0,
  });

  console.log("Pool de conexiones creado exitosamente");
} catch (error) {
  console.error("Error al crear el pool de conexiones:", error);
  process.exit(1);
}

// Auto-create materiales_volumetricos table if missing (idempotent)
(async () => {
  try {
    const createSql = `CREATE TABLE IF NOT EXISTS materiales_volumetricos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      item INT NOT NULL,
      nombre_material VARCHAR(100) NOT NULL,
      clase VARCHAR(100),
      marca VARCHAR(100),
      referencia VARCHAR(100),
      fecha_adquisicion DATE,
      cantidad INT,
      codigo_calibrado VARCHAR(100),
      fecha_calibracion DATE,
      codigo_en_uso VARCHAR(100),
      codigo_fuera_de_uso VARCHAR(100),
      observaciones TEXT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
    await pool.query(createSql);
    console.log('[DB] Tabla materiales_volumetricos verificada/creada');
  } catch (e) {
    console.error('[DB] Error creando/verificando tabla materiales_volumetricos:', e.message);
  }
})();

module.exports = pool;
