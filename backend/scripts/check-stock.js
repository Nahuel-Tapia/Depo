require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { Pool } = require("pg");
const db = require("../src/config/database");

const p = new Pool(db);

(async () => {
  const r = await p.query(`
    SELECT 
      p.id_producto, 
      p.nombre,
      COALESCE(sd_central.cantidad, 0) as stock_central,
      COALESCE(sd_civico.cantidad, 0) as stock_centro_civico,
      COALESCE(sd_capsula.cantidad, 0) as stock_capsula
    FROM producto p
    LEFT JOIN stock_deposito sd_central ON sd_central.id_producto = p.id_producto 
      AND sd_central.id_deposito = (SELECT id_deposito FROM deposito WHERE tipo = 'central')
    LEFT JOIN stock_deposito sd_civico ON sd_civico.id_producto = p.id_producto 
      AND sd_civico.id_deposito = (SELECT id_deposito FROM deposito WHERE tipo = 'centro_civico')
    LEFT JOIN stock_deposito sd_capsula ON sd_capsula.id_producto = p.id_producto 
      AND sd_capsula.id_deposito = (SELECT id_deposito FROM deposito WHERE tipo = 'capsula')
    ORDER BY p.nombre
  `);

  console.log("\n=== STOCK POR DEPOSITO ===\n");
  console.log("ID | Producto | Central | C.Civico | Capsula");
  console.log("--|---------|--------|--------|---------|-------");
  r.rows.forEach(x => {
    const nombre = x.nombre.substring(0, 20);
    console.log(`${x.id_producto} | ${nombre.padEnd(9)} | ${x.stock_central} | ${x.stock_centro_civico} | ${x.stock_capsula}`);
  });

  await p.end();
})();