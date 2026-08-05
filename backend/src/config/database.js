/**
 * Configuración de conexión a PostgreSQL.
 * Prioriza variables DB_* y también soporta aliases estándar PG*.
 * Optimizado para entornos serverless (Vercel) y standalone.
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

const isVercel = !!process.env.VERCEL;

const baseConfig = {
  // En serverless cada instancia crea su propio pool, usar valores conservadores
  max: isVercel ? 3 : 20,
  idleTimeoutMillis: isVercel ? 10000 : 30000,
  // Supabase/cloud puede tardar más en cold start
  connectionTimeoutMillis: isVercel ? 10000 : 2000,
};

let dbConfig = {};

if (process.env.DATABASE_URL) {
  dbConfig = {
    ...baseConfig,
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
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
