const { Pool } = require("pg");

const pool = new Pool({
  host: "localhost",
  port: 5432,
  database: "depo_stock",
  user: "postgres",
  password: "postgres"
});

async function checkMasterData() {
  try {
    const u = await pool.query("SELECT id_usuario, nombre, email, id_institucion FROM usuario WHERE role = 'master'");
    console.log("Master user:", u.rows[0]);

    const masterId = u.rows[0].id_usuario;

    const p = await pool.query(
      "SELECT COUNT(*) as count FROM pedido WHERE id_usuario_solicitante = $1",
      [masterId]
    );
    console.log("Master pedidos:", p.rows[0]);

    const m = await pool.query(
      "SELECT COUNT(*) as count FROM movimiento_stock WHERE id_usuario = $1",
      [masterId]
    );
    console.log("Master movimientos:", m.rows[0]);

    await pool.end();
  } catch (err) {
    console.error("Error:", err.message);
    await pool.end();
  }
}

checkMasterData();
