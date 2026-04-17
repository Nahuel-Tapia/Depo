// Script para corregir roles y eliminar usuarios bloqueados por restricciones
require('dotenv').config();
const { Pool } = require('pg');
const dbConfig = require('../src/config/database');

const pool = new Pool(dbConfig);

async function main() {
  // Corrige roles mal escritos
  await pool.query(`UPDATE usuario SET role = 'supervisor' WHERE role = 'superivsor'`);
  await pool.query(`UPDATE usuario SET role = 'supervisor' WHERE LOWER(role) LIKE '%super%'`);
  await pool.query(`ALTER TABLE usuario ALTER COLUMN role TYPE VARCHAR(50)`);
  console.log('Roles corregidos.');

  // Elimina usuarios bloqueados por restricciones de claves foráneas
  // Borra primero registros en tablas que referencian usuario
  await pool.query(`DELETE FROM movimiento_stock WHERE id_usuario IN (SELECT id_usuario FROM usuario WHERE activo = FALSE)`);
  await pool.query(`DELETE FROM auditoria WHERE usuario_id IN (SELECT id_usuario FROM usuario WHERE activo = FALSE)`);
  await pool.query(`DELETE FROM ajustes WHERE usuario_id IN (SELECT id_usuario FROM usuario WHERE activo = FALSE)`);
  await pool.query(`DELETE FROM pedidos WHERE usuario_id IN (SELECT id_usuario FROM usuario WHERE activo = FALSE)`);
  // Ahora sí elimina usuarios inactivos
  await pool.query(`DELETE FROM usuario WHERE activo = FALSE`);
  console.log('Usuarios inactivos eliminados.');

  await pool.end();
  console.log('Listo.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
