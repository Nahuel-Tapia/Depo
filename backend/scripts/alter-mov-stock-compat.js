require('dotenv').config();
const { Client } = require('pg');
const dbConfig = require('../src/config/database');

async function main() {
  const client = new Client(dbConfig);
  await client.connect();

  const queries = [
    "ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS estado_producto VARCHAR(50)",
    "ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS cargo_retira VARCHAR(50)",
    "ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS id_institucion INT REFERENCES institucion(id_institucion)",
    "ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS id_usuario INT REFERENCES usuario(id_usuario)",
    "ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS motivo TEXT",
    "ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS id_proveedor INT REFERENCES proveedor(id_proveedor)"
  ];

  for (const q of queries) {
    await client.query(q);
  }

  await client.end();
  console.log('movimiento_stock actualizado');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
