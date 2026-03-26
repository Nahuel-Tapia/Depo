require("dotenv").config();

const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const dbConfig = require("./config/database");

const pool = new Pool(dbConfig);

/**
 * Convierte placeholders SQLite (?) a PostgreSQL ($1, $2, ...)
 * @param {string} sql - Query con ? placeholders
 * @returns {string} - Query con $n placeholders
 */
function convertPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

/**
 * Adapta SQL de SQLite a PostgreSQL
 * @param {string} sql - Query SQL
 * @returns {string} - Query adaptada
 */
function adaptSql(sql) {
  let adapted = convertPlaceholders(sql);
  // CURRENT_TIMESTAMP → NOW() para consistencia
  adapted = adapted.replace(/CURRENT_TIMESTAMP/gi, "NOW()");
  // INTEGER PRIMARY KEY AUTOINCREMENT → SERIAL PRIMARY KEY
  adapted = adapted.replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, "SERIAL PRIMARY KEY");
  return adapted;
}

/**
 * Ejecuta una query que modifica datos (INSERT, UPDATE, DELETE)
 * @param {string} sql - Query SQL con placeholders ? o $1, $2, etc.
 * @param {Array} params - Parámetros de la query
 * @returns {Promise<{rowCount: number, rows: Array, lastID: number, changes: number}>}
 */
async function run(sql, params = []) {
  const adaptedSql = adaptSql(sql);
  // Para INSERT, añadir RETURNING id si no existe
  let finalSql = adaptedSql;
  if (/^\s*INSERT/i.test(adaptedSql) && !/RETURNING/i.test(adaptedSql)) {
    finalSql = adaptedSql.replace(/;?\s*$/, " RETURNING id");
  }
  const result = await pool.query(finalSql, params);
  return {
    rowCount: result.rowCount,
    rows: result.rows,
    lastID: result.rows[0]?.id || null,
    changes: result.rowCount,
  };
}

/**
 * Obtiene una sola fila
 * @param {string} sql - Query SQL
 * @param {Array} params - Parámetros
 * @returns {Promise<Object|undefined>}
 */
async function get(sql, params = []) {
  const adaptedSql = adaptSql(sql);
  const result = await pool.query(adaptedSql, params);
  return result.rows[0];
}

/**
 * Obtiene todas las filas
 * @param {string} sql - Query SQL
 * @param {Array} params - Parámetros
 * @returns {Promise<Array>}
 */
async function all(sql, params = []) {
  const adaptedSql = adaptSql(sql);
  const result = await pool.query(adaptedSql, params);
  return result.rows;
}

/**
 * Inicializa la base de datos creando tablas si no existen
 */
async function initDb() {
  // Tabla de usuarios
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      cue TEXT UNIQUE,
      institucion TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'operador', 'consulta', 'directivo')),
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Tabla de productos
  await run(`
    CREATE TABLE IF NOT EXISTS productos (
      id SERIAL PRIMARY KEY,
      codigo TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'Insumos',
      descripcion TEXT,
      proveedor TEXT,
      precio NUMERIC(12,2) NOT NULL DEFAULT 0,
      stock_actual INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Tabla de movimientos
  await run(`
    CREATE TABLE IF NOT EXISTS movimientos (
      id SERIAL PRIMARY KEY,
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'salida')),
      cantidad INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL REFERENCES users(id),
      motivo TEXT,
      proveedor TEXT,
      cue TEXT,
      pedido_id INTEGER UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Tabla de ajustes
  await run(`
    CREATE TABLE IF NOT EXISTS ajustes (
      id SERIAL PRIMARY KEY,
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      cantidad_anterior INTEGER NOT NULL,
      cantidad_nueva INTEGER NOT NULL,
      motivo TEXT NOT NULL,
      usuario_id INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Tabla de auditoría
  await run(`
    CREATE TABLE IF NOT EXISTS auditoria (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES users(id),
      entidad TEXT NOT NULL,
      accion TEXT NOT NULL,
      id_registro INTEGER,
      cambios JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Tabla de pedidos
  await run(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES users(id),
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      cantidad INTEGER NOT NULL,
      institucion TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'aprobado', 'rechazado', 'entregado')),
      notas TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Crear índices para mejor performance
  await run(`CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON movimientos(producto_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_movimientos_usuario ON movimientos(usuario_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_pedidos_usuario ON pedidos(usuario_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_pedidos_producto ON pedidos(producto_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON auditoria(entidad)`);

  // Crear usuario admin por defecto si no existe
  const admin = await get("SELECT id FROM users WHERE email = $1", ["admin@depo.local"]);
  if (!admin) {
    const hash = bcrypt.hashSync("Admin123!", 10);
    await run(
      `INSERT INTO users (nombre, email, password_hash, role, activo) 
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (email) DO NOTHING`,
      ["Administrador Inicial", "admin@depo.local", hash, "admin"]
    );
  }
}

/**
 * Cierra el pool de conexiones
 */
async function closeDb() {
  await pool.end();
}

module.exports = {
  pool,
  run,
  get,
  all,
  initDb,
  closeDb,
};
