const { Pool } = require('pg');
const p = new Pool(require('./backend/src/config/database'));

async function migrate() {
  const client = await p.connect();
  try {
    await client.query('BEGIN');

    // 1. movimiento_stock: agregar id_proveedor
    console.log('--- movimiento_stock ---');
    const movCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='movimiento_stock'`);
    const movExisting = movCols.rows.map(r => r.column_name);

    if (!movExisting.includes('id_proveedor')) {
      await client.query(`ALTER TABLE movimiento_stock ADD COLUMN id_proveedor INT`);
      await client.query(`ALTER TABLE movimiento_stock ADD CONSTRAINT fk_movimiento_proveedor FOREIGN KEY (id_proveedor) REFERENCES proveedor(id_proveedor)`);
      console.log('  + id_proveedor (con FK)');
    } else {
      console.log('  = id_proveedor ya existe');
    }

    // 2. edificio: agregar columnas de dirección que faltan
    // En la BD real, edificio tiene (id_edificio, cui, id_direccion) y los datos de dirección están en tabla 'direccion'
    // Pero el código de Santi espera e.direccion, e.localidad, e.departamento directamente en edificio
    // Agregar esas columnas a edificio para compatibilidad
    console.log('--- edificio ---');
    const edCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='edificio'`);
    const edExisting = edCols.rows.map(r => r.column_name);

    for (const [col, type] of [
      ['calle', 'VARCHAR(150)'],
      ['numero_puerta', 'VARCHAR(20)'],
      ['direccion', 'VARCHAR(200)'],
      ['localidad', 'VARCHAR(100)'],
      ['departamento', 'VARCHAR(100)'],
      ['codigo_postal', 'INTEGER'],
      ['latitud', 'NUMERIC'],
      ['longitud', 'NUMERIC'],
      ['te_voip', 'VARCHAR(30)'],
      ['letra_zona', 'VARCHAR(5)']
    ]) {
      if (!edExisting.includes(col)) {
        await client.query(`ALTER TABLE edificio ADD COLUMN ${col} ${type}`);
        console.log('  + ' + col);
      } else {
        console.log('  = ' + col + ' ya existe');
      }
    }

    // Migrar datos de tabla direccion a edificio
    const hasDireccion = edExisting.includes('id_direccion');
    if (hasDireccion) {
      const count = await client.query(`SELECT COUNT(*) as c FROM edificio WHERE id_direccion IS NOT NULL AND direccion IS NULL`);
      if (parseInt(count.rows[0].c) > 0) {
        await client.query(`
          UPDATE edificio e SET
            calle = d.calle,
            numero_puerta = d.numero_puerta,
            direccion = CONCAT(d.calle, ' ', d.numero_puerta),
            localidad = d.localidad,
            departamento = d.departamento,
            codigo_postal = d.codigo_postal,
            latitud = d.latitud,
            longitud = d.longitud,
            te_voip = d.te_voip,
            letra_zona = d.letra_zona
          FROM direccion d
          WHERE e.id_direccion = d.id_direccion
        `);
        console.log('  * datos migrados de tabla direccion');
      } else {
        console.log('  = datos ya migrados o vacíos');
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Migración completada');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    p.end();
  }
}
migrate();
