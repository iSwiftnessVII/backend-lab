-- Tabla para PDFs de Certificado de Análisis (CoA) por LOTE de REACTIVOS
-- Nota: la tabla existente `cert_analisis` en esta BD está ligada a SOLICITUDES (id_solicitud),
-- por eso el backend de Reactivos usa esta tabla separada.

CREATE TABLE IF NOT EXISTS cert_analisis_reactivos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  lote VARCHAR(30) NOT NULL UNIQUE,
  certificado_analisis VARCHAR(255) NOT NULL,
  fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  contenido_pdf LONGBLOB,
  FOREIGN KEY (lote) REFERENCES reactivos(lote) ON DELETE CASCADE
);
