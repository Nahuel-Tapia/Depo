const { pool } = require('./backend/src/db.pg');
async function checkConstraint() {
  try {
    const res = await pool.query("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'usuario_role_check';");
    console.log('Constraint definition:', res.rows[0]?.pg_get_constraintdef);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
checkConstraint();
