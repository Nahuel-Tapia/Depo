const { get } = require("../db.pg");

const columnExistsCache = new Map();
const tableExistsCache = new Map();

/**
 * Checks if a column exists in a given table within the 'public' schema with global in-memory caching.
 * @param {string} tableName 
 * @param {string} columnName 
 * @returns {Promise<boolean>}
 */
async function columnExists(tableName, columnName) {
  const cacheKey = `${tableName}.${columnName}`;
  if (columnExistsCache.has(cacheKey)) {
    return columnExistsCache.get(cacheKey);
  }

  try {
    const row = await get(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name = $2
       ) AS column_exists`,
      [tableName, columnName]
    );
    const exists = Boolean(row?.column_exists);
    columnExistsCache.set(cacheKey, exists);
    return exists;
  } catch (err) {
    return false;
  }
}

/**
 * Checks if a table exists in the PostgreSQL 'public' schema with global in-memory caching.
 * @param {string} tableName 
 * @returns {Promise<boolean>}
 */
async function tableExists(tableName) {
  if (tableExistsCache.has(tableName)) {
    return tableExistsCache.get(tableName);
  }

  try {
    const row = await get(`SELECT to_regclass($1) AS regclass`, [`public.${tableName}`]);
    const exists = Boolean(row?.regclass);
    tableExistsCache.set(tableName, exists);
    return exists;
  } catch (err) {
    return false;
  }
}

/**
 * Clears the schema cache (useful for testing or after dynamic DDL changes).
 */
function clearSchemaCache() {
  columnExistsCache.clear();
  tableExistsCache.clear();
}

/**
 * Gets the column name for institucion nivel/direccion_area using cached columnExists.
 * @returns {Promise<string|null>}
 */
async function getInstitucionNivelColumn() {
  if (await columnExists('institucion', 'direccion_area')) return 'direccion_area';
  if (await columnExists('institucion', 'nivel_educativo')) return 'nivel_educativo';
  if (await columnExists('institucion', 'nivel')) return 'nivel';
  return null;
}

module.exports = {
  columnExists,
  tableExists,
  clearSchemaCache,
  getInstitucionNivelColumn
};
