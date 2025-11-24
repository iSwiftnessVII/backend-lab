
CREATE DATABASE IF NOT EXISTS lab;
USE lab;

CREATE TABLE IF NOT EXISTS tipo_reactivo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS clasificacion_sga (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS unidades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS estado_fisico (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tipo_recipiente (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS almacenamiento (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL
);


CREATE TABLE IF NOT EXISTS catalogo_reactivos (
    codigo VARCHAR(10) PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    tipo_reactivo VARCHAR(50) NOT NULL,
    clasificacion_sga VARCHAR(100) NOT NULL,
    descripcion TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS reactivos (
    lote VARCHAR(30) PRIMARY KEY,                  
    codigo VARCHAR(10) NOT NULL,                   
    nombre VARCHAR(200) NOT NULL,                  
    marca VARCHAR(50) NOT NULL,                    
    referencia VARCHAR(100),
    cas VARCHAR (50),                              
    presentacion DECIMAL(10,2) NOT NULL,           
    presentacion_cant DECIMAL(10,2) NOT NULL,      
    cantidad_total DECIMAL(10,2) NOT NULL,         
    fecha_adquisicion DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    observaciones TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Foreign Keys
    tipo_id INT NOT NULL,
    clasificacion_id INT NOT NULL,
    unidad_id INT NOT NULL,
    estado_id INT NOT NULL,
    almacenamiento_id INT NOT NULL,
    tipo_recipiente_id INT NOT NULL,

    FOREIGN KEY (codigo) REFERENCES catalogo_reactivos(codigo),
    FOREIGN KEY (tipo_id) REFERENCES tipo_reactivo(id),
    FOREIGN KEY (clasificacion_id) REFERENCES clasificacion_sga(id),
    FOREIGN KEY (unidad_id) REFERENCES unidades(id),
    FOREIGN KEY (estado_id) REFERENCES estado_fisico(id),
    FOREIGN KEY (almacenamiento_id) REFERENCES almacenamiento(id),
    FOREIGN KEY (tipo_recipiente_id) REFERENCES tipo_recipiente(id),

    UNIQUE (codigo, lote)
);


CREATE TABLE IF NOT EXISTS hoja_seguridad (
    id INT PRIMARY KEY AUTO_INCREMENT,
    lote VARCHAR(30) NOT NULL,                      -- ahora se relaciona con el lote del reactivo
    hoja_seguridad VARCHAR(255) NOT NULL,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    contenido_pdf LONGBLOB,

    FOREIGN KEY (lote) REFERENCES reactivos(lote) ON DELETE CASCADE,
    UNIQUE (lote)
);


CREATE TABLE IF NOT EXISTS cert_analisis (
    id INT PRIMARY KEY AUTO_INCREMENT,
    lote VARCHAR(30) NOT NULL,                      -- ahora se relaciona con el lote del reactivo
    certificado_analisis VARCHAR(255) NOT NULL,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    contenido_pdf LONGBLOB,

    FOREIGN KEY (lote) REFERENCES reactivos(lote) ON DELETE CASCADE,
    UNIQUE (lote)
);



INSERT IGNORE INTO tipo_reactivo (nombre) VALUES ('Controlado'), ('No controlado');

INSERT IGNORE INTO clasificacion_sga (nombre) VALUES 
    ('Irritación cutánea y otros'),
    ('Inflamables'),
    ('Corrosivo'),
    ('Peligro para la respiración'),
    ('No peligro'),
    ('Tóxico'),
    ('Peligro para el medio ambiente'),
    ('Comburente');


    IRRITACIÓN CUTÁNEA Y OTROS, #4A90D9
    INFLAMABLES, #FF0000
    CORROSIVO, #FEC720
    PELIGRO PARA LA RESPIRACIÓN, #792C9B
    NO PELIGRO, #D9D9D9
    TÓXICO, #00B050
    PELIGRO PARA EL MEDIO AMBIENTE, #792C9B
    COMBURENTE, #FFFF00


INSERT IGNORE INTO unidades (nombre) VALUES ('mL'), ('g'), ('uL'), ('nmol'), ('umol'), ('mg'), ('Unidad');

INSERT IGNORE INTO estado_fisico (nombre) VALUES ('Liquido'), ('Solido'), ('Viscoso'), ('Gas');

INSERT IGNORE INTO tipo_recipiente (nombre) VALUES ('Vidrio'), ('Plástico'), ('Metalico');

insert into almacenamiento (nombre) values ('No aplica');
INSERT IGNORE INTO almacenamiento (nombre) VALUES 
    ('Nevera Quimica- Nivel 1'),
    ('Nevera Quimica- Nivel 2'),
    ('Nevera Quimica- Nivel 3'),
    ('Nevera Quimica- Nivel 4'),
    ('Nevera Quimica- Nivel 5'),
    ('Nevera Quimica- Nivel 6'),
    ('Nevera Quimica (Puerta)'),
    ('Nevera MB- Puerta Izquierda'),
    ('Nevera MB- Medios Liquidos'),
    ('Nevera MB- Puerta Derecha N2'),
    ('Nevera MB- Puerta Derecha N4'),
    ('Nevera MB-API'),
    ('Gabinete Amarillo- Nivel 1'),
    ('Gabinete Amarillo- Nivel 2'),
    ('Gabinete Amarillo- Nivel 3'),
    ('Gabinete Amarillo- Nivel 4'),
    ('Gabinete Azul- Nivel 1'),
    ('Gabinete Azul- Nivel 2'),
    ('Gabinete Azul- Nivel 3'),
    ('Gabinete Azul- Nivel 4'),
    ('Gabinete Azul- Nivel 5'),
    ('Estanteria B3- Nivel 1'),
    ('Estanteria B3- Nivel 2'),
    ('Estanteria B3- Nivel 3'),
    ('Estanteria B3- Nivel 4'),
    ('Estanteria B3- Nivel 5'),
    ('Estanteria D1- Nivel 1'),
    ('Estanteria D1- Nivel 2'),
    ('Estanteria D1- Nivel 3'),
    ('Estanteria D1- Nivel 4'),
    ('Estanteria D1- Nivel 5');
