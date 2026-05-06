const { all } = require("../backend/src/db.pg");

async function testQuery() {
  const anio = 2026;
  const query = `
    SELECT 
      u.id_usuario,
      u.nombre,
      u.apellido,
      u.nivel_educativo,
      EXISTS (
        SELECT 1 
        FROM pedido p
        JOIN supervisor_escuela_asignacion sea ON sea.institucion_id = p.id_institucion
        WHERE sea.director_area_id = u.id_usuario
          AND COALESCE(p.tipo, 'anual') = 'anual'
          AND p.estado = 'aprobado'
          AND p.aprobado_director_area IS TRUE
          AND EXTRACT(YEAR FROM p.fecha_creacion) = ?
      ) AS enviado
    FROM usuario u
    WHERE u.role = 'director_area'
    ORDER BY u.nivel_educativo ASC
  `;
  try {
    const rows = await all(query, [anio]);
    console.log("Success:", rows.length, "directors found");
  } catch (err) {
    console.error("Error detected:", err.message);
    if (err.detail) console.error("Detail:", err.detail);
    if (err.hint) console.error("Hint:", err.hint);
  }
}

testQuery();
