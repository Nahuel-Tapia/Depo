const { pool } = require('../backend/src/db.pg');
(async () => {
  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%entrega%'");
    console.log('Delivery tables:', res.rows.map(r => r.table_name));
    
    // Also check pedido_entrega columns if it exists
    if (res.rows.find(r => r.table_name === 'pedido_entrega')) {
      const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'pedido_entrega'");
      console.log('pedido_entrega columns:', cols.rows.map(r => r.column_name));
    }
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
})();
