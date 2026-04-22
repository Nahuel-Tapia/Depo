const { pool } = require('./backend/src/db.pg');
async function updateConstraint() {
  try {
    const sql = `ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_role_check; ALTER TABLE usuario ADD CONSTRAINT usuario_role_check CHECK (role IN ('admin','supervisor','director_area','directivo','operador','consulta','control_ministerio','area_compras'));`;
    await pool.query(sql);
    console.log('Constraint updated successfully');
  } catch (err) {
    console.error('Error updating constraint:', err);
  } finally {
    process.exit();
  }
}
updateConstraint();
