const { run } = require("./src/db.pg");

async function migrate() {
  try {
    console.log("Iniciando migración de estados y columnas...");

    // 1. Añadir estados al ENUM (si no existen)
    await run(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typname = 'estado_tramite' AND e.enumlabel = 'pendiente_director') THEN
          ALTER TYPE estado_tramite ADD VALUE 'pendiente_director';
        END IF;
      END
      $$;
    `);

    // 2. Añadir columnas a la tabla pedido
    await run(`
      ALTER TABLE pedido 
      ADD COLUMN IF NOT EXISTS aprobado_por_director_id INT REFERENCES usuario(id_usuario),
      ADD COLUMN IF NOT EXISTS fecha_aprobacion_director TIMESTAMP,
      ADD COLUMN IF NOT EXISTS aprobado_director_area BOOLEAN DEFAULT FALSE;
    `);

    console.log("Migración completada con éxito.");
  } catch (err) {
    console.error("Error en la migración:", err);
  } finally {
    process.exit();
  }
}

migrate();
