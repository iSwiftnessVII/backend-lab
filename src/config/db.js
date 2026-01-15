const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config();

let pool;

try {
  pool = mysql.createPool({
    host: process.env.DB_HOST || process.env.HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
    connectTimeout: process.env.DB_CONNECT_TIMEOUT
      ? parseInt(process.env.DB_CONNECT_TIMEOUT, 10)
      : 10000,
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0,
  });

  console.log("Pool de conexiones creado exitosamente");
} catch (error) {
  console.error("Error al crear el pool de conexiones:", error);
  process.exit(1);
}

module.exports = pool;