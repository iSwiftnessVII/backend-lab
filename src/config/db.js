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

module.exports = pool;
