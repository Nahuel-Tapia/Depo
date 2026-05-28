const db = require('./src/db.pg.js');
db.pool.query("SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_name = 'stock_deposito'")
  .then(res => console.log(JSON.stringify(res.rows)))
  .catch(console.error)
  .finally(() => db.closeDb());
