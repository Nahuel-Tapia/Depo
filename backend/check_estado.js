const db = require('./src/db.pg.js');
db.pool.query("UPDATE solicitud_retiro SET estado = 'en_sede' WHERE id = 0")
  .then(() => console.log('OK'))
  .catch(console.error)
  .finally(() => db.closeDb());
