require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { Client } = require("pg");

async function run() {
  const dbClient = new Client({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_NAME || "depo_stock",
  });

  try {
    await dbClient.connect();
    console.log("Conectado a la base de datos local.");

    console.log("Eliminando todos los pedidos activos e históricos...");
    await dbClient.query(`TRUNCATE TABLE pedido CASCADE;`);
    
    console.log("Reasignando dependencias (zonas, kits) al usuario admin...");
    const adminRes = await dbClient.query("SELECT id_usuario FROM usuario WHERE role IN ('admin', 'master') LIMIT 1");
    if (adminRes.rowCount > 0) {
      const adminId = adminRes.rows[0].id_usuario;
      await dbClient.query(`UPDATE zona SET director_area_id = $1;`, [adminId]);
      await dbClient.query(`UPDATE producto_kit SET created_by = $1;`, [adminId]);
    }
    await dbClient.query(`DELETE FROM supervisor_escuela_asignacion;`);
    await dbClient.query(`UPDATE usuario SET director_area_id = NULL;`);
    
    console.log("Eliminando usuarios (excepto roles admin o master)...");
    const result = await dbClient.query(`DELETE FROM usuario WHERE role NOT IN ('admin', 'master');`);
    console.log(`Se eliminaron ${result.rowCount} usuarios.`);
    
    console.log("✅ Limpieza completada exitosamente.");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await dbClient.end();
  }
}

run();
