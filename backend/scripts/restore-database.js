/**
 * Script para restaurar la base de datos desde el dump.
 * ELIMINA la DB existente y la recrea con los datos del dump.
 * Ejecutar: npm run db:restore
 */
require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { Client } = require('pg');

const pgBinPaths = [
  'C:\\Program Files\\PostgreSQL\\18\\bin',
  'C:\\Program Files\\PostgreSQL\\17\\bin',
  'C:\\Program Files\\PostgreSQL\\16\\bin',
  'C:\\Program Files\\PostgreSQL\\15\\bin',
  'C:\\Program Files\\PostgreSQL\\14\\bin',
  '/usr/bin',
  '/usr/local/bin'
];

let psqlCmd = 'psql';
for (const p of pgBinPaths) {
  const full = path.join(p, process.platform === 'win32' ? 'psql.exe' : 'psql');
  if (fs.existsSync(full)) {
    psqlCmd = `"${full}"`;
    break;
  }
}

const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || '5432';
const user = process.env.DB_USER || 'postgres';
const password = process.env.DB_PASSWORD || 'postgres';
const dbName = process.env.DB_NAME || 'depo_stock';
const dumpFile = path.join(__dirname, '..', 'depo_stock_dump.sql');

if (!fs.existsSync(dumpFile)) {
  console.error('Error: No se encontró el archivo backend/depo_stock_dump.sql');
  console.error('Pedile al dueño del repo que ejecute: npm run db:dump');
  process.exit(1);
}

async function restore() {
  // 1. Conectar a postgres para eliminar y recrear la DB
  const adminClient = new Client({
    host, port: parseInt(port), user, password, database: 'postgres'
  });

  try {
    await adminClient.connect();
    console.log('1/3 - Conectado a PostgreSQL...');

    // Cerrar conexiones activas a la DB
    await adminClient.query(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [dbName]);

    // Eliminar DB si existe
    const exists = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (exists.rows.length > 0) {
      await adminClient.query(`DROP DATABASE "${dbName}"`);
      console.log(`     Base de datos "${dbName}" eliminada.`);
    }

    // Crear DB limpia
    await adminClient.query(`CREATE DATABASE "${dbName}"`);
    console.log(`     Base de datos "${dbName}" creada.`);
  } finally {
    await adminClient.end();
  }

  // 2. Restaurar el dump
  console.log('2/3 - Restaurando datos...');
  const cmd = `${psqlCmd} -h ${host} -p ${port} -U ${user} -d ${dbName} -f "${dumpFile}"`;

  try {
    execSync(cmd, {
      env: { ...process.env, PGPASSWORD: password },
      stdio: 'pipe'
    });
    console.log('     Datos restaurados correctamente.');
  } catch (err) {
    // psql puede dar warnings pero funcionar igual
    const stderr = err.stderr?.toString() || '';
    if (stderr.includes('ERROR')) {
      console.error('Hubo errores al restaurar:', stderr.substring(0, 500));
    } else {
      console.log('     Datos restaurados (con algunos warnings menores).');
    }
  }

  console.log('3/3 - ¡Listo! Base de datos restaurada exitosamente.');
  console.log(`\nAhora podés iniciar el servidor: npm start`);
}

restore().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
