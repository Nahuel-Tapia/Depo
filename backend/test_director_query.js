const { all } = require("./src/db.pg");

async function test() {
  try {
    const ids = [1481, 1090, 1469, 1071, 1904];
    const sql = `
      SELECT p.id_pedido AS id, 
             p.estado::text as estado, 
             p.tipo, 
             i.nombre as institucion,
             p.aprobado_director_area,
             p.aprobado_por_supervisor_id,
             p.aprobado_por_director_id
      FROM pedido p 
      JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido 
      JOIN institucion i ON i.id_institucion = p.id_institucion 
      WHERE p.id_institucion = ANY($1::int[]) 
      GROUP BY p.id_pedido, p.estado, p.tipo, i.nombre, p.aprobado_director_area, p.aprobado_por_supervisor_id, p.aprobado_por_director_id
    `;
    const rows = await all(sql, [ids]);
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

test();
