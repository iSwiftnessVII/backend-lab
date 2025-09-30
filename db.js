const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

let pool;

const DB_HOST = process.env.DB_HOST || 'gateway01.us-east-1.prod.aws.tidbcloud.com';
const DB_USER = process.env.DB_USER || '3XCNBfWUvxfEhKC.root';
const DB_PASSWORD = process.env.DB_PASSWORD || 'ZbVKYuQq4IzITdoE';
const DB_NAME = process.env.DB_NAME || 'lab';
const DB_PORT = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 4000;

try {
  pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    port: DB_PORT,
    ssl: {
      ca: fs.readFileSync(path.join(__dirname, 'certs', 'ca.pem'))
    }
  });
  console.log('Pool de conexiones creado exitosamente');
} catch (error) {
  console.error('Error al crear el pool de conexiones:', error);
  process.exit(1);
}

module.exports = pool;