-- ============================================================
-- Depo Stock - Esquema de Base de Datos Unificado (PostgreSQL)
-- ============================================================

-- 1. TIPOS / ENUMS
CREATE TYPE estado_tramite AS ENUM (
    'pendiente', 
    'en_revision', 
    'aprobado_parcial', 
    'aprobado', 
    'rechazado', 
    'entregado', 
    'finalizado', 
    'cancelado',
    'pendiente_director'
);

CREATE TYPE tipo_movimiento AS ENUM (
    'ingreso', 
    'egreso', 
    'ajuste', 
    'devolucion',
    'traslado'
);

CREATE TYPE tipo_bien AS ENUM (
    'consumible', 
    'patrimonial'
);


-- 2. ORGANIZACIÓN Y EDIFICIOS
CREATE TABLE edificio (
    id_edificio SERIAL PRIMARY KEY,
    cui VARCHAR(20) UNIQUE,
    calle VARCHAR(150),
    numero_puerta VARCHAR(20),
    direccion VARCHAR(200),
    localidad VARCHAR(100),
    departamento VARCHAR(100),
    codigo_postal INTEGER,
    latitud NUMERIC,
    longitud NUMERIC,
    te_voip VARCHAR(30),
    letra_zona VARCHAR(5)
);

CREATE TABLE deposito (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    tipo_deposito VARCHAR(40) DEFAULT 'central'
);

-- Seed de depósito de desguace
INSERT INTO deposito (nombre, tipo_deposito) VALUES 
('Depósito de Desguace (Scrap)', 'desguace')
ON CONFLICT DO NOTHING;


-- 3. PRODUCTOS Y CATEGORÍAS
CREATE TABLE categoria (
    id_categoria SERIAL PRIMARY KEY,
    nombre VARCHAR(50),
    tipo_bien tipo_bien DEFAULT 'consumible'
);

-- Seed de categorías
INSERT INTO categoria (nombre, tipo_bien) VALUES
('Insumos de limpieza', 'consumible'),
('Papelería/Librería', 'consumible'),
('Otros', 'consumible')
ON CONFLICT DO NOTHING;

CREATE TABLE producto (
    id_producto SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    unidad_medida VARCHAR(20),
    marca VARCHAR(120),
    stock_actual INT DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo INT DEFAULT 0 CHECK (stock_minimo >= 0),
    id_categoria INT REFERENCES categoria(id_categoria) ON DELETE SET NULL
);

CREATE TABLE producto_kit (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(180) NOT NULL,
    tipo_escuela VARCHAR(40) NOT NULL,
    descripcion TEXT,
    cantidad_alumnos INT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_by INT, -- se define FK abajo tras tabla usuario
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- 4. INSTITUCIONES
CREATE TABLE institucion (
    id_institucion SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    cue VARCHAR(20) NOT NULL,
    id_edificio INT REFERENCES edificio(id_edificio) ON DELETE SET NULL,
    establecimiento_cabecera VARCHAR(100),
    nivel_educativo VARCHAR(50),
    categoria VARCHAR(20),
    ambito VARCHAR(20),
    limite_productos INT DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    tipo_escuela VARCHAR(40),
    matriculados INT DEFAULT 0,
    kit_id INT REFERENCES producto_kit(id) ON DELETE SET NULL,
    UNIQUE(cue, nivel_educativo)
);


-- 5. USUARIOS, ROLES Y PERMISOS
CREATE TABLE rol (
    id_rol SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE
);

CREATE TABLE usuario (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(50),
    apellido VARCHAR(50),
    dni VARCHAR(20), -- Removido UNIQUE según compatibilidad
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    id_institucion INT REFERENCES institucion(id_institucion) ON DELETE SET NULL,
    role VARCHAR(50),
    activo BOOLEAN DEFAULT TRUE,
    nivel_educativo VARCHAR(120),
    director_area_id INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    jurisdiccion VARCHAR(120),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE producto_kit ADD CONSTRAINT fk_producto_kit_created_by FOREIGN KEY (created_by) REFERENCES usuario(id_usuario) ON DELETE SET NULL;

CREATE TABLE usuario_rol (
    id_usuario INT REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    id_rol INT REFERENCES rol(id_rol) ON DELETE CASCADE,
    PRIMARY KEY (id_usuario, id_rol)
);


-- 6. PRODUCTO KITS DETALLE
CREATE TABLE producto_kit_detalle (
    id SERIAL PRIMARY KEY,
    kit_id INT NOT NULL REFERENCES producto_kit(id) ON DELETE CASCADE,
    id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
    cantidad NUMERIC(12,2) NOT NULL,
    UNIQUE (kit_id, id_producto)
);

CREATE TABLE kit_producto_anual (
    id SERIAL PRIMARY KEY,
    tipo_escuela VARCHAR(40) NOT NULL,
    id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
    cantidad_base INT NOT NULL DEFAULT 0,
    alumnos_por_unidad INT NOT NULL DEFAULT 100,
    cantidad_por_unidad INT NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (tipo_escuela, id_producto)
);


-- 7. PROVEEDORES
CREATE TABLE proveedor (
    id_proveedor SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    cuit VARCHAR(20) UNIQUE NOT NULL,
    contacto VARCHAR(100),
    telefono VARCHAR(30),
    email VARCHAR(100),
    categoria VARCHAR(100),
    activo BOOLEAN DEFAULT TRUE,
    razon_social VARCHAR(255),
    direccion VARCHAR(255),
    rubro VARCHAR(100),
    email_secundario VARCHAR(100),
    sitio_web VARCHAR(255),
    observaciones TEXT
);


-- 8. SUPERVISIÓN Y DIRECCIÓN DE ÁREA
CREATE TABLE supervisor_escuela_asignacion (
    id SERIAL PRIMARY KEY,
    supervisor_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    institucion_id INT NOT NULL REFERENCES institucion(id_institucion) ON DELETE CASCADE,
    director_area_id INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (supervisor_id, institucion_id)
);

CREATE TABLE solicitud_informe_supervisor (
    id SERIAL PRIMARY KEY,
    supervisor_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    director_area_id INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    asunto VARCHAR(180) NOT NULL,
    detalle TEXT,
    fecha_limite DATE,
    estado VARCHAR(20) DEFAULT 'pendiente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE zona (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    nombre VARCHAR(120),
    nivel_educativo VARCHAR(120) NOT NULL,
    departamento VARCHAR(120),
    director_area_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE zona_institucion (
    zona_id INT NOT NULL REFERENCES zona(id) ON DELETE CASCADE,
    institucion_id INT NOT NULL REFERENCES institucion(id_institucion) ON DELETE CASCADE,
    PRIMARY KEY (zona_id, institucion_id)
);

CREATE TABLE zona_supervisor (
    zona_id INT NOT NULL REFERENCES zona(id) ON DELETE CASCADE,
    supervisor_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (zona_id, supervisor_id)
);


-- 9. PEDIDOS
CREATE TABLE pedido (
    id_pedido SERIAL PRIMARY KEY,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado estado_tramite DEFAULT 'pendiente',
    tipo VARCHAR(20) DEFAULT 'anual',
    id_usuario_solicitante INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    id_institucion INT REFERENCES institucion(id_institucion) ON DELETE SET NULL,
    observaciones_generales TEXT,
    aprobado_director_area BOOLEAN DEFAULT FALSE,
    aprobado_por_supervisor_id INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    fecha_aprobacion_supervisor TIMESTAMP,
    motivo_supervisor TEXT,
    respuesta_supervisor_tipo VARCHAR(30),
    kit_id INT,
    kit_nombre VARCHAR(180),
    kit_cantidad NUMERIC(12,2),
    aprobado_por_director_id INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    fecha_aprobacion_director TIMESTAMP,
    requiere_licitacion BOOLEAN NOT NULL DEFAULT FALSE,
    estado_abastecimiento VARCHAR(40) NOT NULL DEFAULT 'stock_disponible',
    codigo_retiro VARCHAR(20)
);

CREATE TABLE detalle_pedido (
    id_detalle_pedido SERIAL PRIMARY KEY,
    id_pedido INT REFERENCES pedido(id_pedido) ON DELETE CASCADE,
    id_producto INT REFERENCES producto(id_producto) ON DELETE RESTRICT,
    cantidad_solicitada INT NOT NULL CHECK (cantidad_solicitada > 0),
    observacion TEXT,
    requiere_licitacion BOOLEAN NOT NULL DEFAULT FALSE,
    stock_disponible_relevado NUMERIC(12,2)
);

CREATE TABLE aprobacion_seguimiento (
    id_aprobacion SERIAL PRIMARY KEY,
    id_pedido INT REFERENCES pedido(id_pedido) ON DELETE CASCADE,
    id_rol_interviniente INT REFERENCES rol(id_rol) ON DELETE CASCADE,
    id_usuario_firma INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    estado_resultante estado_tramite,
    observacion TEXT,
    fecha_firma TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_aprobacion UNIQUE (id_pedido, id_rol_interviniente)
);

CREATE TABLE comentario_pedido (
    id_comentario SERIAL PRIMARY KEY,
    id_pedido INT NOT NULL REFERENCES pedido(id_pedido) ON DELETE CASCADE,
    id_usuario INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    mensaje TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);


-- 10. PLANILLAS DE PEDIDO ANUAL (COMPRAS)
CREATE TABLE planilla_pedido_anual (
    id SERIAL PRIMARY KEY,
    director_area_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    anio INT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'borrador',
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    enviada_at TIMESTAMP,
    aceptada_at TIMESTAMP,
    aceptada_por INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    direccion_area VARCHAR(100),
    motivo_devolucion TEXT
);

CREATE UNIQUE INDEX uq_planilla_anio_direccion
ON planilla_pedido_anual (anio, direccion_area)
WHERE estado IN ('enviada', 'aceptada', 'adjudicada', 'cerrada')
  AND direccion_area IS NOT NULL;

CREATE TABLE planilla_pedido_anual_detalle (
    id SERIAL PRIMARY KEY,
    planilla_id INT NOT NULL REFERENCES planilla_pedido_anual(id) ON DELETE CASCADE,
    id_pedido INT NOT NULL REFERENCES pedido(id_pedido) ON DELETE RESTRICT,
    id_institucion INT NOT NULL REFERENCES institucion(id_institucion) ON DELETE RESTRICT,
    id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE RESTRICT,
    cantidad INT NOT NULL,
    notas TEXT
);


-- 11. LICITACIONES Y HISTORIAL DE PRECIOS
CREATE TABLE licitacion_publicada (
    id SERIAL PRIMARY KEY,
    anio INT NOT NULL,
    usuario_id INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    fecha_publicacion TIMESTAMP DEFAULT NOW(),
    estado VARCHAR(30) NOT NULL DEFAULT 'publicada',
    titulo VARCHAR(255),
    motivo TEXT,
    tipo VARCHAR(20) NOT NULL DEFAULT 'anual'
);

CREATE TABLE compra_precio_historico (
    id SERIAL PRIMARY KEY,
    anio INT NOT NULL,
    id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
    id_proveedor INT NOT NULL REFERENCES proveedor(id_proveedor) ON DELETE RESTRICT,
    precio_compra_real NUMERIC(14,2) NOT NULL,
    licitacion_id INT REFERENCES licitacion_publicada(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT compra_precio_historico_licitacion_producto_key UNIQUE (licitacion_id, id_producto)
);


-- 12. REMITOS Y RECEPCIONES
CREATE TABLE remito_licitacion (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(30) NOT NULL UNIQUE,
    licitacion_id INT NOT NULL, -- Generalmente apunta a licitacion_publicada
    id_deposito INT REFERENCES deposito(id) ON DELETE SET NULL,
    usuario_id INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE recepcion_licitacion (
    id SERIAL PRIMARY KEY,
    licitacion_id INT NOT NULL,
    producto_id INT NOT NULL REFERENCES producto(id_producto) ON DELETE RESTRICT,
    cantidad_recibida NUMERIC(12,2) NOT NULL,
    usuario_id INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    id_deposito INT REFERENCES deposito(id) ON DELETE SET NULL,
    fecha_vencimiento DATE,
    observaciones TEXT,
    remito_id INT REFERENCES remito_licitacion(id) ON DELETE SET NULL,
    cantidad_danada NUMERIC(12,2) NOT NULL DEFAULT 0,
    obs_danio TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE recepcion_danio_imagen (
    id SERIAL PRIMARY KEY,
    remito_id INT NOT NULL REFERENCES remito_licitacion(id) ON DELETE CASCADE,
    producto_id INT REFERENCES producto(id_producto) ON DELETE SET NULL,
    nombre VARCHAR(255),
    mime_type VARCHAR(80),
    datos TEXT NOT NULL, -- Imagen en base64
    created_at TIMESTAMP DEFAULT NOW()
);


-- 13. DISTRIBUCIONES POR LOTE
CREATE TABLE distribucion_lote (
    id SERIAL PRIMARY KEY,
    anio INT NOT NULL,
    zona_id INT REFERENCES zona(id) ON DELETE SET NULL,
    id_deposito INT NOT NULL REFERENCES deposito(id) ON DELETE RESTRICT,
    estado VARCHAR(30) NOT NULL DEFAULT 'en_transito',
    observaciones TEXT,
    usuario_id INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    origen VARCHAR(30) NOT NULL DEFAULT 'distribucion_zonal',
    departamento VARCHAR(120),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE distribucion_lote_item (
    id SERIAL PRIMARY KEY,
    lote_id INT NOT NULL REFERENCES distribucion_lote(id) ON DELETE CASCADE,
    id_institucion INT NOT NULL REFERENCES institucion(id_institucion) ON DELETE RESTRICT,
    id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE RESTRICT,
    cantidad_planificada NUMERIC(12,2) NOT NULL,
    cantidad_recibida NUMERIC(12,2),
    estado_recepcion VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    observaciones_directivo TEXT,
    reclamo_directivo TEXT,
    directivo_usuario_id INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    recibido_at TIMESTAMP,
    cantidad_danada NUMERIC(12,2) NOT NULL DEFAULT 0,
    detalle_danio TEXT,
    coincide_esperado BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (lote_id, id_institucion, id_producto)
);

CREATE TABLE distribucion_lote_item_imagen (
    id SERIAL PRIMARY KEY,
    lote_item_id INT NOT NULL REFERENCES distribucion_lote_item(id) ON DELETE CASCADE,
    id_institucion INT NOT NULL REFERENCES institucion(id_institucion) ON DELETE CASCADE,
    id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE RESTRICT,
    nombre VARCHAR(255),
    mime_type VARCHAR(80),
    datos TEXT NOT NULL, -- Imagen en base64
    directivo_usuario_id INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);


-- 14. SOLICITUDES DE RETIRO Y ENTREGAS
CREATE TABLE solicitud_retiro (
    id SERIAL PRIMARY KEY,
    id_pedido INT NOT NULL REFERENCES pedido(id_pedido) ON DELETE CASCADE,
    id_institucion INT NOT NULL REFERENCES institucion(id_institucion) ON DELETE RESTRICT,
    id_usuario_solicitante INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    fecha_retiro DATE NOT NULL,
    retira_tipo VARCHAR(20) NOT NULL,
    retira_nombre VARCHAR(180),
    retira_dni VARCHAR(30),
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    id_usuario_acepta INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    fecha_aceptacion TIMESTAMP,
    id_usuario_entrega INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    fecha_entrega TIMESTAMP,
    observaciones TEXT,
    solicitar_envio BOOLEAN NOT NULL DEFAULT FALSE,
    departamento_envio TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE entrega_anual (
    id SERIAL PRIMARY KEY,
    id_institucion INT NOT NULL REFERENCES institucion(id_institucion) ON DELETE RESTRICT,
    anio INT NOT NULL,
    id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE RESTRICT,
    cantidad_entregada NUMERIC(12,2) NOT NULL,
    id_deposito INT REFERENCES deposito(id) ON DELETE SET NULL,
    id_usuario INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);


-- 15. MOVIMIENTOS DE STOCK Y DETALLES
-- Nota: se mantiene chk_movimiento_origen y relaciones
CREATE TABLE movimiento_stock (
    id_movimiento SERIAL PRIMARY KEY,
    id_producto INT REFERENCES producto(id_producto) ON DELETE RESTRICT,
    cantidad INT NOT NULL,
    tipo tipo_movimiento,
    id_detalle_ingreso INT, -- Mantenido por compatibilidad
    id_detalle_orden INT,   -- Mantenido por compatibilidad
    fecha_movimiento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado_producto VARCHAR(50), 
    cargo_retira VARCHAR(50), 
    id_institucion INT REFERENCES institucion(id_institucion) ON DELETE SET NULL, 
    id_usuario INT REFERENCES usuario(id_usuario) ON DELETE SET NULL, 
    id_proveedor INT REFERENCES proveedor(id_proveedor) ON DELETE RESTRICT, 
    motivo TEXT, 
    fecha_vencimiento DATE,
    id_deposito INT REFERENCES deposito(id) ON DELETE SET NULL,
    id_deposito_destino INT REFERENCES deposito(id) ON DELETE SET NULL
);

CREATE TABLE pedido_entrega (
    id SERIAL PRIMARY KEY,
    id_pedido INT NOT NULL REFERENCES pedido(id_pedido) ON DELETE CASCADE,
    id_movimiento INT REFERENCES movimiento_stock(id_movimiento) ON DELETE SET NULL,
    id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE RESTRICT,
    cantidad_entregada INT NOT NULL,
    fecha_entrega TIMESTAMP DEFAULT NOW(),
    id_usuario INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    observaciones TEXT,
    id_solicitud_retiro INT REFERENCES solicitud_retiro(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE solicitud_retiro_detalle (
    id SERIAL PRIMARY KEY,
    id_solicitud_retiro INT NOT NULL REFERENCES solicitud_retiro(id) ON DELETE CASCADE,
    id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE RESTRICT,
    cantidad_solicitada INT NOT NULL,
    cantidad_entregada INT,
    id_movimiento INT REFERENCES movimiento_stock(id_movimiento) ON DELETE SET NULL,
    UNIQUE (id_solicitud_retiro, id_producto)
);


-- 16. CONTROL DE CONSUMO, STOCK INSTITUCIONAL Y ALERTAS
CREATE TABLE stock_institucion (
    id_institucion INT NOT NULL REFERENCES institucion(id_institucion) ON DELETE CASCADE,
    id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
    cantidad NUMERIC(12,2) DEFAULT 0,
    PRIMARY KEY (id_institucion, id_producto)
);

CREATE TABLE consumo_institucion (
    id_consumo SERIAL PRIMARY KEY,
    id_institucion INT NOT NULL REFERENCES institucion(id_institucion) ON DELETE CASCADE,
    id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
    id_usuario INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    cantidad NUMERIC(12,2) NOT NULL,
    fecha TIMESTAMP DEFAULT NOW(),
    motivo TEXT,
    categoria VARCHAR(60)
);

CREATE TABLE notificacion (
    id_notificacion SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    titulo VARCHAR(150) NOT NULL,
    mensaje TEXT,
    leida BOOLEAN DEFAULT FALSE,
    tipo VARCHAR(30) DEFAULT 'info',
    created_at TIMESTAMP DEFAULT NOW()
);


-- 17. PATRIMONIO Y BAJAS
CREATE TABLE patrimonio_ticket (
    id SERIAL PRIMARY KEY,
    institucion_id INT REFERENCES institucion(id_institucion) ON DELETE CASCADE,
    categoria VARCHAR(120),
    descripcion TEXT,
    prioridad VARCHAR(30),
    estado VARCHAR(30) DEFAULT 'pendiente',
    observacion TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE baja_movimientos (
    id SERIAL PRIMARY KEY,
    id_producto INTEGER NOT NULL REFERENCES producto(id_producto) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    motivo TEXT,
    foto_path VARCHAR(255),
    id_usuario INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    id_deposito INTEGER REFERENCES deposito(id) ON DELETE SET NULL,
    estado VARCHAR(20) DEFAULT 'pendiente',
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE baja_status_history (
    id SERIAL PRIMARY KEY,
    baja_id INTEGER REFERENCES baja_movimientos(id) ON DELETE CASCADE,
    estado_anterior VARCHAR(50),
    estado_nuevo VARCHAR(50) NOT NULL,
    usuario_id INTEGER REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    comentarios TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 18. OPTIMIZACIÓN DE ÍNDICES
CREATE INDEX idx_detalle_pedido_pedido ON detalle_pedido (id_pedido);
CREATE INDEX idx_detalle_pedido_producto ON detalle_pedido (id_producto);
CREATE INDEX idx_movimiento_stock_deposito ON movimiento_stock (id_deposito);
CREATE INDEX idx_movimiento_stock_usuario ON movimiento_stock (id_usuario);
CREATE INDEX idx_movimiento_stock_institucion ON movimiento_stock (id_institucion);
CREATE INDEX idx_stock_institucion_producto ON stock_institucion (id_producto);
CREATE INDEX idx_solicitud_retiro_pedido ON solicitud_retiro (id_pedido);
CREATE INDEX idx_solicitud_retiro_detalle_solicitud ON solicitud_retiro_detalle (id_solicitud_retiro);
CREATE INDEX idx_distribucion_lote_item_lote ON distribucion_lote_item (lote_id);
CREATE INDEX idx_comentario_pedido_pedido ON comentario_pedido (id_pedido);
CREATE INDEX idx_supervisor_escuela_supervisor ON supervisor_escuela_asignacion (supervisor_id);
CREATE INDEX idx_supervisor_escuela_institucion ON supervisor_escuela_asignacion (institucion_id);
CREATE INDEX idx_zona_institucion_institucion ON zona_institucion (institucion_id);
CREATE INDEX idx_zona_supervisor_supervisor ON zona_supervisor (supervisor_id);
CREATE INDEX idx_consumo_institucion_inst ON consumo_institucion (id_institucion);
CREATE INDEX idx_consumo_institucion_fecha ON consumo_institucion (fecha DESC);
CREATE INDEX idx_movimiento_producto ON movimiento_stock (id_producto);
CREATE INDEX idx_pedido_institucion ON pedido (id_institucion);
