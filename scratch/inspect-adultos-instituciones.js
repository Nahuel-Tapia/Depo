require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Pool } = require('pg');
const dbConfig = require('../backend/src/config/database');

const pool = new Pool(dbConfig);

async function main() {
  // 1. Get all institutions with level = Adultos
  const instsRes = await pool.query("SELECT id_institucion, nombre, cue, kit_id, nivel_educativo FROM institucion WHERE LOWER(nivel_educativo) = 'adultos'");
  console.log(`Found ${instsRes.rows.length} institutions in Adultos:`);
  instsRes.rows.forEach(r => {
    console.log(`- ID: ${r.id_institucion} | CUE: ${r.cue} | Name: ${r.nombre} | Kit: ${r.kit_id}`);
  });

  const instIds = instsRes.rows.map(r => r.id_institucion);

  if (instIds.length > 0) {
    // 2. Get all requests (pedidos) for these institutions
    const pRes = await pool.query("SELECT id_pedido, id_institucion, estado, tipo, fecha_creacion, aprobado_director_area FROM pedido WHERE id_institucion = ANY($1)", [instIds]);
    console.log(`\nFound ${pRes.rows.length} pedidos for Adultos institutions:`);
    pRes.rows.forEach(r => {
      console.log(`- Pedido ID: ${r.id_pedido} | Inst ID: ${r.id_institucion} | Estado: ${r.estado} | Tipo: ${r.tipo} | Aprob. Dir: ${r.aprobado_director_area}`);
    });
  }

  // 3. Get all planillas in the DB
  const planillasRes = await pool.query("SELECT id, anio, estado, nivel_educativo, creado_por, enviado_por, enviada_at FROM planilla_pedido_anual");
  console.log(`\nFound ${planillasRes.rows.length} planillas in total:`);
  planillasRes.rows.forEach(r => {
    console.log(`- Planilla ID: ${r.id} | Anio: ${r.anio} | Estado: ${r.estado} | Nivel: ${r.nivel_educativo} | Enviada At: ${r.enviada_at}`);
  });

  pool.end();
}

main().catch(console.error);
