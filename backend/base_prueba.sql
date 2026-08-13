-- ENUMS

CREATE TYPE estado_tramite AS ENUM ('pendiente', 'en_revision', 'aprobado_parcial', 'aprobado', 'rechazado', 'entregado', 'finalizado', 'cancelado');
CREATE TYPE tipo_movimiento AS ENUM ('ingreso', 'egreso', 'ajuste', 'devolucion');
CREATE TYPE tipo_bien AS ENUM ('consumible', 'patrimonial');


-- ORGANIZACIÓN


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

CREATE TABLE institucion (
    id_institucion SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    cue VARCHAR(20) NOT NULL,
    id_edificio INT,
    establecimiento_cabecera VARCHAR(100),
    nivel_educativo VARCHAR(50),
    categoria VARCHAR(20),
    ambito VARCHAR(20),
    limite_productos INT DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (id_edificio) REFERENCES edificio(id_edificio),
    UNIQUE(cue, nivel_educativo)
);


-- 3. USUARIOS Y ROLES


CREATE TABLE rol (
    id_rol SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE
);

CREATE TABLE usuario (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(50),
    apellido VARCHAR(50),
    dni VARCHAR(20) UNIQUE,
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255),
    telefono VARCHAR(20),
    id_institucion INT,
    role VARCHAR(50),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_institucion) REFERENCES institucion(id_institucion)
);

CREATE TABLE usuario_rol (
    id_usuario INT,
    id_rol INT,
    PRIMARY KEY (id_usuario, id_rol),
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
    FOREIGN KEY (id_rol) REFERENCES rol(id_rol)
);


-- PRODUCTOS


CREATE TABLE categoria (
    id_categoria SERIAL PRIMARY KEY,
    nombre VARCHAR(50),
    tipo_bien tipo_bien DEFAULT 'consumible'
);

INSERT INTO categoria (nombre, tipo_bien) VALUES
    ('Insumos de limpieza', 'consumible'),
    ('Papelería/Librería', 'consumible'),
    ('Otros', 'consumible');

CREATE TABLE producto (
    id_producto SERIAL PRIMARY KEY,
    nombre VARCHAR(100),
    unidad_medida VARCHAR(20),
    stock_actual INT DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo INT DEFAULT 0 CHECK (stock_minimo >= 0),
    id_categoria INT,
    codigo_sku VARCHAR(100),
    marca VARCHAR(100),
    precio_unitario NUMERIC(12,2) DEFAULT 0,
    ubicacion_estante VARCHAR(100),
    descripcion TEXT,
    es_perecedero BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (id_categoria) REFERENCES categoria(id_categoria)
);


-- PEDIDOS Y APROBACIONES


CREATE TABLE pedido (
    id_pedido SERIAL PRIMARY KEY,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado estado_tramite DEFAULT 'pendiente',
    tipo VARCHAR(20) DEFAULT 'anual',
    id_usuario_solicitante INT,
    id_institucion INT,
    observaciones_generales TEXT,
    aprobado_director_area BOOLEAN,
    FOREIGN KEY (id_usuario_solicitante) REFERENCES usuario(id_usuario),
    FOREIGN KEY (id_institucion) REFERENCES institucion(id_institucion)
);

CREATE TABLE detalle_pedido (
    id_detalle_pedido SERIAL PRIMARY KEY,
    id_pedido INT,
    id_producto INT,
    cantidad_solicitada INT NOT NULL CHECK (cantidad_solicitada > 0),
    observacion TEXT,
    FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido),
    FOREIGN KEY (id_producto) REFERENCES producto(id_producto)
);

CREATE TABLE aprobacion_seguimiento (
    id_aprobacion SERIAL PRIMARY KEY,
    id_pedido INT,
    id_rol_interviniente INT,
    id_usuario_firma INT,
    estado_resultante estado_tramite,
    observacion TEXT,
    fecha_firma TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido),
    FOREIGN KEY (id_rol_interviniente) REFERENCES rol(id_rol),
    FOREIGN KEY (id_usuario_firma) REFERENCES usuario(id_usuario),
    CONSTRAINT unique_aprobacion UNIQUE (id_pedido, id_rol_interviniente)
);


-- ABASTECIMIENTO (INGRESOS)


CREATE TABLE proveedor (
    id_proveedor SERIAL PRIMARY KEY,
    nombre VARCHAR(100),
    cuit VARCHAR(20) UNIQUE,
    contacto VARCHAR(100),
    telefono VARCHAR(30),
    email VARCHAR(100),
    categoria VARCHAR(100),
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE licitacion (
    id_licitacion SERIAL PRIMARY KEY,
    nro_expediente VARCHAR(50) UNIQUE,
    fecha_apertura DATE,
    objeto TEXT
);

CREATE TABLE ingreso (
    id_ingreso SERIAL PRIMARY KEY,
    fecha_recepcion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_proveedor INT,
    id_licitacion INT,
    id_usuario_receptor INT,
    FOREIGN KEY (id_proveedor) REFERENCES proveedor(id_proveedor),
    FOREIGN KEY (id_licitacion) REFERENCES licitacion(id_licitacion),
    FOREIGN KEY (id_usuario_receptor) REFERENCES usuario(id_usuario)
);

CREATE TABLE detalle_ingreso (
    id_detalle_ingreso SERIAL PRIMARY KEY,
    id_ingreso INT,
    id_producto INT,
    cantidad_recibida INT NOT NULL CHECK (cantidad_recibida > 0),
    FOREIGN KEY (id_ingreso) REFERENCES ingreso(id_ingreso),
    FOREIGN KEY (id_producto) REFERENCES producto(id_producto)
);


-- ORDENES Y SALIDA


CREATE TABLE orden_dispensacion (
    id_orden SERIAL PRIMARY KEY,
    id_pedido INT,
    id_usuario_despacha INT,
    id_institucion INT,
    fecha_despacho TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado estado_tramite DEFAULT 'pendiente',
    FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido),
    FOREIGN KEY (id_usuario_despacha) REFERENCES usuario(id_usuario),
    FOREIGN KEY (id_institucion) REFERENCES institucion(id_institucion)
);

CREATE TABLE detalle_orden (
    id_detalle_orden SERIAL PRIMARY KEY,
    id_orden INT,
    id_producto INT,
    cantidad_entregada INT NOT NULL CHECK (cantidad_entregada > 0),
    FOREIGN KEY (id_orden) REFERENCES orden_dispensacion(id_orden),
    FOREIGN KEY (id_producto) REFERENCES producto(id_producto)
);


-- MOVIMIENTO DE STOCK


CREATE TABLE movimiento_stock (
    id_movimiento SERIAL PRIMARY KEY,
    id_producto INT,
    cantidad INT NOT NULL,
    tipo tipo_movimiento,
    id_detalle_ingreso INT,
    id_detalle_orden INT,
    fecha_movimiento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Nuevos campos para movimientos directos
    estado_producto VARCHAR(50), -- estado del producto (nuevo, usado, dañado, etc.)
    cargo_retira VARCHAR(50), -- cargo de quien retira (director/a, vicedirector/a, etc.)
    id_institucion INT, -- institución que recibe el egreso
    id_usuario INT, -- usuario que registra el movimiento
    id_proveedor INT, -- proveedor (para ingresos)
    motivo TEXT, -- motivo del movimiento
    FOREIGN KEY (id_producto) REFERENCES producto(id_producto),
    FOREIGN KEY (id_detalle_ingreso) REFERENCES detalle_ingreso(id_detalle_ingreso),
    FOREIGN KEY (id_detalle_orden) REFERENCES detalle_orden(id_detalle_orden),
    FOREIGN KEY (id_institucion) REFERENCES institucion(id_institucion),
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
    FOREIGN KEY (id_proveedor) REFERENCES proveedor(id_proveedor),
    CONSTRAINT chk_movimiento_origen CHECK (
        (id_detalle_ingreso IS NOT NULL AND id_detalle_orden IS NULL)
        OR
        (id_detalle_ingreso IS NULL AND id_detalle_orden IS NOT NULL)
        OR
        (id_detalle_ingreso IS NULL AND id_detalle_orden IS NULL) -- movimientos directos
    )
);

-- ÍNDICES 

CREATE INDEX idx_movimiento_producto ON movimiento_stock(id_producto);
CREATE INDEX idx_pedido_institucion ON pedido(id_institucion);
CREATE INDEX idx_orden_institucion ON orden_dispensacion(id_institucion);


-- LÍMITES DE STOCK POR INSTITUCIÓN


CREATE TABLE limite_stock (
    id_limite SERIAL PRIMARY KEY,
    id_institucion INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad_maxima INT NOT NULL CHECK (cantidad_maxima >= 0),
    periodo VARCHAR(20) DEFAULT 'anual',
    id_usuario_asigna INT,
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    observacion TEXT,
    FOREIGN KEY (id_institucion) REFERENCES institucion(id_institucion),
    FOREIGN KEY (id_producto) REFERENCES producto(id_producto),
    FOREIGN KEY (id_usuario_asigna) REFERENCES usuario(id_usuario),
    UNIQUE(id_institucion, id_producto, periodo)
);


-- SUPERVISIÓN Y DIRECCIÓN DE ÁREA


CREATE TABLE supervisor_escuela_asignacion (
    id SERIAL PRIMARY KEY,
    supervisor_id INT NOT NULL,
    institucion_id INT NOT NULL,
    director_area_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supervisor_id) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (institucion_id) REFERENCES institucion(id_institucion) ON DELETE CASCADE,
    FOREIGN KEY (director_area_id) REFERENCES usuario(id_usuario),
    UNIQUE (supervisor_id, institucion_id)
);

CREATE TABLE solicitud_informe_supervisor (
    id SERIAL PRIMARY KEY,
    supervisor_id INT NOT NULL,
    director_area_id INT,
    asunto VARCHAR(180) NOT NULL,
    detalle TEXT,
    fecha_limite DATE,
    estado VARCHAR(20) DEFAULT 'pendiente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supervisor_id) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (director_area_id) REFERENCES usuario(id_usuario)
);


-- PLANILLAS DE PEDIDO ANUAL (COMPRAS)


CREATE TABLE planilla_pedido_anual (
    id SERIAL PRIMARY KEY,
    director_area_id INT NOT NULL,
    anio INT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'borrador',
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    enviada_at TIMESTAMP,
    FOREIGN KEY (director_area_id) REFERENCES usuario(id_usuario)
);

CREATE TABLE planilla_pedido_anual_detalle (
    id SERIAL PRIMARY KEY,
    planilla_id INT NOT NULL,
    id_pedido INT NOT NULL,
    id_institucion INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT NOT NULL,
    notas TEXT,
    FOREIGN KEY (planilla_id) REFERENCES planilla_pedido_anual(id) ON DELETE CASCADE,
    FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido),
    FOREIGN KEY (id_institucion) REFERENCES institucion(id_institucion),
    FOREIGN KEY (id_producto) REFERENCES producto(id_producto)
);