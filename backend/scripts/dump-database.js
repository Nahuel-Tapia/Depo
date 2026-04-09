/**
 * Script para exportar la base de datos completa a un archivo SQL.
 * Genera backend/depo_stock_dump.sql con estructura + datos.
 * Ejecutar: node backend/scripts/dump-database.js
 */
require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const pgBinPaths = [
  'C:\\Program Files\\PostgreSQL\\18\\bin',
  'C:\\Program Files\\PostgreSQL\\17\\bin',
  'C:\\Program Files\\PostgreSQL\\16\\bin',
  'C:\\Program Files\\PostgreSQL\\15\\bin',
  'C:\\Program Files\\PostgreSQL\\14\\bin'
];

let pgDump = 'pg_dump';
for (const p of pgBinPaths) {
  const full = path.join(p, 'pg_dump.exe');
  if (fs.existsSync(full)) {
    pgDump = `"${full}"`;
    break;
  }
}

const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || '5432';
const user = process.env.DB_USER || 'postgres';
const password = process.env.DB_PASSWORD || 'postgres';
const dbName = process.env.DB_NAME || 'depo_stock';
const outputFile = path.join(__dirname, '..', 'depo_stock_dump.sql');

const cmd = `${pgDump} -h ${host} -p ${port} -U ${user} -d ${dbName} --no-owner --no-privileges -f "${outputFile}"`;

console.log(`Exportando base de datos "${dbName}"...`);

try {
  execSync(cmd, {
    env: { ...process.env, PGPASSWORD: password },
    stdio: 'inherit'
  });
  const stats = fs.statSync(outputFile);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`\nDump creado exitosamente: backend/depo_stock_dump.sql (${sizeMB} MB)`);
  console.log('\nTu compañero debe ejecutar:');
  console.log('  npm run db:restore');
} catch (err) {
  console.error('Error al exportar:', err.message);
  process.exit(1);
}
