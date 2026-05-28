const db = require('./src/db.pg.js');
db.pool.query("SELECT constraint_name, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'solicitud_retiro'::regclass")
  .then(res => console.log(JSON.stringify(res.rows, null, 2)))
  .catch(console.error)
  .finally(() => db.closeDb());
