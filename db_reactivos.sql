
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

CREATE TABLE IF NOT EXISTS suscripciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    fecha_suscripcion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    lote VARCHAR(30) PRIMARY KEY,                  -- Identificador único por lote
    codigo VARCHAR(10) NOT NULL,                   -- Código del reactivo
    nombre VARCHAR(200) NOT NULL,                  -- Nombre genérico
    marca VARCHAR(50) NOT NULL,                    -- Marca
    referencia VARCHAR(100),                       -- referencia
    cas VARCHAR (50),                              -- 
    presentacion DECIMAL(10,2) NOT NULL,           -- Presentación (ej: 500 mL)
    presentacion_cant DECIMAL(10,2) NOT NULL,      -- Cuantas unidades
    cantidad_total DECIMAL(10,2) NOT NULL,         -- Total disponible (presentacion_cant x presentacion)
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

    -- Relaciones
    FOREIGN KEY (codigo) REFERENCES catalogo_reactivos(codigo),
    FOREIGN KEY (tipo_id) REFERENCES tipo_reactivo(id),
    FOREIGN KEY (clasificacion_id) REFERENCES clasificacion_sga(id),
    FOREIGN KEY (unidad_id) REFERENCES unidades(id),
    FOREIGN KEY (estado_id) REFERENCES estado_fisico(id),
    FOREIGN KEY (almacenamiento_id) REFERENCES almacenamiento(id),
    FOREIGN KEY (tipo_recipiente_id) REFERENCES tipo_recipiente(id),

    UNIQUE (codigo, lote) -- asegura que no se duplique lote para el mismo código
);



CREATE TABLE IF NOT EXISTS hoja_seguridad (
    id INT PRIMARY KEY AUTO_INCREMENT,
    codigo VARCHAR(10) NOT NULL,
    hoja_seguridad VARCHAR(255) NOT NULL,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    contenido_pdf LONGBLOB,

    UNIQUE (codigo),
    FOREIGN KEY (codigo) REFERENCES reactivos(codigo)
);

CREATE TABLE IF NOT EXISTS cert_analisis (
    id INT PRIMARY KEY AUTO_INCREMENT,
    codigo VARCHAR(10) NOT NULL,
    certificado_analisis VARCHAR(255) NOT NULL,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    contenido_pdf LONGBLOB,

    UNIQUE (codigo),
    FOREIGN KEY (codigo) REFERENCES reactivos(codigo)
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

INSERT IGNORE INTO unidades (nombre) VALUES ('mL'), ('g'), ('uL'), ('nmol'), ('umol'), ('mg'), ('Unidad');

INSERT IGNORE INTO estado_fisico (nombre) VALUES ('Liquido'), ('Solido'), ('Viscoso'), ('Gas');

INSERT IGNORE INTO tipo_recipiente (nombre) VALUES ('Vidrio'), ('Plástico'), ('Metalico');

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


INSERT INTO catalogo_reactivos (codigo, nombre, tipo_reactivo, clasificacion_sga) VALUES
('R-001', 'Solucion Buffer pH 4', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-002', 'Solucion Buffer pH 7 ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-003', 'Solucion Buffer pH 10', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-004', 'Alcohol Industrial 96% V/V (desinfectante)', 'NO Controlado ', 'INFLAMABLES '),
('R-005', 'Acetonitrilo para cromatografia  ', 'NO Controlado ', 'INFLAMABLES '),
('R-006', 'Metanol al 99,97%', 'Controlado', 'INFLAMABLES '),
('R-007', 'Isopropanol (Alcohol propanol) 2-propanol ', 'Controlado', 'INFLAMABLES '),
('R-008', 'Ácido etilendiaminotetraacético-sal sodica-(EDTA) al 99%', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-009', 'Sulfato de sodio anhidro grado analitico', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-010', 'Fosfato de potasio dibásico al 98% (Dipotasio Hidrogeno de fosfato) ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-011', 'Ácido pirúvico  al 98%', 'NO Controlado ', 'CORROSIVO'),
('R-012', 'Reactivo Dextrosa anhidra en  polvo o glucosa al 97,5-102,0% ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-013', 'Acido Acetico Glacial al 100%', 'NO Controlado ', 'INFLAMABLES '),
('R-014', 'Acido Acético anhidro al 98% ', 'Controlado', 'INFLAMABLES '),
('R-015', 'Acido Fosforico-Ortofosforico al 85%', 'NO Controlado ', 'CORROSIVO'),
('R-016', 'Acido Sulfurico al  95% al 98% ', 'Controlado', 'CORROSIVO'),
('R-017', 'Alcohol Etilico grado analitico (Etanol)  ', 'NO Controlado ', 'INFLAMABLES '),
('R-018', 'Fosfato de potasio monobásico al 98%  o Dihidrógeno fosfato  de potasio ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-019', 'Acetona para cromatografia MS ', 'Controlado', 'INFLAMABLES '),
('R-020', 'Acido trifluoroacetico al 99% para HPLC ', 'NO Controlado ', 'CORROSIVO'),
('R-021', '3 metilbutanol- Alcohol Isoamilico', 'NO Controlado ', 'INFLAMABLES '),
('R-022', 'Calcio nitrato tetrahidrato', 'NO Controlado ', 'CORROSIVO'),
('R-023', 'Cloroformo', 'Controlado', 'TOXICO '),
('R-024', 'Reactivo de  Sucrosa o Sacarosa  ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-025', 'Reactivo  D -(-) Fructosa ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-026', 'Reactivo  D-Maltosa monohidrato  al 99% ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-027', 'EDTA Cálcica-Ácido Etilendiaminotetraacético', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-028', 'Cloruro de potasio ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-029', 'Cloruro de calcio anhidro ', 'Controlado', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-030', 'Cloruro de calcio  2-hidrato', 'Controlado', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-031', 'Cloruro de sodio para análisis ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-032', 'Acetato de sodio trihidato (3-hidrato) ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-033', 'Amonio dihidrogeno de fosfato', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-034', 'Cloruro de magnesio ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-035', 'Acetato de litio 2-hidrato  ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-036', 'Acetato de potasio ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-037', 'Carbonato de Calcio  ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-038', 'Carbonato de Sodio anhidro', 'Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-039', 'Ácido Fórmico ', 'NO Controlado ', 'INFLAMABLES '),
('R-040', 'Fosfato  Dibásico de Sodio Anhidro  al  99%  hidrogeno fostafo ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-041', 'Tartrato de potasio y sodio 4-hidrato ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-043', 'Hipoclorito de sodio al 13% al 15%', 'NO Controlado ', 'CORROSIVO'),
('R-044', 'Ácido Gálico ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-045', 'Acido 3,5- Dinitrosalicilico al 98% ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-046', '1,1 difenil -2- picrilhidrazilo >97.0%  ', 'NO Controlado ', 'PELIGRO PARA LA RESPIRACION '),
('R-048', 'Hidroxido de sodio en lentejas ', 'NO Controlado ', 'CORROSIVO'),
('R-049', 'Cloruro de dansilo', 'NO Controlado ', 'CORROSIVO'),
('R-050', 'Lugol de gram (colorante) ', 'NO Controlado ', 'INFLAMABLES '),
('R-051', 'Cristal violeta (colorante) ', 'NO Controlado ', 'INFLAMABLES '),
('R-052', 'Alcohol cetona (colorante)', 'NO Controlado ', 'INFLAMABLES '),
('R-054', 'Dodecil sulfato sódico ', 'NO Controlado ', 'INFLAMABLES '),
('R-055', 'Glicerol o Glicerina  al 99% ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-056', 'Bencina de Petroleo (eter de petroleo)', 'Controlado ', 'INFLAMABLES '),
('R-057', 'Indicador Azu de Bromofenol ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-058', 'Reactivo del fenol según Folin-Ciocalteu', 'NO Controlado ', 'CORROSIVO'),
('R-059', 'Reactivo Azul de Anilina ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-060', 'Orange G ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-061', 'Ácido bórico ', 'NO Controlado ', 'PELIGRO PARA LA RESPIRACION '),
('R-062', 'Sal sódica de ampicilina ', 'NO Controlado ', 'PELIGRO PARA LA RESPIRACION '),
('R-063', 'G418 Sal de disulfato  ', 'NO Controlado ', 'PELIGRO PARA LA RESPIRACION '),
('R-064', 'Yodo resublimado P.A ', 'NO Controlado ', 'PELIGRO PARA LA RESPIRACION '),
('R-065', 'Dimetil sulfoxido  ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-066', 'Vainillina (Vanillin) ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-067', 'Xileno cianol ff ultra puro ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-068', 'Antrona  para analisis ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-069', 'Tris (Base)  Ultrapura para biologia molecular ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-070', 'Clorhidrato de Trizma (tritation) ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-071', 'Cicloheximida  pureza por HPLC: 98.8 %', 'NO Controlado ', 'TOXICO '),
('R-072', 'Lyticase (zymoliase) para arthrobacter luteus  ', 'NO Controlado ', 'PELIGRO PARA LA RESPIRACION '),
('R-073', 'Solución Buffer TRIS EDTA ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-074', '1,4 Ditiotreíta para fines bioquímicos(1,4 Dithiothereitol) ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-075', 'Almidón soluble puro grado analítico  ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-076', 'Celulosa microcristalina en polvo grado analítico', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-077', 'Saponin ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-078', 'L-2 Ácido aminoadípico al 98% ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-079', 'Guanidina Tiocianato  para Biologia Molecular al 99%   ', 'NO Controlado ', 'CORROSIVO'),
('R-080', 'Carbon activado en polvo  ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-081', 'Diosgenina 93% grado HPLC ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-082', 'Dioscin 95% HPLC ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-083', 'Formiato de amonio  ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-084', 'Pentoxido de Fósforo ', 'NO Controlado ', 'CORROSIVO'),
('R-085', 'Reactivo Ácido Cítrico  Anhídro  al  99.5 - 100.5 %', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-086', 'Reactivo Bradford concentrado Protein Assay Dye Reagent concentrate', 'NO Controlado ', 'INFLAMABLES '),
('R-087', 'Reactivo de Ácido L (+) -Ascórbico ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-088', 'Ácido Oleanolico ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-089', 'Hecogenin Acetate 90% ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-090', 'Citrato de hierro (III) hidratado para el cultivo de células', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-091', 'Hidróxido de potasio ', 'NO Controlado ', 'CORROSIVO'),
('R-092', 'Sulfato de cobre (ll)  Pentahidratado ', 'NO Controlado ', 'PELIGRO PARA  EL MEDIO AMBIENTE'),
('R-093', 'Ácido Chromotrópico (Sal disódica dihidratada para análisis)', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-094', 'Indicador de  Fenolftaleína ', 'NO Controlado ', 'PELIGRO PARA LA RESPIRACION '),
('R-095', 'Tiosulfato de sodio anhídro ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-096', 'Hidrogenocarbonato de sodio', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-097', 'Lactosa  monohidrato ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-098', 'Peróxido de hidrógeno  ', 'NO Controlado ', 'CORROSIVO'),
('R-099', 'Indicador rojo de fenol ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-100', 'Biftalato de potasio', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-101', 'Cloruro de magnesio hexahidratado', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-102', 'Nitrato de plata ACS ', 'NO Controlado ', 'COMBURENTE'),
('R-103', 'Tween 80', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-104', 'Fucsina de Gram ', 'NO Controlado ', 'TOXICO '),
('R-105', 'Detergente pH Neutro ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-106', 'Acido peracetico', 'NO Controlado ', 'INFLAMABLES '),
('R-107', 'Triton X-100', 'NO Controlado ', 'CORROSIVO'),
('R-108', 'Virex II', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-109', 'Sulfato de Amonio y Hierro Hexahidratado', 'NO Controlado ', 'NO PELIGRO'),
('R-110', 'Benzoato de Bencilo', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-111', 'p- Cimeno', 'NO Controlado ', 'INFLAMABLES '),
('R-112', 'L-Glicina ', 'NO Controlado ', 'NO PELIGRO'),
('R-113', 'Dibencilditiocarbamato de zinc', 'NO Controlado ', 'PELIGRO PARA EL MEDIO AMBIENTE'),
('R-114', '2,2 -Bipyridyl (2,2 -Bipyridine)', 'NO Controlado ', 'TOXICO '),
('R-115', 'p-dimetilaminobenzaldehido', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-116', '1-bromonaftaleno', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-117', 'Potasio permanganato', 'Controlado', 'COMBURENTE'),
('R-118', '1-Naftol', 'NO Controlado ', 'CORROSIVO'),
('R-119', 'Potasio Disulfito para análisis', 'NO Controlado ', 'CORROSIVO'),
('R-120', 'Carbonato de Amonio ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-121', 'Isobutanol Alcohol isobutilico', 'NO Controlado ', 'INFLAMABLES '),
('R-122', 'Fenolftaleína en solución 1 %', 'NO Controlado ', 'PELIGRO PARA LA RESPIRACION '),
('R-123', 'Acido nitrico 0,1 mol/l', 'NO Controlado ', 'NO PELIGRO'),
('R-124', 'N-hexanol', 'NO Controlado ', 'INFLAMABLES '),
('R-125', 'Disulfito de sodio o metadisulfito de sodio', 'Controlado', 'INFLAMABLES '),
('R-126', 'Tolueno para Análisis ', 'NO Controlado ', 'INFLAMABLES '),
('R-127', 'Dodecil sulfato sódico SDS, Puro grado farma', 'NO Controlado ', 'TOXICO '),
('R-128', 'tri-Sodio citrato dihidrato ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-129', '(Buffer) Fosfato salino ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-130', 'Difenil Picrilhidracilo (DPPH)', 'NO Controlado ', 'INFLAMABLES '),
('R-131', 'Trolox (6-hydroxy-2,5,7,8-tetramethylchroman-2-carboxylic acid)', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-132', 'Acido Sorbico', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-133', 'Fluoresceína sal sódica', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-134', 'Metil-B-Ciclodextrina', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-135', 'Polivinilpolipirrolidona (PVPP) al 99% ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-136', 'Detergente para eliminación de RNAsas y ADN de superficies de los laboratorios', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-137', 'Ácido perclórico', 'NO Controlado ', 'COMBURENTE'),
('R-138', 'Tween 20', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-139', 'Buffer TAE 50X', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-140', 'Dicromato de potasio ', 'NO Controlado ', 'COMBURENTE'),
('R-141', 'Solución Buffer pH 6', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-142', 'Aceite de Inmersión', 'NO Controlado ', 'NO PELIGRO'),
('R-143', 'Azul de Lactofenol', 'NO Controlado ', 'CORROSIVO'),
('R-144', 'Oxidasa ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-145', 'Acetato de Amonio', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-146', 'Bromuro de hexadeciltrimetilamonio (CTAB)', 'NO Controlado ', 'PELIGRO PARA LA RESPIRACION '),
('R-147', 'Fenol-Cloroformo-Alcohol Isoamílico', 'NO Controlado ', 'TOXICO '),
('R-148', 'Taq ADN Polimerasa', 'NO Controlado ', 'TOXICO '),
('R-149', 'Tinción geles ADN (SYBR Green)', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-150', 'Hidroxido de bario', 'NO Controlado ', 'CORROSIVO'),
('R-151', 'Escalera ADN', 'NO Controlado ', 'TOXICO '),
('R-152', 'Cloroformo-Alcohol Isoamílico 24:1', 'NO Controlado ', 'TOXICO '),
('R-153', 'Acetato de Sodio anhidro', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-154', 'Aceite mineral', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-155', 'Azul de Bromotimol TS', 'NO Controlado ', 'INFLAMABLES '),
('R-156', 'Silicona Antiespumante ', 'NO Controlado ', 'NO PELIGRO'),
('R-157', 'Bactident Coagulasa (Plasma Conejo) ', 'NO Controlado ', 'NO PELIGRO'),
('R-158', 'Agua Biologia Molecular ', 'NO Controlado ', 'NO PELIGRO'),
('R-159', 'Proteinasa K ', 'NO Controlado ', 'PELIGRO PARA LA RESPIRACION'),
('R-160', 'Cloruro de potasio 3Mol/l', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('R-161', 'Acido clorhidrico 37%.(CAS:7647-01-0 )', 'Controlado', 'CORROSIVO'),
('R-162', 'Peroxido de hidrogeno 30%', 'NO Controlado ', 'CORROSIVO'),
('R-163', 'Azul de Metileno', 'NO Controlado ', 'INFLAMABLES '),
('R-165', 'Lisozima.(CAS:12650-88-3)', 'NO Controlado ', 'NO PELIGRO'),
('R-166', 'Glutaraldehido 2%', 'NO Controlado ', 'NO PELIGRO'),
('S-001', 'Estándar Ácido Acético Glacial ', 'NO Controlado ', 'INFLAMABLES '),
('S-002', 'Estándar  Ácido Cítrico/Anhidro  ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-003', 'Estándar Ácido Láctico (LD) (destrógeno y levogero) (CAS: ', 'NO Controlado ', 'CORROSIVO'),
('S-004', 'Estándar L-Ácido Láctico 99,9%  ', 'NO Controlado ', 'CORROSIVO'),
('S-005', 'Estándar Cafeína 60 mg/ en agua ', 'nan', 'PELIGRO PARA  EL MEDIO AMBIENTE'),
('S-006', 'Estándar Hidrato de Catequina al 96% (sum of enantiomers, HPLC) ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-007', 'Estándar D-(−)-Fructosa  ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-008', 'Estándar D(+) Sacarosa. ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-009', 'Estándar D-(+)-Dextrosa (glucosa) para cromatografia 99,9%      ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-010', 'Estándar de Ácido Ascórbico ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-011', 'Estándar de Antiocianina de cianidina-3-0- Gluside Chloride ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-012', 'Estándar de Cloruro de delfinidina 3-0-β-D Glucoside chloride', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-013', 'Estándar Epicatequina ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-014', 'Estandar Etanol ', 'NO Controlado ', 'INFLAMABLES '),
('S-015', 'Estándar de Ácido Valérico ', 'NO Controlado ', 'CORROSIVO'),
('S-016', 'Estándar Solución de Cloruro de Potasio 0,01M KCl', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-017', 'Estándar Solución de Cloruro de Potasio 0,1M KCl', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-018', 'Patron de turbidez McFarland 0,5% (Escala de McFarland)', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-019', 'Staphylococcus aureus subsp. aureus Rose ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-020', 'E. aerogenes o Klebsiella aerogenes Tindall et al. ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-021', 'Wallemia sebi ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-022', 'Aspergillus Caesiellus  ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-023', 'Eurotium rubrum ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-024', 'Bacillus spizizenii  ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-025', 'Pseudomonas aeruginosa ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-026', 'Escherichia coli ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-027', 'K. pneumoniae ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-028', 'Estandar bovine serum albumi (BSA)', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-029', 'S. Cerevisiae  ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-030', 'Kit de Aminoacidos ', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-031', 'Salmonella enteritidis', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-032', 'Pediococcus pentosaceus', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-033', 'Lactococcus lactis', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-034', 'Estandar de Panela', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-035', 'Dntps para PCR, soluciones de 100mM', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-036', '(Compact Dry XSA) Placas de petri miniaturisadas con agar deshidratadado para el analisis cuantitativo de Staphylococcus aureus', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-037', 'API 50CH Carbohidratos', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-038', 'Estandar de Mermelada', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-039', 'API 20C Test', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-040', 'Material de referencia bebidas alcoholicas', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-041', 'Solución madre de Cloruro de Magnesio', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-042', 'Patrón conductividad 84 𝝻S/cm', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('S-043', 'Cobre solucion patron', 'NO Controlado ', 'CORROSIVO'),
('S-044', 'Hierro soluciòn patron', 'NO Controlado ', 'CORROSIVO'),
('S-045', 'Bioindicador de autoclave-Sterikon', 'NO Controlado ', 'NO PELIGRO'),
('S-046', 'API 20E', 'NO Controlado ', 'IRRITACIÓN CUTANEA Y OTROS '),
('M-001', 'Agar ', 'NO Controlado ', 'NO PELIGRO'),
('M-002', 'Agar hierro lisina ', 'NO Controlado ', 'NO PELIGRO'),
('M-003', 'Agarosa Ra  (Agarose)', 'NO Controlado ', 'NO PELIGRO'),
('M-004', 'Agar MRS', 'NO Controlado ', 'NO PELIGRO'),
('M-008', 'Agua de peptona tamponada', 'NO Controlado ', 'NO PELIGRO'),
('M-009', 'Base nitrogenada de levadura sin aminoácidos', 'NO Controlado ', 'NO PELIGRO'),
('M-010', 'Caldo nutritivo ', 'NO Controlado ', 'NO PELIGRO'),
('M-011', 'Caldo MRS', 'NO Controlado ', 'NO PELIGRO'),
('M-012', 'Agar  Tryptone Bile X-glucuronide (TBX) ', 'NO Controlado ', 'NO PELIGRO'),
('M-013', 'Agar  Triptona de soya (TSA)', 'NO Controlado ', 'NO PELIGRO'),
('M-014', 'Dextrosa (grado bacteriologico)', 'NO Controlado ', 'NO PELIGRO'),
('M-015', 'D-Sorbitol  ', 'NO Controlado ', 'NO PELIGRO'),
('M-016', 'Extracto de levadura granulada', 'NO Controlado ', 'NO PELIGRO'),
('M-017', 'Extracto de malta  ', 'NO Controlado ', 'NO PELIGRO'),
('M-018', 'Suplemento Levadura Medio sintético de abandono', 'NO Controlado ', 'NO PELIGRO'),
('M-019', 'Peptona de caseína y otras proteínas animales', 'NO Controlado ', 'NO PELIGRO'),
('M-020', 'Peptona bacteriologica', 'NO Controlado ', 'NO PELIGRO'),
('M-021', 'Agar Cloranfenicol Glucosado  (YGC)', 'NO Controlado ', 'PELIGRO PARA LA RESPIRACION '),
('M-022', 'Agar Base Diclorán Glicerina  (DG18)', 'NO Controlado ', 'PELIGRO PARA LA RESPIRACION '),
('M-023', 'Agar Saboraud  Cloranfenicol ', 'NO Controlado ', 'PELIGRO PARA LA RESPIRACION '),
('M-024', 'Agar  Plate count  (Recuento en placa)  (PCA)', 'NO Controlado ', 'NO PELIGRO'),
('M-025', 'Agar  Nutritivo ', 'NO Controlado ', 'NO PELIGRO'),
('M-026', 'Caldo Triptona y Soya (TSB)', 'NO Controlado ', 'NO PELIGRO'),
('M-027', 'Agar Eosina de azul de metino (EMB)', 'NO Controlado ', 'NO PELIGRO'),
('M-028', 'Suplemento de Oxitetraciclina ', 'NO Controlado ', 'NO PELIGRO'),
('M-029', 'Violet Red Bile Agar with MUG (VRBA-MUG)', 'NO Controlado ', 'NO PELIGRO'),
('M-030', 'Agar Saboraud Oxytetraciclina (OGYEA)', 'NO Controlado ', 'NO PELIGRO'),
('M-031', 'Peptona proteasa', 'NO Controlado ', 'NO PELIGRO'),
('M-032', 'Agar WL Nutritivo', 'NO Controlado ', 'NO PELIGRO'),
('M-033', 'D-Mannitol ', 'NO Controlado ', 'NO PELIGRO'),
('M-034', 'L-alfa lecitina ', 'NO Controlado ', 'NO PELIGRO'),
('M-035', 'Desodorante para Autoclave', 'NO Controlado ', 'NO PELIGRO'),
('M-036', 'Suero Fetal Bovino ', 'NO Controlado ', 'NO PELIGRO'),
('M-037', 'Caldo LB', 'NO Controlado ', 'NO PELIGRO'),
('M-038', 'Agar Cromogénico para salmonella', 'NO Controlado ', 'NO PELIGRO'),
('M-039', 'Caldo Muller-Kauffmann (MKTTn)', 'NO Controlado ', 'NO PELIGRO'),
('M-040', 'Agar XLD ISO 6579-1:2017 ref(14781) Xylose Lysine Deoxycholate Agar', 'NO Controlado ', 'NO PELIGRO'),
('M-041', 'Agar BAIRD-PARKER(base)', 'NO Controlado ', 'NO PELIGRO'),
('M-042', 'Agar DRBC(Dicloran-Rosa bengala-Cloranfenicol)', 'NO Controlado ', 'NO PELIGRO'),
('M-043', 'Agar base Sangre', 'NO Controlado ', 'NO PELIGRO'),
('M-044', 'Caldo Brain Heart Infusión ', 'NO Controlado ', 'NO PELIGRO'),
('M-045', 'Agar Triple Sugar Iron (TSI)', 'NO Controlado ', 'NO PELIGRO'),
('M-046', 'Caldo Rapparport Vassiliadis', 'NO Controlado ', 'NO PELIGRO'),
('M-047', 'Emulsión Huevo Telurito ', 'NO Controlado ', 'NO PELIGRO'),
('M-048', 'Agar Patata-Glucosa (PDA)', 'NO Controlado ', 'NO PELIGRO');


