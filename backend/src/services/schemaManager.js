const bcrypt = require("bcryptjs");
const { pool, run } = require("../db.pg");

/**
 * Centralized DB schema initialization and migrations.
 * This function consolidates all migrations previously done on the fly across different route files.
 * It is called once during server startup.
 */
async function initDatabaseSchema() {
  console.log("[schemaManager] Starting database schema verification and migrations...");
  const client = await pool.connect();

  try {
    // 0. Compatibility Schema & Admin Seed
    try {
      await client.query("ALTER TABLE IF EXISTS producto ADD COLUMN IF NOT EXISTS marca VARCHAR(120)");
      await client.query("ALTER TABLE IF EXISTS zona ADD COLUMN IF NOT EXISTS nombre VARCHAR(120)");
      await client.query("UPDATE zona SET nombre = name WHERE nombre IS NULL AND name IS NOT NULL");
      await client.query("ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_dni_key");

      const adminRes = await client.query("SELECT id_usuario FROM usuario WHERE email = $1", ["admin@depo.local"]);
      if (adminRes.rowCount === 0) {
        const hash = bcrypt.hashSync("Admin123!", 10);
        await client.query(
          `INSERT INTO usuario (nombre, apellido, dni, email, password, role, activo, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
           ON CONFLICT (email) DO NOTHING`,
          ["Administrador", "Inicial", "00000000", "admin@depo.local", hash, "admin"]
        );
      }
    } catch (err) {
      console.warn("[schemaManager] Warning in compatibility checks or admin seed:", err.message);
    }

    // 1. Types / Enums
    try {
      await client.query(`
        DO $$
        BEGIN
          -- Add cancelado and pendiente_director to estado_tramite if they do not exist
          IF NOT EXISTS (
            SELECT 1 FROM pg_type t
            JOIN pg_enum e ON e.enumtypid = t.oid
            WHERE t.typname = 'estado_tramite' AND e.enumlabel = 'cancelado'
          ) THEN
            ALTER TYPE estado_tramite ADD VALUE 'cancelado';
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM pg_type t
            JOIN pg_enum e ON e.enumtypid = t.oid
            WHERE t.typname = 'estado_tramite' AND e.enumlabel = 'pendiente_director'
          ) THEN
            ALTER TYPE estado_tramite ADD VALUE 'pendiente_director';
          END IF;

          -- Add traslado to tipo_movimiento if it does not exist
          IF NOT EXISTS (
            SELECT 1 FROM pg_type t
            JOIN pg_enum e ON e.enumtypid = t.oid
            WHERE t.typname = 'tipo_movimiento' AND e.enumlabel = 'traslado'
          ) THEN
            ALTER TYPE tipo_movimiento ADD VALUE 'traslado';
          END IF;
        END
        $$;
      `);
    } catch (err) {
      console.warn("[schemaManager] Warning initializing types/enums:", err.message);
    }

    // 2. Base Alterations (users)
    try {
      await client.query(`
        ALTER TABLE usuario ADD COLUMN IF NOT EXISTS nivel_educativo VARCHAR(120);
        ALTER TABLE usuario ADD COLUMN IF NOT EXISTS director_area_id INT REFERENCES usuario(id_usuario);
        ALTER TABLE usuario ADD COLUMN IF NOT EXISTS jurisdiccion VARCHAR(120);
      `);
    } catch (err) {
      console.warn("[schemaManager] Warning altering table usuario:", err.message);
    }

    // 3. Proveedores Alterations
    try {
      const proveedorCols = [
        "razon_social VARCHAR(255)",
        "direccion VARCHAR(255)",
        "rubro VARCHAR(100)",
        "email_secundario VARCHAR(100)",
        "sitio_web VARCHAR(255)",
        "observaciones TEXT"
      ];
      for (const col of proveedorCols) {
        try {
          await client.query(`ALTER TABLE proveedor ADD COLUMN IF NOT EXISTS ${col}`);
        } catch (err) {
          console.warn(`[schemaManager] Warning adding column ${col} to proveedor:`, err.message);
        }
      }
    } catch (err) {
      console.warn("[schemaManager] Warning altering table proveedor:", err.message);
    }

    // 4. Movimiento Stock y Deposito Alterations
    try {
      await client.query(`
        ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;
        ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS id_deposito INT;
        ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS id_deposito_destino INT;
      `);
      await client.query(`
        ALTER TABLE deposito ADD COLUMN IF NOT EXISTS tipo_deposito VARCHAR(40) DEFAULT 'central';
      `);
      // Seed desguace deposit if it doesn't exist
      await client.query(`
        INSERT INTO deposito (nombre, tipo_deposito)
        SELECT 'Depósito de Desguace (Scrap)', 'desguace'
        WHERE NOT EXISTS (
          SELECT 1 FROM deposito WHERE tipo_deposito = 'desguace'
        );
      `);
    } catch (err) {
      console.warn("[schemaManager] Warning altering tables in step 4:", err.message);
    }

    // 5. Product Kit Table & Alterations
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS producto_kit (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(180) NOT NULL,
          tipo_escuela VARCHAR(40) NOT NULL,
          descripcion TEXT,
          cantidad_alumnos INT,
          activo BOOLEAN NOT NULL DEFAULT TRUE,
          created_by INT REFERENCES usuario(id_usuario),
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      await client.query(`ALTER TABLE producto_kit ADD COLUMN IF NOT EXISTS cantidad_alumnos INT;`);
    } catch (err) {
      console.warn("[schemaManager] Warning creating/altering table producto_kit:", err.message);
    }

    // 6. Institucion Alterations
    try {
      await client.query(`
        ALTER TABLE institucion ADD COLUMN IF NOT EXISTS tipo_escuela VARCHAR(40);
        ALTER TABLE institucion ADD COLUMN IF NOT EXISTS matriculados INT DEFAULT 0;
        ALTER TABLE institucion ADD COLUMN IF NOT EXISTS kit_id INT REFERENCES producto_kit(id);
      `);
    } catch (err) {
      console.warn("[schemaManager] Warning altering table institucion:", err.message);
    }

    // 7. Seed/Update Institucion tipo_escuela
    try {
      await client.query(`
        UPDATE institucion
        SET tipo_escuela = CASE
          WHEN COALESCE(tipo_escuela, '') <> '' THEN tipo_escuela
          WHEN LOWER(COALESCE(categoria, '')) LIKE '%alberg%' OR LOWER(COALESCE(ambito, '')) LIKE '%alberg%' THEN 'albergue'
          WHEN LOWER(COALESCE(categoria, '')) LIKE '%jornada%' OR LOWER(COALESCE(ambito, '')) LIKE '%jornada%' THEN 'jornada_extendida'
          ELSE 'normal'
        END;
      `);
    } catch (err) {
      console.warn("[schemaManager] Warning updating institucion tipo_escuela:", err.message);
    }

    // 8. Pedido Alterations
    try {
      await client.query(`
        ALTER TABLE pedido ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'anual';
        ALTER TABLE pedido ADD COLUMN IF NOT EXISTS aprobado_por_supervisor_id INT REFERENCES usuario(id_usuario);
        ALTER TABLE pedido ADD COLUMN IF NOT EXISTS fecha_aprobacion_supervisor TIMESTAMP;
        ALTER TABLE pedido ADD COLUMN IF NOT EXISTS motivo_supervisor TEXT;
        ALTER TABLE pedido ADD COLUMN IF NOT EXISTS respuesta_supervisor_tipo VARCHAR(30);
        ALTER TABLE pedido ADD COLUMN IF NOT EXISTS kit_id INT;
        ALTER TABLE pedido ADD COLUMN IF NOT EXISTS kit_nombre VARCHAR(180);
        ALTER TABLE pedido ADD COLUMN IF NOT EXISTS kit_cantidad NUMERIC(12,2);
        ALTER TABLE pedido ADD COLUMN IF NOT EXISTS aprobado_por_director_id INT REFERENCES usuario(id_usuario);
        ALTER TABLE pedido ADD COLUMN IF NOT EXISTS fecha_aprobacion_director TIMESTAMP;
        ALTER TABLE pedido ADD COLUMN IF NOT EXISTS requiere_licitacion BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE pedido ADD COLUMN IF NOT EXISTS estado_abastecimiento VARCHAR(40) NOT NULL DEFAULT 'stock_disponible';
        ALTER TABLE pedido ADD COLUMN IF NOT EXISTS aprobado_director_area BOOLEAN DEFAULT FALSE;
        ALTER TABLE pedido ADD COLUMN IF NOT EXISTS codigo_retiro VARCHAR(20);
      `);
    } catch (err) {
      console.warn("[schemaManager] Warning altering table pedido:", err.message);
    }

    // 9. Detalle Pedido Alterations
    try {
      await client.query(`
        ALTER TABLE detalle_pedido ADD COLUMN IF NOT EXISTS requiere_licitacion BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE detalle_pedido ADD COLUMN IF NOT EXISTS stock_disponible_relevado NUMERIC(12,2);
      `);
    } catch (err) {
      console.warn("[schemaManager] Warning altering table detalle_pedido:", err.message);
    }

    // 10. Producto Kit Detalle
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS producto_kit_detalle (
          id SERIAL PRIMARY KEY,
          kit_id INT NOT NULL REFERENCES producto_kit(id) ON DELETE CASCADE,
          id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
          cantidad NUMERIC(12,2) NOT NULL,
          UNIQUE (kit_id, id_producto)
        );
      `);
    } catch (err) {
      console.warn("[schemaManager] Warning creating table producto_kit_detalle:", err.message);
    }

    // 11. Kit Producto Anual
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS kit_producto_anual (
          id SERIAL PRIMARY KEY,
          tipo_escuela VARCHAR(40) NOT NULL,
          id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
          cantidad_base INT NOT NULL DEFAULT 0,
          alumnos_por_unidad INT NOT NULL DEFAULT 100,
          cantidad_por_unidad INT NOT NULL DEFAULT 0,
          activo BOOLEAN NOT NULL DEFAULT TRUE,
          UNIQUE (tipo_escuela, id_producto)
        );
      `);
      // Seed kit_producto_anual
      await client.query(`
        INSERT INTO kit_producto_anual (tipo_escuela, id_producto, cantidad_base, alumnos_por_unidad, cantidad_por_unidad)
        SELECT
          tipos.tipo_escuela,
          p.id_producto,
          CASE
            WHEN tipos.tipo_escuela = 'albergue' THEN 14
            WHEN tipos.tipo_escuela = 'jornada_extendida' THEN 12
            ELSE 10
          END,
          100,
          CASE
            WHEN tipos.tipo_escuela = 'albergue' THEN 3
            ELSE 2
          END
        FROM producto p
        CROSS JOIN (VALUES ('normal'), ('albergue'), ('jornada_extendida')) AS tipos(tipo_escuela)
        ON CONFLICT (tipo_escuela, id_producto) DO NOTHING;
      `);
    } catch (err) {
      console.warn("[schemaManager] Warning creating/seeding kit_producto_anual:", err.message);
    }

    // 12. Supervisor Escuela Asignacion
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS supervisor_escuela_asignacion (
          id SERIAL PRIMARY KEY,
          supervisor_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
          institucion_id INT NOT NULL REFERENCES institucion(id_institucion) ON DELETE CASCADE,
          director_area_id INT REFERENCES usuario(id_usuario),
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE (supervisor_id, institucion_id)
        );
      `);
    } catch (err) {
      console.warn("[schemaManager] Warning creating table supervisor_escuela_asignacion:", err.message);
    }

    // 13. Zonas
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS zona (
          id SERIAL PRIMARY KEY,
          name VARCHAR(150) NOT NULL,
          nivel_educativo VARCHAR(120) NOT NULL,
          departamento VARCHAR(120),
          director_area_id INT NOT NULL REFERENCES usuario(id_usuario),
          activo BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS zona_institucion (
          zona_id INT NOT NULL REFERENCES zona(id) ON DELETE CASCADE,
          institucion_id INT NOT NULL REFERENCES institucion(id_institucion) ON DELETE CASCADE,
          PRIMARY KEY (zona_id, institucion_id)
        );

        CREATE TABLE IF NOT EXISTS zona_supervisor (
          zona_id INT NOT NULL REFERENCES zona(id) ON DELETE CASCADE,
          supervisor_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT NOW(),
          PRIMARY KEY (zona_id, supervisor_id)
        );
      `);
    } catch (err) {
      console.warn("[schemaManager] Warning creating zone tables:", err.message);
    }

    // 14. Planilla Pedido Anual
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS planilla_pedido_anual (
          id SERIAL PRIMARY KEY,
          director_area_id INT NOT NULL REFERENCES usuario(id_usuario),
          anio INT NOT NULL,
          estado VARCHAR(20) NOT NULL DEFAULT 'borrador',
          observaciones TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          enviada_at TIMESTAMP
        );
      `);

      await client.query(`
        ALTER TABLE planilla_pedido_anual ADD COLUMN IF NOT EXISTS aceptada_at TIMESTAMP;
        ALTER TABLE planilla_pedido_anual ADD COLUMN IF NOT EXISTS aceptada_por INT REFERENCES usuario(id_usuario);
        ALTER TABLE planilla_pedido_anual ADD COLUMN IF NOT EXISTS direccion_area VARCHAR(100);
        ALTER TABLE planilla_pedido_anual ADD COLUMN IF NOT EXISTS motivo_devolucion TEXT;
      `);

      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_planilla_anio_direccion
        ON planilla_pedido_anual (anio, direccion_area)
        WHERE estado IN ('enviada', 'aceptada', 'adjudicada', 'cerrada')
          AND direccion_area IS NOT NULL;
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS planilla_pedido_anual_detalle (
          id SERIAL PRIMARY KEY,
          planilla_id INT NOT NULL REFERENCES planilla_pedido_anual(id) ON DELETE CASCADE,
          id_pedido INT NOT NULL REFERENCES pedido(id_pedido),
          id_institucion INT NOT NULL REFERENCES institucion(id_institucion),
          id_producto INT NOT NULL REFERENCES producto(id_producto),
          cantidad INT NOT NULL,
          notas TEXT
        );
      `);

      // Update deprecated statuses
      await client.query(`
        UPDATE planilla_pedido_anual
        SET estado = 'aceptada'
        WHERE estado = 'procesada';
      `);
    } catch (err) {
      console.warn("[schemaManager] Warning creating/altering planilla tables:", err.message);
    }

    // 15. Licitacion Publicada
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS licitacion_publicada (
          id SERIAL PRIMARY KEY,
          anio INT NOT NULL UNIQUE,
          usuario_id INT,
          items JSONB NOT NULL DEFAULT '[]'::jsonb,
          fecha_publicacion TIMESTAMP DEFAULT NOW(),
          estado VARCHAR(30) NOT NULL DEFAULT 'publicada'
        );
      `);

      await client.query(`
        ALTER TABLE licitacion_publicada ADD COLUMN IF NOT EXISTS usuario_id INT;
        ALTER TABLE licitacion_publicada ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb;
        ALTER TABLE licitacion_publicada ADD COLUMN IF NOT EXISTS fecha_publicacion TIMESTAMP DEFAULT NOW();
        ALTER TABLE licitacion_publicada ADD COLUMN IF NOT EXISTS estado VARCHAR(30) NOT NULL DEFAULT 'publicada';
        ALTER TABLE licitacion_publicada ADD COLUMN IF NOT EXISTS titulo VARCHAR(255);
        ALTER TABLE licitacion_publicada ADD COLUMN IF NOT EXISTS motivo TEXT;
        ALTER TABLE licitacion_publicada ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'anual';
      `);

      // Drop unique constraint on 'anio' if it was removed in previous updates
      try {
        await client.query(`ALTER TABLE licitacion_publicada DROP CONSTRAINT IF EXISTS licitacion_publicada_anio_key;`);
      } catch (err) {
        // Safe to ignore
      }
    } catch (err) {
      console.warn("[schemaManager] Warning creating/altering licitacion_publicada:", err.message);
    }

    // 16. Compra Precio Historico
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS compra_precio_historico (
          id SERIAL PRIMARY KEY,
          anio INT NOT NULL,
          id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
          id_proveedor INT NOT NULL REFERENCES proveedor(id_proveedor),
          precio_compra_real NUMERIC(14,2) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      try {
        await client.query(`ALTER TABLE compra_precio_historico DROP CONSTRAINT IF EXISTS compra_precio_historico_anio_id_producto_key;`);
      } catch (e) {}

      await client.query(`ALTER TABLE compra_precio_historico ADD COLUMN IF NOT EXISTS licitacion_id INT REFERENCES licitacion_publicada(id);`);

      // Add unique constraint for (licitacion_id, id_producto) if not exists
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'compra_precio_historico_licitacion_producto_key'
          ) THEN
            ALTER TABLE compra_precio_historico
            ADD CONSTRAINT compra_precio_historico_licitacion_producto_key UNIQUE (licitacion_id, id_producto);
          END IF;
        END
        $$;
      `);
    } catch (err) {
      console.warn("[schemaManager] Warning creating/altering compra_precio_historico:", err.message);
    }

    // 17. Remito & Recepcion Licitacion
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS remito_licitacion (
          id SERIAL PRIMARY KEY,
          numero VARCHAR(30) NOT NULL UNIQUE,
          licitacion_id INT NOT NULL,
          id_deposito INT,
          usuario_id INT,
          observaciones TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS recepcion_licitacion (
          id SERIAL PRIMARY KEY,
          licitacion_id INT NOT NULL,
          producto_id INT NOT NULL,
          cantidad_recibida NUMERIC(12,2) NOT NULL,
          usuario_id INT,
          id_deposito INT,
          fecha_vencimiento DATE,
          observaciones TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      await client.query(`
        ALTER TABLE remito_licitacion ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
        ALTER TABLE recepcion_licitacion ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
        ALTER TABLE recepcion_licitacion ADD COLUMN IF NOT EXISTS remito_id INT REFERENCES remito_licitacion(id);
        ALTER TABLE recepcion_licitacion ADD COLUMN IF NOT EXISTS cantidad_danada NUMERIC(12,2) NOT NULL DEFAULT 0;
        ALTER TABLE recepcion_licitacion ADD COLUMN IF NOT EXISTS obs_danio TEXT;
      `);
    } catch (err) {
      console.warn("[schemaManager] Warning creating/altering remito/recepcion tables:", err.message);
    }

    // 18. Recepcion Danio Imagen & Entrega Anual
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS recepcion_danio_imagen (
          id SERIAL PRIMARY KEY,
          remito_id INT NOT NULL REFERENCES remito_licitacion(id),
          producto_id INT,
          nombre VARCHAR(255),
          mime_type VARCHAR(80),
          datos TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS entrega_anual (
          id SERIAL PRIMARY KEY,
          id_institucion INT NOT NULL,
          anio INT NOT NULL,
          id_producto INT NOT NULL,
          cantidad_entregada NUMERIC(12,2) NOT NULL,
          id_deposito INT,
          id_usuario INT,
          observaciones TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
    } catch (err) {
      console.warn("[schemaManager] Warning creating recepcion_danio_imagen or entrega_anual:", err.message);
    }

    // 19. Distribucion Lote
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS distribucion_lote (
          id SERIAL PRIMARY KEY,
          anio INT NOT NULL,
          zona_id INT,
          id_deposito INT NOT NULL,
          estado VARCHAR(30) NOT NULL DEFAULT 'en_transito',
          observaciones TEXT,
          usuario_id INT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      await client.query(`
        ALTER TABLE distribucion_lote ADD COLUMN IF NOT EXISTS origen VARCHAR(30) NOT NULL DEFAULT 'distribucion_zonal';
        ALTER TABLE distribucion_lote ADD COLUMN IF NOT EXISTS departamento VARCHAR(120);
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS distribucion_lote_item (
          id SERIAL PRIMARY KEY,
          lote_id INT NOT NULL REFERENCES distribucion_lote(id) ON DELETE CASCADE,
          id_institucion INT NOT NULL,
          id_producto INT NOT NULL,
          cantidad_planificada NUMERIC(12,2) NOT NULL,
          cantidad_recibida NUMERIC(12,2),
          estado_recepcion VARCHAR(20) NOT NULL DEFAULT 'pendiente',
          observaciones_directivo TEXT,
          reclamo_directivo TEXT,
          directivo_usuario_id INT,
          recibido_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE (lote_id, id_institucion, id_producto)
        );
      `);

      await client.query(`
        ALTER TABLE distribucion_lote_item ADD COLUMN IF NOT EXISTS cantidad_danada NUMERIC(12,2) NOT NULL DEFAULT 0;
        ALTER TABLE distribucion_lote_item ADD COLUMN IF NOT EXISTS detalle_danio TEXT;
        ALTER TABLE distribucion_lote_item ADD COLUMN IF NOT EXISTS coincide_esperado BOOLEAN DEFAULT TRUE;
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS distribucion_lote_item_imagen (
          id SERIAL PRIMARY KEY,
          lote_item_id INT NOT NULL REFERENCES distribucion_lote_item(id) ON DELETE CASCADE,
          id_institucion INT NOT NULL,
          id_producto INT NOT NULL,
          nombre VARCHAR(255),
          mime_type VARCHAR(80),
          datos TEXT NOT NULL,
          directivo_usuario_id INT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
    } catch (err) {
      console.warn("[schemaManager] Warning creating/altering distribution lotes tables:", err.message);
    }

    // 20. Pedido Entrega
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS pedido_entrega (
          id SERIAL PRIMARY KEY,
          id_pedido INT NOT NULL REFERENCES pedido(id_pedido) ON DELETE CASCADE,
          id_movimiento INT REFERENCES movimiento_stock(id_movimiento) ON DELETE SET NULL,
          id_producto INT NOT NULL REFERENCES producto(id_producto),
          cantidad_entregada INT NOT NULL,
          fecha_entrega TIMESTAMP DEFAULT NOW(),
          id_usuario INT REFERENCES usuario(id_usuario),
          observaciones TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      await client.query(`ALTER TABLE pedido_entrega ADD COLUMN IF NOT EXISTS id_solicitud_retiro INT;`);
    } catch (err) {
      console.warn("[schemaManager] Warning creating/altering table pedido_entrega:", err.message);
    }

    // 21. Solicitud Retiro
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS solicitud_retiro (
          id SERIAL PRIMARY KEY,
          id_pedido INT NOT NULL REFERENCES pedido(id_pedido) ON DELETE CASCADE,
          id_institucion INT NOT NULL REFERENCES institucion(id_institucion),
          id_usuario_solicitante INT NOT NULL REFERENCES usuario(id_usuario),
          fecha_retiro DATE NOT NULL,
          retira_tipo VARCHAR(20) NOT NULL,
          retira_nombre VARCHAR(180),
          retira_dni VARCHAR(30),
          estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
          id_usuario_acepta INT REFERENCES usuario(id_usuario),
          fecha_aceptacion TIMESTAMP,
          id_usuario_entrega INT REFERENCES usuario(id_usuario),
          fecha_entrega TIMESTAMP,
          observaciones TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      await client.query(`
        ALTER TABLE solicitud_retiro ADD COLUMN IF NOT EXISTS id_usuario_acepta INT REFERENCES usuario(id_usuario);
        ALTER TABLE solicitud_retiro ADD COLUMN IF NOT EXISTS fecha_aceptacion TIMESTAMP;
        ALTER TABLE solicitud_retiro ADD COLUMN IF NOT EXISTS id_usuario_entrega INT REFERENCES usuario(id_usuario);
        ALTER TABLE solicitud_retiro ADD COLUMN IF NOT EXISTS fecha_entrega TIMESTAMP;
        ALTER TABLE solicitud_retiro ADD COLUMN IF NOT EXISTS observaciones TEXT;
        ALTER TABLE solicitud_retiro ADD COLUMN IF NOT EXISTS solicitar_envio BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE solicitud_retiro ADD COLUMN IF NOT EXISTS departamento_envio TEXT;
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS solicitud_retiro_detalle (
          id SERIAL PRIMARY KEY,
          id_solicitud_retiro INT NOT NULL REFERENCES solicitud_retiro(id) ON DELETE CASCADE,
          id_producto INT NOT NULL REFERENCES producto(id_producto),
          cantidad_solicitada INT NOT NULL,
          cantidad_entregada INT,
          id_movimiento INT REFERENCES movimiento_stock(id_movimiento) ON DELETE SET NULL,
          UNIQUE (id_solicitud_retiro, id_producto)
        );
      `);
    } catch (err) {
      console.warn("[schemaManager] Warning creating/altering solicitud_retiro:", err.message);
    }

    // 22. Stock & Consumo Institucion, Notificaciones, Comentario Pedido
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS stock_institucion (
          id_institucion INT NOT NULL REFERENCES institucion(id_institucion) ON DELETE CASCADE,
          id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
          cantidad NUMERIC(12,2) DEFAULT 0,
          PRIMARY KEY (id_institucion, id_producto)
        );

        CREATE TABLE IF NOT EXISTS consumo_institucion (
          id_consumo SERIAL PRIMARY KEY,
          id_institucion INT NOT NULL REFERENCES institucion(id_institucion) ON DELETE CASCADE,
          id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
          id_usuario INT REFERENCES usuario(id_usuario),
          cantidad NUMERIC(12,2) NOT NULL,
          fecha TIMESTAMP DEFAULT NOW(),
          motivo TEXT
        );

        CREATE TABLE IF NOT EXISTS notificacion (
          id_notificacion SERIAL PRIMARY KEY,
          id_usuario INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
          titulo VARCHAR(150) NOT NULL,
          mensaje TEXT,
          leida BOOLEAN DEFAULT FALSE,
          tipo VARCHAR(30) DEFAULT 'info',
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS comentario_pedido (
          id_comentario SERIAL PRIMARY KEY,
          id_pedido INT NOT NULL REFERENCES pedido(id_pedido) ON DELETE CASCADE,
          id_usuario INT NOT NULL REFERENCES usuario(id_usuario),
          mensaje TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
    } catch (err) {
      console.warn("[schemaManager] Warning creating stock/notification tables:", err.message);
    }

    // 23. Patrimonio Tickets
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS patrimonio_ticket (
          id SERIAL PRIMARY KEY,
          institucion_id INT,
          categoria VARCHAR(120),
          descripcion TEXT,
          prioridad VARCHAR(30),
          estado VARCHAR(30) DEFAULT 'pendiente',
          observacion TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
    } catch (err) {
      console.warn("[schemaManager] Warning creating table patrimonio_ticket:", err.message);
    }

    // 24. Baja Movimientos
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.baja_movimientos (
          id SERIAL PRIMARY KEY,
          id_producto INTEGER NOT NULL,
          cantidad INTEGER NOT NULL DEFAULT 1,
          motivo TEXT,
          foto_path VARCHAR(255),
          id_usuario INTEGER NOT NULL,
          id_deposito INTEGER,
          "createdAt" TIMESTAMP DEFAULT NOW(),
          "updatedAt" TIMESTAMP DEFAULT NOW()
        );
      `);
      await client.query(`
        ALTER TABLE public.baja_movimientos 
        ADD COLUMN IF NOT EXISTS id_deposito INTEGER;
        ALTER TABLE public.baja_movimientos
        ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'pendiente';
      `);
    } catch (err) {
      console.warn("[schemaManager] Warning creating table baja_movimientos:", err.message);
    }

    // 25. Optimization Indexes (Performance and Scalability)
    try {
      await client.query("CREATE INDEX IF NOT EXISTS idx_detalle_pedido_pedido ON detalle_pedido (id_pedido)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_detalle_pedido_producto ON detalle_pedido (id_producto)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_movimiento_stock_deposito ON movimiento_stock (id_deposito)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_movimiento_stock_usuario ON movimiento_stock (id_usuario)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_movimiento_stock_institucion ON movimiento_stock (id_institucion)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_stock_institucion_producto ON stock_institucion (id_producto)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_solicitud_retiro_pedido ON solicitud_retiro (id_pedido)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_solicitud_retiro_detalle_solicitud ON solicitud_retiro_detalle (id_solicitud_retiro)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_distribucion_lote_item_lote ON distribucion_lote_item (lote_id)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_comentario_pedido_pedido ON comentario_pedido (id_pedido)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_supervisor_escuela_supervisor ON supervisor_escuela_asignacion (supervisor_id)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_supervisor_escuela_institucion ON supervisor_escuela_asignacion (institucion_id)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_zona_institucion_institucion ON zona_institucion (institucion_id)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_zona_supervisor_supervisor ON zona_supervisor (supervisor_id)");
    } catch (err) {
      console.warn("[schemaManager] Warning creating performance indexes:", err.message);
    }

    // 26. Consumo Institucion — agregar columna categoria si no existe
    try {
      await client.query(`ALTER TABLE consumo_institucion ADD COLUMN IF NOT EXISTS categoria VARCHAR(60)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_consumo_institucion_inst ON consumo_institucion (id_institucion)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_consumo_institucion_fecha ON consumo_institucion (fecha DESC)`);
    } catch (err) {
      console.warn("[schemaManager] Warning altering consumo_institucion:", err.message);
    }

    console.log("[schemaManager] Database schema and migrations completed successfully!");
  } finally {
    client.release();
  }
}

module.exports = {
  initDatabaseSchema
};
