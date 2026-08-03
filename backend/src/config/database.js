/**
 * Configuración de conexión a PostgreSQL.
 * Prioriza variables DB_* y también soporta aliases estándar PG*.
 */
const host = process.env.DB_HOST || process.env.PGHOST || "localhost";
const port = parseInt(process.env.DB_PORT || process.env.PGPORT, 10) || 5432;
const database = process.env.DB_NAME || process.env.PGDATABASE || "depo_stock";
const user = process.env.DB_USER || process.env.PGUSER || "postgres";
const password =
  process.env.DB_PASSWORD ||
  process.env.PGPASSWORD ||
  process.env.POSTGRES_PASSWORD ||
  "postgres";

const baseConfig = {
  // Pool config
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

let dbConfig = {};

if (process.env.DATABASE_URL) {
  const isCloudOrProd =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL ||
    process.env.DATABASE_URL.includes("supabase") ||
    process.env.DATABASE_URL.includes("pooler");
  dbConfig = {
    ...baseConfig,
    connectionString: process.env.DATABASE_URL,
    ssl: isCloudOrProd ? { rejectUnauthorized: false } : false
  };
} else {
  dbConfig = {
    ...baseConfig,
    host,
    port,
    database,
    user,
    password,
  };
}

module.exports = dbConfig;

module.exports.getDbConfigForLogs = () => ({
  host,
  port,
  database,
  user,
  hasPassword: Boolean(password),
});
