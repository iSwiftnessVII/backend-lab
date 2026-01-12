-- Tabla para PDFs de Hoja de Seguridad (SDS) por LOTE de REACTIVOS

CREATE TABLE IF NOT EXISTS hoja_seguridad_reactivos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  lote VARCHAR(30) NOT NULL UNIQUE,
  nombre_archivo VARCHAR(255) NOT NULL,
  fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  contenido_pdf LONGBLOB,
  FOREIGN KEY (lote) REFERENCES reactivos(lote) ON DELETE CASCADE
);
