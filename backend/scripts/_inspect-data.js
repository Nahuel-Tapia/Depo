require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const cfg = require('../src/config/database');
const { Pool } = require('pg');
const p = new Pool(cfg);

async function run() {
  // Check planilla_pedido_anual anio column type and existing data
  const existing = await p.query('SELECT * FROM planilla_pedido_anual LIMIT 3');
  console.log('planilla rows:', JSON.stringify(existing.rows));

  // Check existing detalle
  const det = await p.query('SELECT * FROM planilla_pedido_anual_detalle LIMIT 3');
  console.log('detalle rows:', JSON.stringify(det.rows));

  // Pedido estado enum values
  const enumVals = await p.query("SELECT unnest(enum_range(NULL::estado_tramite)) AS v");
  console.log('estado_tramite values:', enumVals.rows.map(r=>r.v).join(', '));

  await p.end();
}
run().catch(e => { console.error(e.message); p.end(); });
