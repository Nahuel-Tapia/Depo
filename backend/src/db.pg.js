require("dotenv").config();

const { Pool } = require("pg");
const dbConfig = require("./config/database");

const pool = new Pool(dbConfig);

// Capturar errores en clientes inactivos del pool para prevenir crashes fatales en Serverless
pool.on("error", (err) => {
  console.error("[PostgreSQL Pool Error]", err.message || err);
});

/**
 * Convierte placeholders SQLite (?) a PostgreSQL ($1, $2, ...)
 * @param {string} sql - Query con ? placeholders
 * @returns {string} - Query con $n placeholders
 */
function convertPlaceholders(sql) {
  if (!sql || !sql.includes("?")) return sql;
  const matches = sql.match(/\$(\d+)/g);
  let maxIndex = 0;
  if (matches) {
    for (const m of matches) {
      const num = parseInt(m.substring(1), 10);
      if (!isNaN(num) && num > maxIndex) maxIndex = num;
    }
  }
  let index = maxIndex;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function sanitizeParams(params = []) {
  if (!Array.isArray(params)) return [];
  return params.map((p) => (p === undefined ? null : p));
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
  const cleanParams = sanitizeParams(params);
  // console.debug("[DBG] SQL (adapted):", adaptedSql, "Params:", JSON.stringify(cleanParams));
  // Para INSERT, añadir RETURNING con el campo de id correcto
  let finalSql = adaptedSql;
  if (/^\s*INSERT/i.test(adaptedSql) && !/RETURNING/i.test(adaptedSql)) {
    // Detectar la tabla para usar el campo id correcto
    const cleanSql = adaptedSql.replace(/"/g, '');
    const tableMatch = cleanSql.match(/INSERT\s+INTO\s+(?:public\.)?(\w+)/i);
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
    else if (table === 'proveedor') idField = 'id_proveedor';
    else if (table === 'detalle_pedido') idField = 'id_detalle_pedido';
    else if (table === 'baja_stock') idField = 'id_baja';
    else if (table === 'kit_escuela') idField = 'id';
    else if (table === 'kit_producto_anual') idField = 'id';
    else if (table === 'zona') idField = 'id';
    finalSql = adaptedSql.replace(/;?\s*$/, ` RETURNING ${idField} as id`);
  }
  const result = await pool.query(finalSql, cleanParams);
  const returnedId = result.rows[0]?.id || (result.rows[0] ? result.rows[0][Object.keys(result.rows[0])[0]] : null);
  return {
    rowCount: result.rowCount,
    rows: result.rows,
    lastID: returnedId,
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
  const cleanParams = sanitizeParams(params);
  const result = await pool.query(adaptedSql, cleanParams);
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
  const cleanParams = sanitizeParams(params);
  const result = await pool.query(adaptedSql, cleanParams);
  return result.rows;
}

/**
 * Inicializa la base de datos - usa las tablas existentes del esquema base_prueba.sql
 * Tabla principal de usuarios: usuario (id_usuario, nombre, apellido, dni, email, password, telefono, id_institucion, role, activo, created_at)
 */
async function initDb() {
  // Verificar conexión
  await get("SELECT 1");
  console.log("Database connection successful");
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
