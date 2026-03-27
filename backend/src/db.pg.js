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
  // Para INSERT, añadir RETURNING con el campo de id correcto
  let finalSql = adaptedSql;
  if (/^\s*INSERT/i.test(adaptedSql) && !/RETURNING/i.test(adaptedSql)) {
    // Detectar la tabla para usar el campo id correcto
    const tableMatch = adaptedSql.match(/INSERT\s+INTO\s+(\w+)/i);
    const table = tableMatch ? tableMatch[1].toLowerCase() : '';
    let idField = 'id';
    if (table === 'usuario') idField = 'id_usuario';
    else if (table === 'producto') idField = 'id_producto';
    else if (table === 'institucion') idField = 'id_institucion';
    else if (table === 'pedido') idField = 'id_pedido';
    else if (table === 'rol') idField = 'id_rol';
    else if (table === 'categoria') idField = 'id_categoria';
    else if (table === 'edificio') idField = 'id_edificio';
    else if (table === 'movimiento_stock') idField = 'id_movimiento';
    finalSql = adaptedSql.replace(/;?\s*$/, ` RETURNING ${idField} as id`);
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
 * Inicializa la base de datos - usa las tablas existentes del esquema base_prueba.sql
 * Tabla principal de usuarios: usuario (id_usuario, nombre, apellido, dni, email, password, telefono, id_institucion, role, activo, created_at)
 */
async function initDb() {
  // Verificar conexión y que existan las tablas del esquema
  const check = await get("SELECT COUNT(*) as count FROM usuario");
  console.log("Database initialized");
  
  // Crear usuario admin por defecto si no existe
  const admin = await get("SELECT id_usuario FROM usuario WHERE email = $1", ["admin@depo.local"]);
  if (!admin) {
    const hash = bcrypt.hashSync("Admin123!", 10);
    await pool.query(
      `INSERT INTO usuario (nombre, apellido, dni, email, password, role, activo, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
       ON CONFLICT (email) DO NOTHING`,
      ["Administrador", "Inicial", "00000000", "admin@depo.local", hash, "admin"]
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
