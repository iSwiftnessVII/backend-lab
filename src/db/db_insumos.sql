-- =====================================
-- TABLA: Insumos
-- =====================================


CREATE TABLE catalogo_insumos (
    item INT PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    imagen MEDIUMBLOB  -- Almacenará los datos binarios de la imagen
);


CREATE TABLE insumos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_catalogo INT NOT NULL, -- Columna para referenciar el catálogo
    nombre VARCHAR(100) NOT NULL,
    cantidad_adquirida INT NOT NULL,
    cantidad_existente INT NOT NULL,
    presentacion VARCHAR(50),
    marca VARCHAR(100),
    referencia VARCHAR(20),
    descripcion TEXT,
    fecha_adquisicion DATE,
    ubicacion VARCHAR(100),
    observaciones TEXT,
    
    FOREIGN KEY (item_catalogo) REFERENCES catalogo_insumos(item)
);
