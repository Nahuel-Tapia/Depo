const { all } = require('./backend/src/db.pg');
async function test() {
  try {
    const provs = await all(`
      SELECT 
        id_proveedor as id, nombre, cuit, contacto, telefono, email, categoria, activo,
        razon_social, direccion, rubro, email_secundario, sitio_web, observaciones
      FROM proveedor
      ORDER BY nombre ASC
    `);
    console.log('Success:', provs.length, 'providers found');
  } catch (e) {
    console.error('Error in query:', e.message);
  }
  process.exit();
}
test();
