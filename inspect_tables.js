const { all } = require('./backend/src/db.pg');

async function inspect() {
  try {
    const tables = ['producto', 'categoria', 'deposito', 'stock_deposito'];
    for (const table of tables) {
      const cols = await all(`SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [table]);
      console.log(`Table: ${table}`);
      console.log(cols.map(c => c.column_name).join(', '));
      console.log('---');
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

inspect();
