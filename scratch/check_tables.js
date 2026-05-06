const { pool } = require('../backend/src/db.pg');
(async () => {
  try {
    const res = await pool.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
    console.log(res.rows.map(r => r.tablename));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
})();
