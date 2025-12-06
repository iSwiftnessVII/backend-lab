
CREATE TABLE departamentos (
    codigo VARCHAR(10) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);


CREATE TABLE ciudades (
    codigo VARCHAR(10) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    codigo_departamento VARCHAR(10) NOT NULL,
    FOREIGN KEY (codigo_departamento) REFERENCES departamentos(codigo)
);


CREATE TABLE clientes (
    id_cliente INT AUTO_INCREMENT PRIMARY KEY,
    numero INT NOT NULL UNIQUE,
    fecha_vinculacion DATE NOT NULL,
    tipo_usuario ENUM('Emprendedor', 'Persona Natural', 'Persona Jurídica', 'Aprendiz SENA', 'Instructor SENA', 'Centros SENA') NOT NULL,
    razon_social VARCHAR(255),
    nit VARCHAR(50),
    nombre_solicitante VARCHAR(255) NOT NULL,
    tipo_identificacion ENUM('CC', 'TI', 'CE', 'NIT', 'PASAPORTE', 'OTRO') NOT NULL,
    numero_identificacion VARCHAR(50) NOT NULL UNIQUE,
    sexo ENUM('M', 'F', 'Otro') NOT NULL,
    tipo_poblacion VARCHAR(100),
    direccion VARCHAR(255),
    id_ciudad VARCHAR(10),  -- Debe coincidir con ciudades.codigo
    id_departamento VARCHAR(10),  -- Debe coincidir con departamentos.codigo
    celular VARCHAR(20),
    telefono VARCHAR(20),
    correo_electronico VARCHAR(255),
    tipo_vinculacion VARCHAR(100),
    registro_realizado_por VARCHAR(255),
    observaciones TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_ciudad) REFERENCES ciudades(codigo) ON DELETE RESTRICT,
    FOREIGN KEY (id_departamento) REFERENCES departamentos(codigo) ON DELETE RESTRICT
);


CREATE TABLE Solicitudes (
    solicitud_id INT NOT NULL PRIMARY KEY,
    id_cliente INT NOT NULL,
    tipo_solicitud VARCHAR(100),
    nombre_muestra VARCHAR(255),
    fecha_solicitud DATE,
    lote_producto VARCHAR(100),
    fecha_vencimiento_muestra DATE,
    tipo_muestra VARCHAR(100),
    tipo_empaque VARCHAR(100),
    analisis_requerido VARCHAR(255),
    req_analisis BOOLEAN,
    cant_muestras INT,
    solicitud_recibida VARCHAR(255),
    fecha_entrega_muestra DATE,
    recibe_personal VARCHAR(255),
    cargo_personal VARCHAR(100),
    observaciones TEXT,


    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE RESTRICT,
);

CREATE TABLE oferta (
    id_oferta INT AUTO_INCREMENT PRIMARY KEY,
    id_solicitud INT,
    genero_cotizacion BOOLEAN,
    valor_cotizacion DECIMAL(15,2),
    fecha_envio_oferta DATE,
    realizo_seguimiento_oferta BOOLEAN,
    observacion_oferta TEXT,

    FOREIGN KEY (id_solicitud) REFERENCES Solicitudes(solicitud_id) ON DELETE CASCADE
);

CREATE TABLE revision_oferta (
    id_revision INT AUTO_INCREMENT PRIMARY KEY,
    id_solicitud INT,
    fecha_limite_entrega DATE,
    fecha_envio_resultados DATE,
    servicio_es_viable BOOLEAN,

    FOREIGN KEY (id_solicitud) REFERENCES Solicitudes(solicitud_id) ON DELETE CASCADE
);

CREATE TABLE seguimiento_encuesta (
    id_encuesta INT PRIMARY KEY AUTO_INCREMENT,
    id_solicitud INT,
    fecha_encuesta DATE,
    comentarios TEXT,
    recomendaria_servicio BOOLEAN,
    cliente_respondio BOOLEAN,
    solicito_nueva_encuesta BOOLEAN,

    FOREIGN KEY (id_solicitud) REFERENCES Solicitudes(solicitud_id) ON DELETE CASCADE
);