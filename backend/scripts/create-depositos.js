require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { Pool } = require("pg");
const dbConfig = require("../src/config/database");

const pool = new Pool(dbConfig);

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Crear tabla de depósitos
    await client.query(`
      CREATE TABLE IF NOT EXISTS deposito (
        id_deposito SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        descripcion TEXT,
        ubicacion VARCHAR(200),
        tipo VARCHAR(50) NOT NULL DEFAULT 'central', -- central, centro_civico, capsula
        activo BOOLEAN DEFAULT TRUE,
        deposito_padre_id INT REFERENCES deposito(id_deposito),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 2. Agregar columna id_deposito a movimiento_stock si no existe
    await client.query(`
      ALTER TABLE movimiento_stock 
      ADD COLUMN IF NOT EXISTS id_deposito INT REFERENCES deposito(id_deposito)
    `);

    // 3. Agregar columna id_deposito a producto si no existe (para stock por depósito)
    await client.query(`
      ALTER TABLE producto 
      ADD COLUMN IF NOT EXISTS stock_deposito INT DEFAULT 0
    `);

    // 4. Crear tabla de stock por depósito
    await client.query(`
      CREATE TABLE IF NOT EXISTS stock_deposito (
        id_deposito INT NOT NULL REFERENCES deposito(id_deposito) ON DELETE CASCADE,
        id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
        cantidad INT NOT NULL DEFAULT 0,
        PRIMARY KEY (id_deposito, id_producto)
      )
    `);

    // 5. Insertar los depósitos
    const depositos = [
      {
        nombre: "Depósito Central",
        descripcion: "Depósito principal del programa",
        ubicacion: "Casa Central",
        tipo: "central",
        padre_id: null
      },
      {
        nombre: "Depósito Centro Cívico",
        descripcion: "Depósito para útiles de librería y productos de limpieza",
        ubicacion: "Centro Cívico",
        tipo: "centro_civico",
        padre_id: null
      },
      {
        nombre: "Cápsula",
        descripcion: "Subdepósito para computadoras y carteles (solo acceso autorizado)",
        ubicacion: "Dentro del Depósito Central",
        tipo: "capsula",
        padre_id: null
      }
    ];

    for (const d of depositos) {
      // Buscar padre para capsula
      let padreId = null;
      if (d.tipo === "capsula") {
        const padre = await client.query(
          "SELECT id_deposito FROM deposito WHERE tipo = 'central' LIMIT 1"
        );
        padreId = padre.rows[0]?.id_deposito;
      }

      const existente = await client.query(
        "SELECT id_deposito FROM deposito WHERE tipo = $1 LIMIT 1",
        [d.tipo]
      );

      if (existente.rows[0]) {
        await client.query(
          `UPDATE deposito
           SET nombre = $1,
               descripcion = $2,
               ubicacion = $3,
               deposito_padre_id = $4,
               activo = TRUE
           WHERE id_deposito = $5`,
          [d.nombre, d.descripcion, d.ubicacion, padreId, existente.rows[0].id_deposito]
        );
      } else {
        await client.query(
          `INSERT INTO deposito (nombre, descripcion, ubicacion, tipo, deposito_padre_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [d.nombre, d.descripcion, d.ubicacion, d.tipo, padreId]
        );
      }
    }

    // 6. Actualizar capsula con padre_id correcto
    await client.query(`
      UPDATE deposito 
      SET deposito_padre_id = (SELECT id_deposito FROM deposito WHERE tipo = 'central')
      WHERE tipo = 'capsula'
    `);

    // 7. Agregar campo requiere_autorizacion a producto
    await client.query(`
      ALTER TABLE producto 
      ADD COLUMN IF NOT EXISTS requiere_autorizacion BOOLEAN DEFAULT FALSE
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS licitacion_publicada (
        id SERIAL PRIMARY KEY,
        anio INT NOT NULL UNIQUE,
        usuario_id INT,
        items JSONB NOT NULL DEFAULT '[]'::jsonb,
        fecha_publicacion TIMESTAMP DEFAULT NOW(),
        estado VARCHAR(30) NOT NULL DEFAULT 'publicada'
      )
    `);

    await client.query(`ALTER TABLE licitacion_publicada ADD COLUMN IF NOT EXISTS usuario_id INT`);
    await client.query(`ALTER TABLE licitacion_publicada ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb`);
    await client.query(`ALTER TABLE licitacion_publicada ADD COLUMN IF NOT EXISTS fecha_publicacion TIMESTAMP DEFAULT NOW()`);
    await client.query(`ALTER TABLE licitacion_publicada ADD COLUMN IF NOT EXISTS estado VARCHAR(30) NOT NULL DEFAULT 'publicada'`);

    await client.query(`
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
      )
    `);

    await client.query("COMMIT");

    // Ver resultados
    const result = await pool.query(`
      SELECT d.id_deposito, d.nombre, d.tipo, d.ubicacion, 
             d.deposito_padre_id, p.nombre as nombre_padre
      FROM deposito d
      LEFT JOIN deposito p ON p.id_deposito = d.deposito_padre_id
      ORDER BY d.tipo, d.id_deposito
    `);

    console.log("\n=== DEPÓSITOS CREADOS ===\n");
    console.log("ID | Nombre | Tipo | Ubicación | Padre");
    console.log("--|--------|------|----------|------");
    result.rows.forEach(d => {
      console.log(`${d.id_deposito} | ${d.nombre} | ${d.tipo} | ${d.ubicacion} | ${d.nombre_padre || '-'}`);
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
