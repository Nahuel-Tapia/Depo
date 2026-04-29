require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { Pool } = require("pg");
const dbConfig = require("../src/config/database");

const pool = new Pool(dbConfig);

const productos = [
  ["Resma de papel A4", "unidad", 500, false],
  ["Lapices de colores", "caja", 50, false],
  ["Goma de borrar", "unidad", 100, false],
  ["Cuaderno abc", "unidad", 200, false],
  ["Birome azul", "caja", 100, false],
  ["Birome negra", "caja", 100, false],
  ["Marcador permanente", "caja", 50, false],
  ["Pegamento", "unidad", 80, false],
  ["Tijera", "unidad", 30, false],
  ["Regla 30cm", "unidad", 30, false],
  ["Computadora escritorio", "unidad", 0, true],
  ["Notebook", "unidad", 0, true],
  ["Tablet", "unidad", 0, true],
  ["Impresora laser", "unidad", 0, true],
  ["Monitor 19 pulgadas", "unidad", 0, true],
  ["Proyector", "unidad", 0, true],
  ["Cartel institucional", "unidad", 0, true],
  ["Cartel de senaletica", "unidad", 0, true],
  ["Detergente", "litro", 100, false],
  ["Lavandina", "litro", 100, false],
  ["Jabon liquido", "litro", 50, false],
  ["Papel higienico", "pack", 200, false],
  ["Toallas de papel", "pack", 100, false],
  ["Desodorante piso", "litro", 50, false]
];

async function main() {
  for (const [nombre, unidad, stock, auth] of productos) {
    const exists = await pool.query(
      "SELECT id_producto FROM producto WHERE nombre = $1",
      [nombre]
    );
    if (exists.rows.length === 0) {
      await pool.query(
        `INSERT INTO producto (nombre, unidad_medida, stock_actual, requiere_autorizacion) 
         VALUES ($1, $2, $3, $4)`,
        [nombre, unidad, stock, auth]
      );
    }
  }

  const r = await pool.query(`
    SELECT id_producto, nombre, unidad_medida, requiere_autorizacion 
    FROM producto 
    ORDER BY id_producto
  `);

  console.log("\n=== PRODUCTOS EN SISTEMA ===");
  console.log("ID | Nombre | Unidad | Requiere Auth");
  console.log("--|--------|-------|-------------");
  r.rows.forEach(x => {
    console.log(`${x.id_producto} | ${x.nombre} | ${x.unidad_medida} | ${x.requiere_autorizacion ? "SI" : "NO"}`);
  });

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});