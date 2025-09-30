-- Tabla principal de usuarios (clientes)
CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
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
    ciudad VARCHAR(100),
    departamento VARCHAR(100),
    celular VARCHAR(20),
    telefono VARCHAR(20),
    correo_electronico VARCHAR(255),
    tipo_vinculacion VARCHAR(100),
    registro_realizado_por VARCHAR(255),
    observaciones TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla para tipos de solicitud
CREATE TABLE TiposSolicitud (
    id_tipo_solicitud INT PRIMARY KEY AUTO_INCREMENT,
    codigo_tipo VARCHAR(10) NOT NULL UNIQUE,
    nombre_tipo VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE
);

-- Tabla principal de solicitudes
CREATE TABLE Solicitudes (
    id_solicitud INT PRIMARY KEY AUTO_INCREMENT,
    numero_solicitud INT NOT NULL UNIQUE,
    id_usuario INT NOT NULL,
    codigo VARCHAR(50),
    fecha_solicitud DATE,
    tipo_solicitud VARCHAR(10), -- Ahora referencia el código del tipo
    
    -- Campos específicos de la solicitud
    nombre_muestra_producto VARCHAR(255),
    lote_producto VARCHAR(100),
    fecha_vencimiento_producto DATE,
    tipo_muestra VARCHAR(100),
    condiciones_empaque VARCHAR(100),
    tipo_analisis_requerido VARCHAR(255),
    requiere_varios_analisis BOOLEAN,
    cantidad_muestras_analizar INT,
    fecha_estimada_entrega_muestra DATE,
    puede_suministrar_informacion_adicional BOOLEAN,
    servicio_viable BOOLEAN,
    genero_cotizacion BOOLEAN,
    valor_cotizacion DECIMAL(15,2),
    fecha_envio_oferta DATE,
    realizo_seguimiento_oferta BOOLEAN,
    observacion_oferta TEXT,
    fecha_limite_entrega_resultados DATE,
    numero_informe_resultados VARCHAR(100),
    fecha_envio_resultados DATE,
    cliente_respondio_encuesta BOOLEAN,
    solicito_nueva_encuesta BOOLEAN,
    observaciones_generales TEXT,
    mes_solicitud INT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    FOREIGN KEY (tipo_solicitud) REFERENCES TiposSolicitud(codigo_tipo)
);


-- El resto de las tablas se mantienen igual...
CREATE TABLE TiposMuestra (
    id_tipo_muestra INT PRIMARY KEY AUTO_INCREMENT,
    nombre_tipo VARCHAR(100) NOT NULL,
    descripcion TEXT
);

CREATE TABLE CondicionesEmpaque (
    id_condicion_empaque INT PRIMARY KEY AUTO_INCREMENT,
    nombre_condicion VARCHAR(100) NOT NULL,
    descripcion TEXT
);

CREATE TABLE TiposAnalisis (
    id_tipo_analisis INT PRIMARY KEY AUTO_INCREMENT,
    nombre_analisis VARCHAR(255) NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(100)
);

CREATE TABLE DiasFestivos (
    id_dia_festivo INT PRIMARY KEY AUTO_INCREMENT,
    fecha_festivo DATE NOT NULL,
    nombre_festivo VARCHAR(255),
    tipo_festivo VARCHAR(100)
);

-- Tablas relacionadas (se mantienen igual)
CREATE TABLE SolicitudesAnalisis (
    id_solicitud_analisis INT PRIMARY KEY AUTO_INCREMENT,
    id_solicitud INT,
    id_tipo_analisis INT,
    orden_analisis INT,
    FOREIGN KEY (id_solicitud) REFERENCES Solicitudes(id_solicitud) ON DELETE CASCADE,
    FOREIGN KEY (id_tipo_analisis) REFERENCES TiposAnalisis(id_tipo_analisis)
);

CREATE TABLE SeguimientoOfertas (
    id_seguimiento INT PRIMARY KEY AUTO_INCREMENT,
    id_solicitud INT,
    fecha_seguimiento DATE,
    tipo_seguimiento VARCHAR(100),
    observaciones TEXT,
    resultado_seguimiento VARCHAR(100),
    FOREIGN KEY (id_solicitud) REFERENCES Solicitudes(id_solicitud) ON DELETE CASCADE
);

CREATE TABLE ResultadosEncuestas (
    id_encuesta INT PRIMARY KEY AUTO_INCREMENT,
    id_solicitud INT,
    fecha_encuesta DATE,
    puntuacion_satisfaccion INT,
    comentarios TEXT,
    recomendaria_servicio BOOLEAN,
    FOREIGN KEY (id_solicitud) REFERENCES Solicitudes(id_solicitud) ON DELETE CASCADE
);

-- Insertar los tipos de solicitud
INSERT INTO TiposSolicitud (codigo_tipo, nombre_tipo, descripcion) VALUES
('AF', 'Apoyo Formación', 'Servicios de apoyo a la formación educativa y capacitación'),
('EN', 'Ensayos', 'Servicios de ensayos de laboratorio y pruebas técnicas'),
('UI', 'Uso Infraestructura', 'Servicios de uso de infraestructura y equipos especializados'),
('IA', 'Investigación Aplicada', 'Servicios de investigación aplicada y desarrollo tecnológico');