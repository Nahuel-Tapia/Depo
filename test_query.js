const { all } = require('./backend/src/db.pg');
async function test() {
  try {
    const isEscolar = true;
    let query = `
        SELECT 
          d.id_deposito as id,
          d.nombre,
          d.descripcion,
          d.ubicacion,
          d.tipo,
          d.activo,
          d.deposito_padre_id,
          dp.nombre as nombre_padre
        FROM deposito d
        LEFT JOIN deposito dp ON dp.id_deposito = d.deposito_padre_id
        WHERE d.activo = TRUE
      `;
    if (isEscolar) {
      query += " AND d.id_deposito IN (1, 2)";
    }
    query += " ORDER BY d.tipo, d.id_deposito";
    
    const res = await all(query);
    console.log('Success:', res.length, 'deposits found');
  } catch (e) {
    console.error('Error in query:', e.message);
  }
  process.exit();
}
test();
