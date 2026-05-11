process.chdir(__dirname + '/../backend');
require('dotenv').config();
const { pool, get, all } = require('../backend/src/db.pg');

(async () => {
  try {
    const rol = await get('SELECT id_rol FROM rol WHERE LOWER(nombre) = $1', ['operador']);
    console.log('operador role:', rol);

    const perm = await get('SELECT id_permiso FROM permiso WHERE codigo = $1', ['pedidos.view']);
    console.log('pedidos.view permission:', perm);

    if (rol && perm) {
      await pool.query('INSERT INTO rol_permiso (id_rol, id_permiso) VALUES ($1, $2) ON CONFLICT DO NOTHING', [rol.id_rol, perm.id_permiso]);
      console.log('Permission assigned');
    }

    const check = await all(
      'SELECT p.codigo FROM rol r JOIN rol_permiso rp ON rp.id_rol = r.id_rol JOIN permiso p ON p.id_permiso = rp.id_permiso WHERE LOWER(r.nombre) = $1 AND p.codigo LIKE $2',
      ['operador', 'pedidos%']
    );
    console.log('operador pedidos permissions:', check.map(r => r.codigo));
  } catch (e) {
    console.error(e.message);
  } finally {
    await pool.end();
  }
})();
