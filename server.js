const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Configura conexión a TiDB Cloud con SSL
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

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("✅ Servidor de inventario conectado a TiDB con SSL");
});

// Endpoint: obtener reactivos
app.get("/api/reactivos", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM reactivos");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener reactivos" });
  }
});

// Obtener tipos de reactivo
app.get("/api/tipos", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, nombre FROM tipo_reactivo");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener tipos" });
  }
});

// Obtener clasificaciones SGA
app.get("/api/clasificaciones", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, nombre FROM clasificacion_sga");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener clasificaciones" });
  }
});

// Obtener unidades
app.get("/api/unidades", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, nombre FROM unidades");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener unidades" });
  }
});

// Obtener tipos de recipiente
app.get("/api/tipos_recipiente", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, nombre FROM tipo_recipiente");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener tipos de recipiente" });
  }
});

// Obtener almacenamiento
app.get("/api/almacenamiento", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, nombre FROM almacenamiento");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener almacenamiento" });
  }
});

// Obtener estados físicos
app.get("/api/estados", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, nombre FROM estado_fisico");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener estados" });
  }
});

// Endpoint: agregar reactivo (completo con todos los campos)
app.post("/api/reactivos", async (req, res) => {
  const {
    codigo,
    reactivo,
    presentacion,
    cantidad_envase,
    fecha_adquisicion,
    fecha_vencimiento,
    tipo_id,
    clasificacion_id,
    unidad_id,
    estado_id,
    marca,
    lote,
    id_referencia,
    hoja_seguridad,
    almacenamiento_id,
    tipo_recipiente_id,
    observaciones
  } = req.body;

  

  try {
    await pool.query(
      `INSERT INTO reactivos
      (codigo, reactivo, presentacion, cantidad_envase, fecha_adquisicion, fecha_vencimiento,
       tipo_id, clasificacion_id, unidad_id, estado_id, marca, lote, id_referencia, hoja_seguridad,
       almacenamiento_id, tipo_recipiente_id, observaciones)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        codigo,
        reactivo,
        presentacion,
        cantidad_envase,
        fecha_adquisicion,
        fecha_vencimiento,
        tipo_id,
        clasificacion_id,
        unidad_id,
        estado_id,
        marca,
        lote,
        id_referencia,
        hoja_seguridad,
        almacenamiento_id,
        tipo_recipiente_id,
        observaciones
      ]
    );

    res.json({ mensaje: "Reactivo agregado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al insertar reactivo" });
  }
});

// Inicia servidor
app.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});
