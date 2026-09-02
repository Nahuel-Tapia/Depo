require('dotenv').config();
const { all } = require('../backend/src/db.pg');

async function testQuery() {
  try {
    const res = await all("SELECT k.id, k.nombre, k.tipo_escuela, k.descripcion, k.activo, k.created_at, k.updated_at, k.cantidad_alumnos, d.id_producto AS producto_id, p.nombre as producto_nombre, p.unidad_medida, d.cantidad FROM producto_kit k LEFT JOIN producto_kit_detalle d ON d.kit_id = k.id LEFT JOIN producto p ON p.id_producto = d.id_producto WHERE 1 = 1 ORDER BY k.nombre ASC, p.nombre ASC");
    console.log('Query success! Rows:', res.length);
  } catch (err) {
    console.error('❌ QUERY ERROR:', err);
  }
}

testQuery();
