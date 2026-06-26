const { all } = require("../backend/src/db.pg");

async function main() {
  try {
    const rows = await all(`
      SELECT 
        m.id_movimiento as id,
        m.tipo,
        m.id_producto,
        m.id_proveedor,
        m.motivo,
        COALESCE(pr.nombre, pr_lic.proveedor_nombre) as proveedor_nombre
      FROM movimiento_stock m
      LEFT JOIN proveedor pr ON m.id_proveedor = pr.id_proveedor
      LEFT JOIN LATERAL (
        SELECT cph.id_proveedor, prov.nombre AS proveedor_nombre
        FROM compra_precio_historico cph
        JOIN proveedor prov ON prov.id_proveedor = cph.id_proveedor
        WHERE cph.id_producto = m.id_producto
          AND cph.anio = (
            CASE
              WHEN substring(m.motivo from 'REMITO-([0-9]{4})-') IS NOT NULL
                THEN CAST(substring(m.motivo from 'REMITO-([0-9]{4})-') AS INT)
              WHEN substring(m.motivo from 'Licitación #([0-9]+)') IS NOT NULL
                THEN (
                  SELECT lp.anio
                  FROM licitacion_publicada lp
                  WHERE lp.id = CAST(substring(m.motivo from 'Licitación #([0-9]+)') AS INT)
                  LIMIT 1
                )
              ELSE NULL
            END
          )
        ORDER BY cph.updated_at DESC NULLS LAST, cph.id_proveedor
        LIMIT 1
      ) pr_lic ON m.id_proveedor IS NULL
      WHERE m.tipo = 'ingreso' AND m.id_proveedor IS NULL
      ORDER BY m.id_movimiento DESC
    `);
    console.log("INGRESS MOVEMENTS WITH NULL id_proveedor:");
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
