const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const pool = require("./db");


const app = express();
app.use(cors());
app.use(express.json());

// Configurar multer para subida de archivos
const upload = multer({ dest: 'uploads/' });

// Crear directorio de uploads si no existe
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

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

// Endpoint para agregar reactivos (sin hoja_seguridad)
app.post('/api/reactivos', async (req, res) => {
  try {
    const {
      codigo, reactivo, presentacion, cantidad_envase,
      fecha_adquisicion, fecha_vencimiento, tipo_id,
      clasificacion_id, unidad_id, estado_id, marca,
      lote, id_referencia, almacenamiento_id, 
      tipo_recipiente_id, observaciones
    } = req.body;

    const [result] = await pool.execute(
      `INSERT INTO reactivos 
       (codigo, reactivo, presentacion, cantidad_envase, fecha_adquisicion, fecha_vencimiento,
        tipo_id, clasificacion_id, unidad_id, estado_id, marca, lote, id_referencia,
        almacenamiento_id, tipo_recipiente_id, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        codigo, reactivo, presentacion, cantidad_envase,
        fecha_adquisicion, fecha_vencimiento, tipo_id,
        clasificacion_id, unidad_id, estado_id, marca,
        lote, id_referencia, almacenamiento_id, 
        tipo_recipiente_id, observaciones
      ]
    );

    res.json({ success: true, message: 'Reactivo agregado correctamente' });
    
  } catch (error) {
    console.error('Error al agregar reactivo:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al agregar reactivo',
      details: error.message 
    });
  }
});

// Endpoint para subir PDF y guardar en tabla pdf
app.post('/api/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    const { codigo } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }
    
    // Generar nombre único para el archivo
    const fileExtension = path.extname(file.originalname);
    const fileName = `${codigo}_${Date.now()}${fileExtension}`;
    
    // Mover archivo a ubicación final
    const finalPath = path.join(__dirname, 'uploads', fileName);
    fs.renameSync(file.path, finalPath);
    
    // Guardar en la tabla pdf
    await pool.execute(
      'INSERT INTO pdf (codigo_reactivo, hoja_seguridad) VALUES (?, ?)',
      [codigo, fileName]
    );
    
    res.json({ 
      success: true, 
      fileName: fileName,
      message: 'Archivo subido correctamente' 
    });
    
  } catch (error) {
    console.error('Error subiendo archivo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint para obtener PDFs de un reactivo
app.get('/api/reactivos/:codigo/pdf', async (req, res) => {
  try {
    const { codigo } = req.params;
    
    const [pdfs] = await pool.execute(
      'SELECT * FROM pdf WHERE codigo_reactivo = ? ORDER BY fecha_subida DESC',
      [codigo]
    );
    
    res.json({ success: true, pdfs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para servir PDFs
app.get('/pdf/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);
  
  // Verificar si el archivo existe
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Archivo no encontrado' });
  }
});

// Inicia servidor
app.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});