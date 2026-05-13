const { all } = require('./backend/src/db.pg');
async function check() {
  try {
    const res = await all(`
      SELECT r.nombre as role, p.codigo as permission
      FROM rol r
      JOIN rol_permiso rp ON rp.id_rol = r.id_rol
      JOIN permiso p ON p.id_permiso = rp.id_permiso
      WHERE r.nombre = 'operador_escolar'
    `);
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit();
}
check();
