const { all } = require('./backend/src/db.pg');

async function simulate() {
  const req = {
    user: { role: 'operador_escolar' }
  };
  
  try {
    const isEscolar = req.user.role === "operador_escolar";
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
    console.log('Result:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit();
}

simulate();
