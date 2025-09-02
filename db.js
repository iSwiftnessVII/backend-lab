// db.js
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

const pool = mysql.createPool({
  host: "gateway01.us-east-1.prod.aws.tidbcloud.com",
  user: "3XCNBfWUvxfEhKC.root",
  password: "ZbVKYuQq4IzITdoE",
  database: "inventario_reactivos",
  port: 4000,
  ssl: {
    ca: fs.readFileSync(path.join(__dirname, "certs", "ca.pem"))
  }
});

module.exports = pool;
