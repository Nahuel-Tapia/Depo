const db = require('./src/db.pg.js');
db.pool.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name IN ('institucion', 'deposito', 'zona_institucion', 'pedido', 'pedido_entrega', 'zona') ORDER BY table_name, ordinal_position;")
  .then(res => console.log(JSON.stringify(res.rows, null, 2)))
  .catch(console.error)
  .finally(() => db.closeDb());
