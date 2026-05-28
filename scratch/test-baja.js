const { pool } = require('../backend/src/db.pg');
const { autorizarBaja } = require('../backend/src/services/movimientoService');

async function test() {
  console.log('--- TEST BAJAS ---');
  
  // 1. Obtener datos antes del test
  const bajaId = 4;
  const bajaRes = await pool.query('SELECT * FROM baja_movimientos WHERE id = $1', [bajaId]);
  if (bajaRes.rowCount === 0) {
    console.error(`Baja #${bajaId} no encontrada.`);
    process.exit(1);
  }
  const baja = bajaRes.rows[0];
  console.log('Baja antes:', {
    id: baja.id,
    id_producto: baja.id_producto,
    cantidad: baja.cantidad,
    id_deposito_origen: baja.id_deposito,
    estado: baja.estado
  });

  const prodId = baja.id_producto;
  const depOrigenId = baja.id_deposito;

  // Consultar depósito desguace
  const depDesguaceRes = await pool.query("SELECT id_deposito FROM deposito WHERE tipo_deposito = 'desguace' LIMIT 1");
  if (depDesguaceRes.rowCount === 0) {
    console.error('No hay depósito de desguace.');
    process.exit(1);
  }
  const depDesguaceId = depDesguaceRes.rows[0].id_deposito;

  // Consultar stock antes en origen y desguace
  const stockOrigenAntesRes = await pool.query('SELECT cantidad FROM stock_deposito WHERE id_deposito = $1 AND id_producto = $2', [depOrigenId, prodId]);
  const stockDesguaceAntesRes = await pool.query('SELECT cantidad FROM stock_deposito WHERE id_deposito = $1 AND id_producto = $2', [depDesguaceId, prodId]);

  console.log('Stock antes:', {
    origen: stockOrigenAntesRes.rows[0]?.cantidad || 0,
    desguace: stockDesguaceAntesRes.rows[0]?.cantidad || 0
  });

  // 2. Ejecutar la aprobación de la baja
  console.log('\nAprobando baja...');
  const fakeUser = { sub: baja.id_usuario }; // Usamos el mismo usuario que la registró o uno válido
  const result = await autorizarBaja(bajaId, fakeUser, 'aprobar');
  console.log('Resultado de autorizarBaja:', result);

  // 3. Obtener datos después del test
  const bajaDespuesRes = await pool.query('SELECT * FROM baja_movimientos WHERE id = $1', [bajaId]);
  const stockOrigenDespuesRes = await pool.query('SELECT cantidad FROM stock_deposito WHERE id_deposito = $1 AND id_producto = $2', [depOrigenId, prodId]);
  const stockDesguaceDespuesRes = await pool.query('SELECT cantidad FROM stock_deposito WHERE id_deposito = $1 AND id_producto = $2', [depDesguaceId, prodId]);

  console.log('\nBaja después:', {
    id: bajaDespuesRes.rows[0].id,
    estado: bajaDespuesRes.rows[0].estado
  });

  console.log('Stock después:', {
    origen: stockOrigenDespuesRes.rows[0]?.cantidad || 0,
    desguace: stockDesguaceDespuesRes.rows[0]?.cantidad || 0
  });

  console.log('\n--- FIN TEST ---');
}

test()
  .catch(console.error)
  .finally(() => pool.end());
