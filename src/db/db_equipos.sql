-- Esquema para la tabla de equipos
CREATE TABLE IF NOT EXISTS equipos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  modelo VARCHAR(120) NULL,
  marca VARCHAR(120) NULL,
  inventario_sena VARCHAR(120) NULL,
  acreditacion VARCHAR(40) NULL,          -- 'Si' | 'No aplica'
  tipo_manual VARCHAR(40) NULL,           -- 'Fisico' | 'Digital'
  codigo_identificacion VARCHAR(120) NULL,
  numero_serie VARCHAR(120) NULL,
  tipo VARCHAR(120) NULL,
  clasificacion VARCHAR(120) NULL,
  manual_usuario VARCHAR(40) NULL,        -- 'Si' | 'No'
  puesta_en_servicio DATE NULL,
  fecha_adquisicion DATE NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices de búsqueda útiles
CREATE INDEX IF NOT EXISTS idx_equipos_nombre ON equipos (nombre);
CREATE INDEX IF NOT EXISTS idx_equipos_codigo ON equipos (codigo_identificacion);
CREATE INDEX IF NOT EXISTS idx_equipos_numserie ON equipos (numero_serie);
