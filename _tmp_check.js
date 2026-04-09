const { Pool } = require('pg');
const p = new Pool(require('./backend/src/config/database'));

async function migrate() {
  const client = await p.connect();
  try {
    await client.query('BEGIN');

    // 1. proveedor: agregar columnas faltantes
    console.log('--- proveedor ---');
    const provCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='proveedor'`);
    const provExisting = provCols.rows.map(r => r.column_name);

    for (const [col, type] of [['telefono', 'VARCHAR(50)'], ['email', 'VARCHAR(100)'], ['categoria', 'VARCHAR(50)'], ['activo', 'BOOLEAN DEFAULT TRUE']]) {
      if (!provExisting.includes(col)) {
        await client.query(`ALTER TABLE proveedor ADD COLUMN ${col} ${type}`);
        console.log('  + ' + col);
      } else {
        console.log('  = ' + col + ' ya existe');
      }
    }

    // 2. institucion: agregar limite_productos si no existe
    console.log('--- institucion ---');
    const instCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='institucion'`);
    const instExisting = instCols.rows.map(r => r.column_name);

    if (!instExisting.includes('limite_productos')) {
      await client.query(`ALTER TABLE institucion ADD COLUMN limite_productos INT DEFAULT 0`);
      console.log('  + limite_productos');
    } else {
      console.log('  = limite_productos ya existe');
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
