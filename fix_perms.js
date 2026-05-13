const { all, run, pool } = require('./backend/src/db.pg');
async function fix() {
  try {
    // 1. Asegurar que el permiso existe
    await pool.query("INSERT INTO permiso (codigo, descripcion) VALUES ($1, $2) ON CONFLICT (codigo) DO NOTHING", ['stock.view', 'stock.view']);
    
    // 2. Obtener IDs
    const role = await all("SELECT id_rol FROM rol WHERE nombre = 'operador_escolar'");
    const perm = await all("SELECT id_permiso FROM permiso WHERE codigo = 'stock.view'");
    
    if (role.length > 0 && perm.length > 0) {
      await pool.query("INSERT INTO rol_permiso (id_rol, id_permiso) VALUES ($1, $2) ON CONFLICT DO NOTHING", [role[0].id_rol, perm[0].id_permiso]);
      console.log('Permiso stock.view agregado a operador_escolar');
    } else {
      console.log('No se encontró el rol o el permiso');
    }
  } catch (e) {
    console.error(e);
  }
  process.exit();
}
fix();
