/**
 * Script para importar datos desde los CSV a la base de datos.
 * Importa: direcciones + edificios → edificio, instituciones → institucion
 * 
 * Los id_edificio se mantienen del CSV para preservar las FK.
 * Los id_institucion se auto-generan (SERIAL) para evitar duplicados.
 * 
 * Uso: npm run db:import
 */

require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const dbConfig = require("../src/config/database");

const pool = new Pool(dbConfig);

function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (const ch of lines[i]) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    values.push(current.trim());
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    rows.push(row);
  }
  return rows;
}

async function importData() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Leer CSVs
    const direcciones = parseCsv(
      path.join(__dirname, "../../direcciones_export.csv")
    );
    const edificios = parseCsv(
      path.join(__dirname, "../../edificios_export.csv")
    );
    const instituciones = parseCsv(
      path.join(__dirname, "../../instituciones_export.csv")
    );

    console.log(`Direcciones: ${direcciones.length}`);
    console.log(`Edificios: ${edificios.length}`);
    console.log(`Instituciones: ${instituciones.length}`);

    // 2. Insertar direcciones (manteniendo id_direccion original)
    console.log("\nImportando direcciones...");
    let direccionesInsertadas = 0;
    for (const d of direcciones) {
      await client.query(
        `INSERT INTO direccion (id_direccion, calle, numero_puerta, localidad, departamento, codigo_postal, latitud, longitud, te_voip, letra_zona)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id_direccion) DO NOTHING`,
        [
          parseInt(d.id_direccion),
          d.calle || null,
          d.numero_puerta || null,
          d.localidad || null,
          d.departamento || null,
          d.codigo_postal ? parseInt(d.codigo_postal) : null,
          d.latitud ? parseFloat(d.latitud) : null,
          d.longitud ? parseFloat(d.longitud) : null,
          d.te_voip || null,
          d.letra_zona || null,
        ]
      );
      direccionesInsertadas++;
    }
    await client.query(
      `SELECT setval('direccion_id_direccion_seq', (SELECT MAX(id_direccion) FROM direccion))`
    );
    console.log(`Direcciones insertadas: ${direccionesInsertadas}`);

    // 3. Insertar edificios (manteniendo id_edificio original para FK con instituciones)
    console.log("\nImportando edificios...");
    let edificiosInsertados = 0;
    for (const e of edificios) {
      await client.query(
        `INSERT INTO edificio (id_edificio, cui, id_direccion)
         VALUES ($1, $2, $3)
         ON CONFLICT (id_edificio) DO NOTHING`,
        [
          parseInt(e.id_edificio),
          e.cui || null,
          e.id_direccion ? parseInt(e.id_direccion) : null,
        ]
      );
      edificiosInsertados++;
    }
    await client.query(
      `SELECT setval('edificio_id_edificio_seq', (SELECT MAX(id_edificio) FROM edificio))`
    );
    console.log(`Edificios insertados: ${edificiosInsertados}`);

    // 4. Insertar instituciones (id auto-generado, ignorando id_institucion del CSV)
    console.log("\nImportando instituciones...");
    let institucionesInsertadas = 0;
    let duplicadosIgnorados = 0;
    for (const inst of instituciones) {
      const res = await client.query(
        `INSERT INTO institucion (nombre, cue, id_edificio, establecimiento_cabecera, nivel_educativo, categoria, ambito)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (cue, nivel_educativo) DO NOTHING
           RETURNING id_institucion`,
        [
          inst.nombre,
          inst.cue,
          inst.id_edificio ? parseInt(inst.id_edificio) : null,
          inst.establecimiento_cabecera || null,
          inst.nivel_educativo || null,
          inst.categoria || null,
          inst.ambito || null,
        ]
      );
      if (res.rowCount > 0) {
        institucionesInsertadas++;
      } else {
        duplicadosIgnorados++;
        console.log(
          `  Duplicado ignorado: ${inst.nombre} (CUE: ${inst.cue}, Nivel: ${inst.nivel_educativo})`
        );
      }
    }
    console.log(`Instituciones insertadas: ${institucionesInsertadas}`);
    console.log(`Duplicados ignorados: ${duplicadosIgnorados}`);

    await client.query("COMMIT");
    console.log("\n¡Importación completada exitosamente!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error en la importación:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

importData();
