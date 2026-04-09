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
    // NO usar transacción global - ejecutar sin BEGIN/COMMIT

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

    // Compatibilidad de esquema: algunas bases usan "nivel" en lugar de "nivel_educativo".
    const institucionColsRes = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'institucion'`
    );
    const institucionCols = new Set(
      institucionColsRes.rows.map((r) => r.column_name)
    );
    const nivelColumn = institucionCols.has("nivel_educativo")
      ? "nivel_educativo"
      : institucionCols.has("nivel")
      ? "nivel"
      : null;

    if (!nivelColumn) {
      throw new Error(
        "La tabla institucion no tiene columna de nivel (se esperaba 'nivel_educativo' o 'nivel')"
      );
    }

    // 2. Crear un mapa de id_direccion → datos de dirección para fusionarlos con edificios
    console.log("\nProcesando datos...");
    const direccionesMap = {};
    for (const d of direcciones) {
      direccionesMap[parseInt(d.id_direccion)] = {
        calle: d.calle || null,
        numero_puerta: d.numero_puerta || null,
        localidad: d.localidad || null,
        departamento: d.departamento || null,
        codigo_postal: d.codigo_postal ? parseInt(d.codigo_postal) : null,
        latitud: d.latitud ? parseFloat(d.latitud) : null,
        longitud: d.longitud ? parseFloat(d.longitud) : null,
        te_voip: d.te_voip || null,
        letra_zona: d.letra_zona || null,
      };
    }

    // 3. Insertar edificios con sus datos de dirección combinados
    console.log("\nImportando edificios...");
    let edificiosInsertados = 0;
    for (const e of edificios) {
      try {
        const dirData = direccionesMap[parseInt(e.id_direccion)] || {};
        await client.query(
          `INSERT INTO edificio (id_edificio, cui, calle, numero_puerta, direccion, localidad, departamento, codigo_postal, latitud, longitud, te_voip, letra_zona)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (id_edificio) DO NOTHING`,
          [
            parseInt(e.id_edificio),
            e.cui || null,
            dirData.calle,
            dirData.numero_puerta,
            e.direccion || null, // campo dirección general
            dirData.localidad,
            dirData.departamento,
            dirData.codigo_postal,
            dirData.latitud,
            dirData.longitud,
            dirData.te_voip,
            dirData.letra_zona,
          ]
        );
        edificiosInsertados++;
      } catch (err) {
        console.error(`Error insertando edificio ${e.id_edificio}:`, err.message);
      }
    }
    await client.query(
      `SELECT setval('edificio_id_edificio_seq', (SELECT MAX(id_edificio) FROM edificio))`
    );
    console.log(`Edificios insertados: ${edificiosInsertados}`);

    // 4. Insertar instituciones
    console.log("\nImportando instituciones...");
    let institucionesInsertadas = 0;
    let duplicadosIgnorados = 0;
    let erroresInserccion = 0;
    for (const inst of instituciones) {
      try {
        const nivelValue = inst.nivel_educativo || inst.nivel || null;
        const establecimientoCabecera =
          inst.establecimiento_cabecera ||
          inst.establecimiento_de_cabecera ||
          null;

        const res = await client.query(
          `INSERT INTO institucion (nombre, cue, id_edificio, establecimiento_cabecera, ${nivelColumn}, categoria, ambito)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT DO NOTHING
             RETURNING id_institucion`,
          [
            inst.nombre,
            inst.cue,
            inst.id_edificio ? parseInt(inst.id_edificio) : null,
            establecimientoCabecera,
            nivelValue,
            inst.categoria || null,
            inst.ambito || null,
          ]
        );

        if (res.rowCount > 0) {
          institucionesInsertadas++;
        } else {
          duplicadosIgnorados++;
        }
      } catch (e) {
        erroresInserccion++;
        if (erroresInserccion <= 5) {
          console.error(
            `  Error insertando: ${inst.nombre} (CUE: ${inst.cue})`,
            e.message.substring(0, 100)
          );
        }
      }
    }
    console.log(`Instituciones insertadas: ${institucionesInsertadas}`);
    console.log(`Duplicados ignorados: ${duplicadosIgnorados}`);
    if (erroresInserccion > 5) {
      console.log(`Errores omitidos en la salida: ${erroresInserccion - 5}`);
    }

    console.log("\n¡Importación completada exitosamente!");
  } catch (err) {
    console.error("Error en la importación:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

importData();
