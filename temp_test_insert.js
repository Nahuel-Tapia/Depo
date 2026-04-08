const { get, run } = require('./backend/src/db.pg');
(async () => {
  try {
    const prod = { producto_id: 1, cantidad: 1, estado: 'nuevo' };
    const producto = await get('SELECT * FROM producto WHERE id_producto = ?', [prod.producto_id]);
    console.log('producto', !!producto);
    const result = await run(
      'INSERT INTO movimiento_stock (id_producto, tipo, cantidad, estado_producto, cargo_retira, id_institucion, id_usuario, motivo, fecha_movimiento) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [prod.producto_id, 'ingreso', prod.cantidad, prod.estado, null, null, 1, 'test']
    );
    console.log('insert:', result);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();