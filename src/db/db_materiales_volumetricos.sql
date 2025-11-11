CREATE TABLE IF NOT EXISTS materiales_volumetricos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item INT NOT NULL,
    nombre_material VARCHAR(100) NOT NULL,
    clase VARCHAR(100),
    marca VARCHAR(100),
    referencia VARCHAR(100),
    fecha_adquisicion DATE,
    cantidad INT,
    codigo_calibrado VARCHAR(100),
    fecha_calibracion DATE,
    codigo_en_uso VARCHAR(100),
    codigo_fuera_de_uso VARCHAR(100),
    observaciones TEXT
);
