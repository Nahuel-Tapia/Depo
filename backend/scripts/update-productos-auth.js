require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { Pool } = require("pg");
const dbConfig = require("../src/config/database");

const pool = new Pool(dbConfig);

async function main() {
  // 1. Marcar productos que van a Capsula (requieren autorizacion)
  await pool.query(`
    UPDATE producto 
    SET requiere_autorizacion = true 
    WHERE LOWER(nombre) LIKE '%computadora%' 
       OR LOWER(nombre) LIKE '%pc%'
       OR LOWER(nombre) LIKE '%impresora%'
       OR LOWER(nombre) LIKE '%cartel%'
       OR LOWER(nombre) LIKE '%proyector%'
       OR LOWER(nombre) LIKE '%tablet%'
       OR LOWER(nombre) LIKE '%monitor%'
  `);

  // Verificar productos con autorizacion
  const result = await pool.query(`
    SELECT id_producto, nombre, unidad_medida, requiere_autorizacion 
    FROM producto 
    ORDER BY nombre
  `);

  console.log("\n=== PRODUCTOS EN SISTEMA ===");
  console.log("ID | Nombre | Unidad | Requiere Auth");
  console.log("--|--------|-------|-------------");
  result.rows.forEach(p => {
    console.log(`${p.id_producto} | ${p.nombre} | ${p.unidad_medida} | ${p.requiere_autorizacion ? 'SÍ' : 'NO'}`);
  });

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});