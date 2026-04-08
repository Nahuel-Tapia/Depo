-- ENUMS

CREATE TYPE estado_tramite AS ENUM ('pendiente', 'en_revision', 'aprobado_parcial', 'aprobado', 'rechazado', 'finalizado');
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

CREATE TABLE producto (
    id_producto SERIAL PRIMARY KEY,
    nombre VARCHAR(100),
    unidad_medida VARCHAR(20),
    stock_minimo INT DEFAULT 0 CHECK (stock_minimo >= 0),
    id_categoria INT,
    FOREIGN KEY (id_categoria) REFERENCES categoria(id_categoria)
);


-- PEDIDOS Y APROBACIONES


CREATE TABLE pedido (
    id_pedido SERIAL PRIMARY KEY,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado estado_tramite DEFAULT 'pendiente',
    id_usuario_solicitante INT,
    id_institucion INT,
    observaciones_generales TEXT,
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
    contacto VARCHAR(100)
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
    FOREIGN KEY (id_producto) REFERENCES producto(id_producto),
    FOREIGN KEY (id_detalle_ingreso) REFERENCES detalle_ingreso(id_detalle_ingreso),
    FOREIGN KEY (id_detalle_orden) REFERENCES detalle_orden(id_detalle_orden),
    CONSTRAINT chk_movimiento_origen CHECK (
        (id_detalle_ingreso IS NOT NULL AND id_detalle_orden IS NULL)
        OR
        (id_detalle_ingreso IS NULL AND id_detalle_orden IS NOT NULL)
    )
);

-- ÍNDICES 

CREATE INDEX idx_movimiento_producto ON movimiento_stock(id_producto);
CREATE INDEX idx_pedido_institucion ON pedido(id_institucion);
CREATE INDEX idx_orden_institucion ON orden_dispensacion(id_institucion);