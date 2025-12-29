CREATE TABLE departamentos (
    codigo VARCHAR(10) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
);

CREATE TABLE ciudades (
    codigo VARCHAR(10) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    id_departamento VARCHAR(10) NOT NULL,
    FOREIGN KEY (id_departamento) REFERENCES departamentos(codigo) ON DELETE RESTRICT
);

CREATE TABLE clientes (
    id_cliente INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    numero INT NOT NULL UNIQUE,
    fecha_vinculacion DATE NOT NULL,
    tipo_usuario ENUM(
        'Emprendedor','Persona Natural','Persona Jurídica',
        'Aprendiz SENA','Instructor SENA','Centros SENA'
    ) NOT NULL,
    razon_social VARCHAR(255),
    nit VARCHAR(50),
    nombre_solicitante VARCHAR(255) NOT NULL,
    tipo_identificacion ENUM('CC','TI','CE','NIT','PASAPORTE','OTRO') NOT NULL,
    numero_identificacion VARCHAR(50) NOT NULL UNIQUE,
    sexo ENUM('M','F','Otro') NOT NULL,
    tipo_poblacion VARCHAR(100),
    direccion VARCHAR(255),
    id_ciudad VARCHAR(10),
    id_departamento VARCHAR(10),
    celular VARCHAR(20),
    telefono VARCHAR(20),
    correo_electronico VARCHAR(255),
    tipo_vinculacion VARCHAR(100),
    registro_realizado_por VARCHAR(255),
    observaciones TEXT,
    activo TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_ciudad) REFERENCES ciudades(codigo) ON DELETE RESTRICT,
    FOREIGN KEY (id_departamento) REFERENCES departamentos(codigo) ON DELETE RESTRICT
);

CREATE TABLE Solicitudes (
    solicitud_id INT PRIMARY KEY,
    id_cliente INT NOT NULL,
    tipo_solicitud VARCHAR(10),
    nombre_muestra VARCHAR(255),
    fecha_solicitud DATE,
    lote_producto VARCHAR(100),
    fecha_vencimiento_muestra DATE,
    tipo_muestra VARCHAR(100),
    tipo_empaque VARCHAR(100),
    analisis_requerido VARCHAR(255),
    req_analisis TINYINT(1),
    cant_muestras INT,
    solicitud_recibida VARCHAR(255),
    fecha_entrega_muestra DATE,
    recibe_personal VARCHAR(255),
    cargo_personal VARCHAR(100),
    observaciones TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE RESTRICT
);

CREATE TABLE seguimiento_encuesta (
    id_encuesta INT AUTO_INCREMENT PRIMARY KEY,
    id_solicitud INT,
    fecha_encuesta DATE,
    comentarios TEXT,
    recomendaria_servicio TINYINT(1),
    cliente_respondio TINYINT(1),
    solicito_nueva_encuesta TINYINT(1),
    fecha_realizacion_encuesta DATE,
    FOREIGN KEY (id_solicitud) REFERENCES Solicitudes(solicitud_id) ON DELETE CASCADE
);

CREATE TABLE revision_oferta (
    id_revision INT AUTO_INCREMENT PRIMARY KEY,
    id_solicitud INT,
    fecha_limite_entrega DATE,
    servicio_es_viable BOOLEAN,
    FOREIGN KEY (id_solicitud) REFERENCES Solicitudes(solicitud_id) ON DELETE CASCADE
);

CREATE TABLE oferta (
    id_oferta INT AUTO_INCREMENT PRIMARY KEY,
    id_solicitud INT,
    genero_cotizacion TINYINT(1),
    valor_cotizacion DECIMAL(20,2),
    fecha_envio_oferta DATE,
    realizo_seguimiento_oferta TINYINT(1),
    observacion_oferta TEXT,
    FOREIGN KEY (id_solicitud) REFERENCES Solicitudes(solicitud_id) ON DELETE CASCADE
);

-- Roles
CREATE TABLE roles (
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
);

-- Permisos
CREATE TABLE permisos (
    id_permiso INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    descripcion TEXT
);

-- Relación Roles-Permisos
CREATE TABLE rol_permiso (
    id_rol_permiso INT AUTO_INCREMENT PRIMARY KEY,
    rol_id INT NOT NULL,
    permiso_id INT NOT NULL,
    FOREIGN KEY (rol_id) REFERENCES roles(id_rol) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (permiso_id) REFERENCES permisos(id_permiso) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Usuarios
CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    contrasena VARCHAR(255) NOT NULL,
    rol_id INT NOT NULL,
    estado ENUM('ACTIVO','INACTIVO') DEFAULT 'ACTIVO',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rol_id) REFERENCES roles(id_rol) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Almacenamiento
CREATE TABLE almacenamiento (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL
);

-- Tipo de reactivo
CREATE TABLE tipo_reactivo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE
);

-- Clasificación SGA
CREATE TABLE clasificacion_sga (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

-- Estado físico
CREATE TABLE estado_fisico (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(20) NOT NULL UNIQUE
);

-- Tipo de recipiente
CREATE TABLE tipo_recipiente (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(20) NOT NULL UNIQUE
);

-- Unidades
CREATE TABLE unidades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(20) NOT NULL UNIQUE
);

-- Catálogo de reactivos
CREATE TABLE catalogo_reactivos (
    codigo VARCHAR(10) PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    tipo_reactivo VARCHAR(50) NOT NULL,
    clasificacion_sga VARCHAR(100) NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    activo TINYINT(1) NOT NULL DEFAULT 1
);

-- Reactivos
CREATE TABLE reactivos (
    lote VARCHAR(30) PRIMARY KEY,
    codigo VARCHAR(10) NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    marca VARCHAR(50) NOT NULL,
    referencia VARCHAR(100),
    cas VARCHAR(50),
    presentacion DECIMAL(10,4) NOT NULL,
    presentacion_cant DECIMAL(10,4) NOT NULL,
    cantidad_total DECIMAL(10,4) NOT NULL,
    fecha_adquisicion DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    observaciones TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    activo TINYINT(1) NOT NULL DEFAULT 1,
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

-- Insumos
CREATE TABLE insumos (
    id INT AUTO_INCREMENT PRIMARY KEY,
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
    imagen MEDIUMBLOB
);

-- Papelería
CREATE TABLE papeleria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    cantidad_adquirida INT NOT NULL,
    cantidad_existente INT NOT NULL,
    presentacion ENUM('unidad','paquete','caja','cajas') NOT NULL,
    marca VARCHAR(100),
    descripcion TEXT,
    fecha_adquisicion DATE,
    ubicacion VARCHAR(100),
    observaciones TEXT,
    imagen MEDIUMBLOB
);

-- Movimientos de inventario
CREATE TABLE movimientos_inventario (
    id_movimiento INT AUTO_INCREMENT PRIMARY KEY,
    producto_tipo ENUM('INSUMO','REACTIVO','EQUIPO','PAPELERIA') NOT NULL,
    producto_referencia VARCHAR(100) NOT NULL,
    tipo_movimiento ENUM('ENTRADA','SALIDA','AJUSTE') NOT NULL,
    usuario_id INT NOT NULL,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
);

-- Maestra: Equipos HV
CREATE TABLE hv_equipos (
    codigo_identificacion VARCHAR(100) PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    modelo VARCHAR(100),
    marca VARCHAR(100),
    inventario_sena VARCHAR(100),
    ubicacion VARCHAR(100),
    acreditacion ENUM('Si','No aplica'),
    tipo_manual ENUM('Fisico','Digital'),
    numero_serie VARCHAR(100),
    tipo VARCHAR(100),
    clasificacion VARCHAR(100),
    manual_usuario ENUM('Si','No'),
    puesta_en_servicio DATE,
    fecha_adquisicion DATE,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    requerimientos_equipo TEXT,
    elementos_electricos ENUM('Si','No'),
    voltaje VARCHAR(50),
    elementos_mecanicos ENUM('Si','No'),
    frecuencia VARCHAR(50),
    campo_medicion VARCHAR(100),
    exactitud VARCHAR(100),
    sujeto_verificar ENUM('Si','No'),
    sujeto_calibracion ENUM('Si','No'),
    resolucion_division VARCHAR(100),
    sujeto_calificacion ENUM('Si','No'),
    accesorios TEXT
);

-- Hijas: Historial de equipos HV
CREATE TABLE historial_hv (
    equipo_id VARCHAR(100),
    consecutivo INT,
    fecha DATE,
    tipo_historial VARCHAR(100),
    codigo_registro VARCHAR(100),
    tolerancia_g DECIMAL(10,4),
    tolerancia_error_g DECIMAL(10,4),
    incertidumbre_u DECIMAL(10,4),
    realizo VARCHAR(150),
    superviso VARCHAR(150),
    observaciones TEXT,
    PRIMARY KEY (equipo_id, consecutivo),
    FOREIGN KEY (equipo_id) REFERENCES hv_equipos(codigo_identificacion) ON DELETE CASCADE
);

-- Hijas: Intervalos de calibración HV
CREATE TABLE intervalo_hv (
    equipo_id VARCHAR(100),
    consecutivo INT,
    unidad_nominal_g DECIMAL(10,4),
    calibracion_1 VARCHAR(100),
    fecha_c1 DATE,
    error_c1_g DECIMAL(10,4),
    calibracion_2 VARCHAR(100),
    fecha_c2 DATE,
    error_c2_g DECIMAL(10,4),
    diferencia_dias INT,
    desviacion DECIMAL(10,4),
    deriva DECIMAL(10,4),
    tolerancia_g DECIMAL(10,4),
    intervalo_calibraciones_dias INT,
    intervalo_calibraciones_anios DECIMAL(10,4),
    PRIMARY KEY (equipo_id, consecutivo),
    FOREIGN KEY (equipo_id) REFERENCES hv_equipos(codigo_identificacion) ON DELETE CASCADE
);

-- PDFs de equipos HV
CREATE TABLE pdfs_equipo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    equipo_id VARCHAR(100) NOT NULL,
    categoria ENUM(
        'Manual de usuario',
        'Certificados de calificación',
        'Certificados de verificación',
        'Certificados de calibración',
        'Certificados de mantenimiento',
        'Ficha técnica de especificaciones'
    ) NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    archivo MEDIUMBLOB NOT NULL,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipo_id) REFERENCES hv_equipos(codigo_identificacion) ON DELETE CASCADE
);

-- Ficha técnica general de equipos
CREATE TABLE ficha_tecnica_de_equipos (
    codigo_identificador VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(100),
    marca VARCHAR(50),
    modelo VARCHAR(50),
    serie VARCHAR(50),
    fabricante VARCHAR(100),
    fecha_adq DATE,
    uso VARCHAR(100),
    fecha_func DATE,
    precio DECIMAL(10,2),
    accesorios TEXT,
    manual_ope ENUM('digital','Fisico','No'),
    idioma_manual VARCHAR(30),
    -- Especificaciones técnicas
    magnitud VARCHAR(50),
    resolucion VARCHAR(50),
    precision_med VARCHAR(50),
    exactitud VARCHAR(50),
    rango_de_medicion VARCHAR(100),
    rango_de_uso VARCHAR(100),
    -- Características eléctricas
    voltaje VARCHAR(50),
    potencia VARCHAR(50),
    amperaje VARCHAR(50),
    frecuencia VARCHAR(50),
    -- Dimensiones físicas
    ancho DECIMAL(8,2),
    alto DECIMAL(8,2),
    profundidad DECIMAL(8,2),
    peso_kg DECIMAL(8,2),
    -- Condiciones ambientales
    temperatura_c DECIMAL(5,2),
    humedad_porcentaje DECIMAL(5,2),
    limitaciones_e_interferencias TEXT,
    otros TEXT,
    especificaciones_software TEXT,
    -- Proveedor / soporte
    proveedor VARCHAR(100),
    email VARCHAR(100),
    telefono VARCHAR(20),
    fecha_de_instalacion DATE,
    alcance_del_servicio TEXT,
    garantia VARCHAR(100),
    observaciones TEXT,
    recibido_por VARCHAR(100),
    cargo_y_firma LONGBLOB,
    fecha DATE
);

-- Maestra: Material de referencia
CREATE TABLE material_referencia (
    codigo_id INT PRIMARY KEY,
    nombre_material VARCHAR(100) NOT NULL,
    rango_medicion VARCHAR(50),
    marca VARCHAR(100),
    modelo VARCHAR(100),
    serie VARCHAR(100),
    error_max_permitido DECIMAL(10,6)
);

-- Hijas: Historial de materiales de referencia
CREATE TABLE historial_referencia (
    consecutivo INT PRIMARY KEY,
    codigo_material INT NOT NULL,
    fecha DATE NOT NULL,
    tipo_historial_instrumento VARCHAR(50),
    codigo_registro VARCHAR(50),
    realizo VARCHAR(100),
    superviso VARCHAR(100),
    FOREIGN KEY (codigo_material) REFERENCES material_referencia(codigo_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Hijas: Intervalos de calibración de referencia
CREATE TABLE intervalo_referencia (
    consecutivo INT PRIMARY KEY,
    codigo_material INT NOT NULL,
    valor_nominal DECIMAL(10,4) NOT NULL,
    fecha_c1 DATE NOT NULL,
    error_c1 DECIMAL(10,6) NOT NULL,
    fecha_c2 DATE NOT NULL,
    error_c2 DECIMAL(10,6) NOT NULL,
    diferencia_tiempo_dias INT,
    desviacion_abs DECIMAL(12,8),
    deriva DECIMAL(12,10),
    tolerancia DECIMAL(10,6),
    intervalo_calibracion_dias DECIMAL(12,4),
    intervalo_calibracion_anos DECIMAL(12,6),
    incertidumbre_exp DECIMAL(10,6),
    FOREIGN KEY (codigo_material) REFERENCES material_referencia(codigo_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- PDFs de referencia
CREATE TABLE pdfs_referencia (
    id INT AUTO_INCREMENT PRIMARY KEY,
    referencia_id INT NOT NULL,
    categoria ENUM(
        'Manual de usuario',
        'Certificados de calificación',
        'Certificados de verificación',
        'Certificados de calibración',
        'Certificados de mantenimiento',
        'Ficha técnica de especificaciones'
    ) NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    archivo MEDIUMBLOB NOT NULL,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referencia_id) REFERENCES material_referencia(codigo_id) ON DELETE CASCADE
);

-- Maestra: Material volumétrico
CREATE TABLE material_volumetrico (
    codigo_id INT AUTO_INCREMENT PRIMARY KEY,
    nombre_material VARCHAR(100) NOT NULL,
    volumen_nominal DECIMAL(10,3) NOT NULL,
    rango_volumen VARCHAR(50),
    marca VARCHAR(100),
    modelo VARCHAR(100),
    resolucion DECIMAL(10,4),
    error_max_permitido DECIMAL(10,4)
);

-- Hijas: Historial de material volumétrico
CREATE TABLE historial_volumetrico (
    consecutivo INT AUTO_INCREMENT PRIMARY KEY,
    codigo_material INT NOT NULL,
    fecha DATE NOT NULL,
    tipo_historial_instrumento VARCHAR(50),
    codigo_registro VARCHAR(50),
    realizo VARCHAR(100),
    superviso VARCHAR(100),
    FOREIGN KEY (codigo_material) REFERENCES material_volumetrico(codigo_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Hijas: Intervalos de calibración volumétricos
CREATE TABLE intervalo_volumetrico (
    consecutivo INT AUTO_INCREMENT PRIMARY KEY,
    codigo_material INT NOT NULL,
    valor_nominal DECIMAL(10,3) NOT NULL,
    fecha_c1 DATE NOT NULL,
    error_c1 DECIMAL(10,4) NOT NULL,
    fecha_c2 DATE NOT NULL,
    error_c2 DECIMAL(10,4) NOT NULL,
    diferencia_tiempo_dias INT,
    desviacion_abs DECIMAL(10,6),
    deriva DECIMAL(10,8),
    tolerancia DECIMAL(10,4),
    intervalo_calibracion_dias DECIMAL(10,2),
    intervalo_calibracion_anos DECIMAL(10,4),
    incertidumbre_exp DECIMAL(10,4),
    FOREIGN KEY (codigo_material) REFERENCES material_volumetrico(codigo_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- PDFs de material volumétrico
CREATE TABLE pdfs_material (
    id INT AUTO_INCREMENT PRIMARY KEY,
    material_id INT NOT NULL,
    categoria ENUM(
        'Manual de usuario',
        'Certificados de calificación',
        'Certificados de verificación',
        'Certificados de calibración',
        'Certificados de mantenimiento',
        'Ficha técnica de especificaciones'
    ) NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    archivo MEDIUMBLOB NOT NULL,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES material_volumetrico(codigo_id) ON DELETE CASCADE
);

-- Suscripciones generales
CREATE TABLE suscripciones_reactivos (
    email VARCHAR(255) PRIMARY KEY,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE suscripciones_revision_oferta (
    email VARCHAR(255) PRIMARY KEY,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE suscripciones_solicitudes (
    email VARCHAR(255) PRIMARY KEY,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notificaciones de reactivos
CREATE TABLE notificaciones_reactivos (
    lote VARCHAR(255) NOT NULL,
    days_threshold INT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (lote, days_threshold)
);

-- Jobs programados
CREATE TABLE job_runs (
    job_name VARCHAR(64) NOT NULL,
    run_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (job_name, run_date)
);

-- Logs de acciones de usuarios
CREATE TABLE logs_acciones (
    id_log_accion INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    accion VARCHAR(50) NOT NULL,
    modulo VARCHAR(50) NOT NULL,
    descripcion TEXT,
    detalle JSON,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_usuario (usuario_id),
    CONSTRAINT fk_logs_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
);

-- Plantillas de documentos para equipos
CREATE TABLE plantillas_documento_equipos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255),
    nombre_archivo VARCHAR(255) NOT NULL,
    mime VARCHAR(120),
    size_bytes INT,
    archivo LONGBLOB NOT NULL,
    usuario_id BIGINT,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plantillas de documentos para reactivos
CREATE TABLE plantillas_documento_reactivos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255),
    nombre_archivo VARCHAR(255) NOT NULL,
    mime VARCHAR(120),
    size_bytes INT,
    archivo LONGBLOB NOT NULL,
    usuario_id BIGINT,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plantillas de documentos para solicitudes
CREATE TABLE plantillas_documento_solicitudes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255),
    nombre_archivo VARCHAR(255) NOT NULL,
    mime VARCHAR(120),
    size_bytes INT,
    archivo LONGBLOB NOT NULL,
    usuario_id BIGINT,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plantillas de documentos para referencias
CREATE TABLE plantillas_documento_referencia (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255),
    nombre_archivo VARCHAR(255) NOT NULL,
    mime VARCHAR(120),
    size_bytes INT,
    archivo LONGBLOB NOT NULL,
    usuario_id BIGINT,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plantillas de documentos para volumétricos
CREATE TABLE plantillas_documento_volumetricos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255),
    nombre_archivo VARCHAR(255) NOT NULL,
    mime VARCHAR(120),
    size_bytes INT,
    archivo LONGBLOB NOT NULL,
    usuario_id BIGINT,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
