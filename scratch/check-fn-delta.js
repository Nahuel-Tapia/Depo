process.chdir(__dirname + '/../backend');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool, get, all } = require('../backend/src/db.pg');

(async () => {
  try {
    const fn = await get(`
      SELECT prosrc FROM pg_proc WHERE proname = 'fn_apply_stock_delta'
    `);
    console.log('fn_apply_stock_delta:');
    console.log(fn?.prosrc || 'NOT FOUND');
  } catch (e) {
    console.error(e.message);
  } finally {
    await pool.end();
  }
})();
