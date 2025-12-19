-- =====================================
-- CATÁLOGO PAPELERÍA (igual que catálogo insumos)
-- =====================================
CREATE TABLE catalogo_papeleria (
    item INT PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    imagen MEDIUMBLOB   -- aquí va la imagen
);

-- =====================================
-- TABLA: Papelería
-- =====================================
CREATE TABLE papeleria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_catalogo INT,  -- ahora referencia al catálogo (Opcional)
    nombre VARCHAR(100) NOT NULL,
    cantidad_adquirida INT NOT NULL,
    cantidad_existente INT NOT NULL,
    presentacion ENUM('unidad', 'paquete', 'caja', 'cajas') NOT NULL,
    marca VARCHAR(100),
    descripcion TEXT,
    fecha_adquisicion DATE,
    ubicacion VARCHAR(100),
    observaciones TEXT,
    imagen MEDIUMBLOB,

    FOREIGN KEY (item_catalogo) REFERENCES catalogo_papeleria(item)
);