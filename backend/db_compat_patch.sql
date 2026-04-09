BEGIN;

-- Tipos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_bien') THEN
    CREATE TYPE tipo_bien AS ENUM ('consumible', 'patrimonial');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_movimiento') THEN
    CREATE TYPE tipo_movimiento AS ENUM ('ingreso', 'egreso', 'ajuste', 'devolucion');
  END IF;
END $$;

-- Estructura base minima
CREATE TABLE IF NOT EXISTS edificio (
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

CREATE TABLE IF NOT EXISTS institucion (
  id_institucion SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  cue VARCHAR(20) NOT NULL,
  id_edificio INT REFERENCES edificio(id_edificio),
  establecimiento_cabecera VARCHAR(100),
  nivel_educativo VARCHAR(50),
  categoria VARCHAR(20),
  ambito VARCHAR(20),
  activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS usuario (
  id_usuario SERIAL PRIMARY KEY,
  nombre VARCHAR(50),
  apellido VARCHAR(50),
  dni VARCHAR(20) UNIQUE,
  email VARCHAR(100) UNIQUE,
  password VARCHAR(255),
  telefono VARCHAR(20),
  id_institucion INT REFERENCES institucion(id_institucion),
  role VARCHAR(50),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categoria (
  id_categoria SERIAL PRIMARY KEY,
  nombre VARCHAR(50),
  tipo_bien tipo_bien DEFAULT 'consumible'
);

CREATE TABLE IF NOT EXISTS producto (
  id_producto SERIAL PRIMARY KEY,
  nombre VARCHAR(100),
  unidad_medida VARCHAR(20),
  stock_actual INT DEFAULT 0 CHECK (stock_actual >= 0),
  stock_minimo INT DEFAULT 0 CHECK (stock_minimo >= 0),
  id_categoria INT REFERENCES categoria(id_categoria)
);

CREATE TABLE IF NOT EXISTS proveedor (
  id_proveedor SERIAL PRIMARY KEY,
  nombre VARCHAR(100),
  cuit VARCHAR(20) UNIQUE,
  contacto VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS movimiento_stock (
  id_movimiento SERIAL PRIMARY KEY,
  id_producto INT REFERENCES producto(id_producto),
  cantidad INT NOT NULL,
  tipo tipo_movimiento,
  fecha_movimiento TIMESTAMP DEFAULT NOW(),
  estado_producto VARCHAR(50),
  cargo_retira VARCHAR(50),
  id_institucion INT REFERENCES institucion(id_institucion),
  id_usuario INT REFERENCES usuario(id_usuario),
  motivo TEXT
);

-- Columnas de compatibilidad
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS role VARCHAR(50);
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

ALTER TABLE institucion ADD COLUMN IF NOT EXISTS nivel VARCHAR(50);
ALTER TABLE institucion ADD COLUMN IF NOT EXISTS tipo VARCHAR(20);
ALTER TABLE institucion ADD COLUMN IF NOT EXISTS email VARCHAR(120);
ALTER TABLE institucion ADD COLUMN IF NOT EXISTS telefono VARCHAR(50);
ALTER TABLE institucion ADD COLUMN IF NOT EXISTS matriculados INT DEFAULT 0;
ALTER TABLE institucion ADD COLUMN IF NOT EXISTS factor_asignacion NUMERIC(10,2) DEFAULT 1.0;
ALTER TABLE institucion ADD COLUMN IF NOT EXISTS notas TEXT;
ALTER TABLE institucion ADD COLUMN IF NOT EXISTS limite_productos VARCHAR(1000);
ALTER TABLE institucion ADD COLUMN IF NOT EXISTS direccion VARCHAR(200);
ALTER TABLE institucion ADD COLUMN IF NOT EXISTS localidad VARCHAR(100);
ALTER TABLE institucion ADD COLUMN IF NOT EXISTS departamento VARCHAR(100);
ALTER TABLE institucion ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE producto ADD COLUMN IF NOT EXISTS codigo VARCHAR(50);
ALTER TABLE producto ADD COLUMN IF NOT EXISTS tipo VARCHAR(50) DEFAULT 'Insumos';
ALTER TABLE producto ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE producto ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE proveedor ADD COLUMN IF NOT EXISTS telefono VARCHAR(30);
ALTER TABLE proveedor ADD COLUMN IF NOT EXISTS email VARCHAR(120);
ALTER TABLE proveedor ADD COLUMN IF NOT EXISTS categoria VARCHAR(50);
ALTER TABLE proveedor ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;
ALTER TABLE proveedor ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE proveedor ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS id_proveedor INT;
ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS estado_producto VARCHAR(50);
ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS cargo_retira VARCHAR(50);
ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS id_institucion INT REFERENCES institucion(id_institucion);
ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS id_usuario INT REFERENCES usuario(id_usuario);
ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS motivo TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_movimiento_stock_proveedor'
  ) THEN
    ALTER TABLE movimiento_stock
      ADD CONSTRAINT fk_movimiento_stock_proveedor
      FOREIGN KEY (id_proveedor) REFERENCES proveedor(id_proveedor);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_producto_codigo_not_null
  ON producto(codigo) WHERE codigo IS NOT NULL;

-- Tablas funcionales usadas por rutas
CREATE TABLE IF NOT EXISTS auditoria (
  id SERIAL PRIMARY KEY,
  usuario_id INT,
  entidad VARCHAR(100) NOT NULL,
  accion VARCHAR(100) NOT NULL,
  id_registro INT,
  cambios JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_auditoria_usuario'
  ) THEN
    ALTER TABLE auditoria
      ADD CONSTRAINT fk_auditoria_usuario
      FOREIGN KEY (usuario_id) REFERENCES usuario(id_usuario) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ajustes (
  id SERIAL PRIMARY KEY,
  producto_id INT NOT NULL REFERENCES producto(id_producto),
  cantidad_anterior INT NOT NULL,
  cantidad_nueva INT NOT NULL,
  motivo TEXT NOT NULL,
  usuario_id INT REFERENCES usuario(id_usuario),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asignaciones_stock (
  id SERIAL PRIMARY KEY,
  institucion_id INT NOT NULL REFERENCES institucion(id_institucion) ON DELETE CASCADE,
  producto_id INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
  cantidad_asignada INT NOT NULL DEFAULT 0,
  cantidad_entregada INT NOT NULL DEFAULT 0,
  periodo VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_asignaciones_stock_periodo'
  ) THEN
    ALTER TABLE asignaciones_stock
      ADD CONSTRAINT uq_asignaciones_stock_periodo
      UNIQUE (institucion_id, producto_id, periodo);
  END IF;
END $$;

-- Convertir pedidos/movimientos a tabla si son vista
DO $$
DECLARE k "char";
BEGIN
  SELECT c.relkind
    INTO k
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'pedidos'
  LIMIT 1;

  IF k = 'v' THEN
    EXECUTE 'ALTER VIEW public.pedidos RENAME TO pedidos_legacy_view';
    EXECUTE '
      CREATE TABLE public.pedidos (
        id SERIAL PRIMARY KEY,
        usuario_id INT NOT NULL REFERENCES public.usuario(id_usuario),
        producto_id INT NOT NULL REFERENCES public.producto(id_producto),
        cantidad INT NOT NULL CHECK (cantidad > 0),
        institucion VARCHAR(255),
        estado VARCHAR(30) NOT NULL DEFAULT ''pendiente'',
        notas TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )';
  ELSIF k IS NULL THEN
    EXECUTE '
      CREATE TABLE public.pedidos (
        id SERIAL PRIMARY KEY,
        usuario_id INT NOT NULL REFERENCES public.usuario(id_usuario),
        producto_id INT NOT NULL REFERENCES public.producto(id_producto),
        cantidad INT NOT NULL CHECK (cantidad > 0),
        institucion VARCHAR(255),
        estado VARCHAR(30) NOT NULL DEFAULT ''pendiente'',
        notas TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )';
  END IF;
END $$;

DO $$
DECLARE k "char";
BEGIN
  SELECT c.relkind
    INTO k
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'movimientos'
  LIMIT 1;

  IF k = 'v' THEN
    EXECUTE 'ALTER VIEW public.movimientos RENAME TO movimientos_legacy_view';
    EXECUTE '
      CREATE TABLE public.movimientos (
        id SERIAL PRIMARY KEY,
        producto_id INT NOT NULL REFERENCES public.producto(id_producto),
        tipo VARCHAR(30) NOT NULL,
        cantidad INT NOT NULL CHECK (cantidad > 0),
        usuario_id INT REFERENCES public.usuario(id_usuario),
        motivo TEXT,
        cue VARCHAR(20),
        pedido_id INT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )';
  ELSIF k IS NULL THEN
    EXECUTE '
      CREATE TABLE public.movimientos (
        id SERIAL PRIMARY KEY,
        producto_id INT NOT NULL REFERENCES public.producto(id_producto),
        tipo VARCHAR(30) NOT NULL,
        cantidad INT NOT NULL CHECK (cantidad > 0),
        usuario_id INT REFERENCES public.usuario(id_usuario),
        motivo TEXT,
        cue VARCHAR(20),
        pedido_id INT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )';
  END IF;
END $$;

-- Triggers utilitarios
CREATE OR REPLACE FUNCTION fn_sync_nivel_institucion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.nivel_educativo IS NULL AND NEW.nivel IS NOT NULL THEN
    NEW.nivel_educativo := NEW.nivel;
  END IF;

  IF NEW.nivel IS NULL AND NEW.nivel_educativo IS NOT NULL THEN
    NEW.nivel := NEW.nivel_educativo;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_nivel_institucion ON institucion;
CREATE TRIGGER trg_sync_nivel_institucion
BEFORE INSERT OR UPDATE ON institucion
FOR EACH ROW
EXECUTE FUNCTION fn_sync_nivel_institucion();

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_institucion_updated_at ON institucion;
CREATE TRIGGER trg_institucion_updated_at
BEFORE UPDATE ON institucion
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_producto_updated_at ON producto;
CREATE TRIGGER trg_producto_updated_at
BEFORE UPDATE ON producto
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_proveedor_updated_at ON proveedor;
CREATE TRIGGER trg_proveedor_updated_at
BEFORE UPDATE ON proveedor
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_ajustes_updated_at ON ajustes;
CREATE TRIGGER trg_ajustes_updated_at
BEFORE UPDATE ON ajustes
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_asignaciones_stock_updated_at ON asignaciones_stock;
CREATE TRIGGER trg_asignaciones_stock_updated_at
BEFORE UPDATE ON asignaciones_stock
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_pedidos_updated_at ON pedidos;
CREATE TRIGGER trg_pedidos_updated_at
BEFORE UPDATE ON pedidos
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_movimientos_updated_at ON movimientos;
CREATE TRIGGER trg_movimientos_updated_at
BEFORE UPDATE ON movimientos
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Vistas de compatibilidad
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'users' AND c.relkind = 'v'
  ) THEN
    EXECUTE 'DROP VIEW public.users';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'productos' AND c.relkind = 'v'
  ) THEN
    EXECUTE 'DROP VIEW public.productos';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'instituciones' AND c.relkind = 'v'
  ) THEN
    EXECUTE 'DROP VIEW public.instituciones';
  END IF;
END $$;

CREATE VIEW users AS
SELECT
  u.id_usuario AS id,
  u.nombre,
  u.apellido,
  u.email,
  u.dni,
  u.password,
  u.telefono,
  u.role,
  u.activo,
  u.created_at,
  u.id_institucion,
  i.nombre AS institucion
FROM usuario u
LEFT JOIN institucion i ON i.id_institucion = u.id_institucion;

CREATE VIEW productos AS
SELECT
  p.id_producto AS id,
  p.codigo,
  p.nombre,
  p.unidad_medida,
  p.stock_actual,
  p.stock_minimo,
  p.id_categoria,
  p.tipo,
  p.created_at,
  p.updated_at
FROM producto p;

CREATE VIEW instituciones AS
SELECT
  i.id_institucion AS id,
  i.cue,
  i.nombre,
  i.nivel_educativo,
  i.nivel,
  i.tipo,
  i.matriculados,
  i.factor_asignacion,
  i.activo
FROM institucion i;

-- Indices si el objeto es tabla
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname='pedidos' AND c.relkind IN ('r','p')
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON public.pedidos(estado)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname='asignaciones_stock' AND c.relkind IN ('r','p')
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_asignaciones_periodo ON public.asignaciones_stock(periodo)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname='movimiento_stock' AND c.relkind IN ('r','p')
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_movimiento_stock_fecha ON public.movimiento_stock(fecha_movimiento DESC)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname='auditoria' AND c.relkind IN ('r','p')
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_auditoria_created_at ON public.auditoria(created_at DESC)';
  END IF;
END $$;

-- Semilla basica
INSERT INTO categoria (nombre, tipo_bien)
SELECT 'Insumos de limpieza', 'consumible'
WHERE NOT EXISTS (SELECT 1 FROM categoria WHERE nombre = 'Insumos de limpieza');

INSERT INTO categoria (nombre, tipo_bien)
SELECT 'Papelería/Librería', 'consumible'
WHERE NOT EXISTS (SELECT 1 FROM categoria WHERE nombre = 'Papelería/Librería');

INSERT INTO categoria (nombre, tipo_bien)
SELECT 'Otros', 'consumible'
WHERE NOT EXISTS (SELECT 1 FROM categoria WHERE nombre = 'Otros');

COMMIT;
