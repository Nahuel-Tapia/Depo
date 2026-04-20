require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { Pool } = require("pg");
const dbConfig = require("../src/config/database");

const pool = new Pool(dbConfig);

function calcularFactorAsignacion(matriculados) {
  if (matriculados <= 100) return 1.0;
  if (matriculados <= 300) return 1.5;
  if (matriculados <= 500) return 2.0;
  if (matriculados <= 800) return 2.5;
  if (matriculados <= 1000) return 3.0;
  if (matriculados <= 1500) return 3.5;
  return 4.0;
}

const SCHOOL_SEEDS = [
  {
    nombre: "Escuela Primaria Sarmiento",
    cue: "700000101",
    nivel_educativo: "primario",
    categoria: "publica",
    ambito: "urbano",
    tipo: "publica",
    tipo_escuela: "normal",
    establecimiento_cabecera: "Casa Central",
    email: "sarmiento.primaria@test.local",
    telefono: "2644000001",
    matriculados: 320,
    notas: "Escuela de prueba para pedidos y asignaciones.",
    calle: "Av. Libertador Gral. San Martin",
    numero_puerta: "1450",
    localidad: "Capital",
    departamento: "Capital",
    codigo_postal: 5400,
    latitud: -31.5378,
    longitud: -68.5253,
    cui: "70000010101",
    letra_zona: "A"
  },
  {
    nombre: "Jardin de Infantes Burbujas",
    cue: "700000102",
    nivel_educativo: "inicial",
    categoria: "publica",
    ambito: "urbano",
    tipo: "publica",
    tipo_escuela: "normal",
    establecimiento_cabecera: "Sede Inicial",
    email: "burbujas.inicial@test.local",
    telefono: "2644000002",
    matriculados: 140,
    notas: "Jardin de prueba para altas por CUE.",
    calle: "Mendoza",
    numero_puerta: "825",
    localidad: "Rivadavia",
    departamento: "Rivadavia",
    codigo_postal: 5403,
    latitud: -31.5452,
    longitud: -68.5841,
    cui: "70000010201",
    letra_zona: "B"
  },
  {
    nombre: "Colegio Secundario Rawson",
    cue: "700000103",
    nivel_educativo: "secundario",
    categoria: "publica",
    ambito: "urbano",
    tipo: "publica",
    tipo_escuela: "jornada_extendida",
    establecimiento_cabecera: "Turno Completo",
    email: "rawson.secundario@test.local",
    telefono: "2644000003",
    matriculados: 860,
    notas: "Escuela de prueba con jornada extendida.",
    calle: "Espana",
    numero_puerta: "2330",
    localidad: "Villa Krause",
    departamento: "Rawson",
    codigo_postal: 5425,
    latitud: -31.6521,
    longitud: -68.5629,
    cui: "70000010301",
    letra_zona: "C"
  },
  {
    nombre: "Escuela Albergue Valle Feral",
    cue: "700000104",
    nivel_educativo: "primario",
    categoria: "publica",
    ambito: "rural",
    tipo: "publica",
    tipo_escuela: "albergue",
    establecimiento_cabecera: "Anexo Rural",
    email: "valleferal.albergue@test.local",
    telefono: "2644000004",
    matriculados: 95,
    notas: "Escuela rural para pruebas de tipo albergue.",
    calle: "Ruta Provincial 12",
    numero_puerta: "S/N",
    localidad: "Calingasta",
    departamento: "Calingasta",
    codigo_postal: 5401,
    latitud: -31.3249,
    longitud: -69.4122,
    cui: "70000010401",
    letra_zona: "R"
  },
  {
    nombre: "Escuela Especial Crecer",
    cue: "700000105",
    nivel_educativo: "especial",
    categoria: "publica",
    ambito: "urbano",
    tipo: "publica",
    tipo_escuela: "normal",
    establecimiento_cabecera: "Sede Especial",
    email: "crecer.especial@test.local",
    telefono: "2644000005",
    matriculados: 72,
    notas: "Escuela especial de prueba.",
    calle: "Laprida",
    numero_puerta: "640",
    localidad: "Santa Lucia",
    departamento: "Santa Lucia",
    codigo_postal: 5411,
    latitud: -31.5381,
    longitud: -68.495,
    cui: "70000010501",
    letra_zona: "D"
  },
  {
    nombre: "Escuela Integral Republica",
    cue: "700000107",
    nivel_educativo: "inicial",
    categoria: "publica",
    ambito: "urbano",
    tipo: "publica",
    tipo_escuela: "normal",
    establecimiento_cabecera: "Complejo Integrado",
    email: "republica.inicial@test.local",
    telefono: "2644000006",
    matriculados: 110,
    notas: "Escuela de prueba para altas y listados publicos.",
    calle: "Ignacio de la Roza",
    numero_puerta: "1820",
    localidad: "Capital",
    departamento: "Capital",
    codigo_postal: 5400,
    latitud: -31.5427,
    longitud: -68.5473,
    cui: "70000010701",
    letra_zona: "A"
  },
  {
    nombre: "Escuela Primaria Republica",
    cue: "700000106",
    nivel_educativo: "primario",
    categoria: "publica",
    ambito: "urbano",
    tipo: "publica",
    tipo_escuela: "normal",
    establecimiento_cabecera: "Complejo Integrado",
    email: "republica.primaria@test.local",
    telefono: "2644000007",
    matriculados: 410,
    notas: "Escuela primaria adicional para pruebas de directivos y supervisores.",
    calle: "Aberastain",
    numero_puerta: "960",
    localidad: "Pocito",
    departamento: "Pocito",
    codigo_postal: 5400,
    latitud: -31.6832,
    longitud: -68.5808,
    cui: "70000010601",
    letra_zona: "E"
  }
];

const DIRECTIVO_EMAIL = "directivo@gmail.com";
const DIRECTOR_AREA_EMAIL = "direc@gmail.com";

const SUPERVISOR_ASSIGNMENTS = [
  { email: "sup1@gmail.com", cues: ["700000101", "700000102"] },
  { email: "sup2@gmail.com", cues: ["700000103"] },
  { email: "sup3@gmail.com", cues: ["700000104"] },
  { email: "sup4@gmail.com", cues: ["700000105"] },
  { email: "sup5@gmail.com", cues: ["700000107"] }
];

async function ensureDirectorTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS supervisor_escuela_asignacion (
      id SERIAL PRIMARY KEY,
      supervisor_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
      institucion_id INT NOT NULL REFERENCES institucion(id_institucion) ON DELETE CASCADE,
      director_area_id INT REFERENCES usuario(id_usuario),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (supervisor_id, institucion_id)
    )
  `);
}

async function upsertDireccion(client, school) {
  const existingEdificio = await client.query(
    "SELECT id_edificio, id_direccion FROM edificio WHERE cui = $1",
    [school.cui]
  );

  if (existingEdificio.rows[0]?.id_direccion) {
    const direccionId = existingEdificio.rows[0].id_direccion;
    await client.query(
      `UPDATE direccion
       SET calle = $1,
           numero_puerta = $2,
           localidad = $3,
           departamento = $4,
           codigo_postal = $5,
           latitud = $6,
           longitud = $7,
           letra_zona = $8
       WHERE id_direccion = $9`,
      [
        school.calle,
        school.numero_puerta,
        school.localidad,
        school.departamento,
        school.codigo_postal,
        school.latitud,
        school.longitud,
        school.letra_zona,
        direccionId
      ]
    );
    return direccionId;
  }

  const insert = await client.query(
    `INSERT INTO direccion (
      calle, numero_puerta, localidad, departamento, codigo_postal, latitud, longitud, letra_zona
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id_direccion`,
    [
      school.calle,
      school.numero_puerta,
      school.localidad,
      school.departamento,
      school.codigo_postal,
      school.latitud,
      school.longitud,
      school.letra_zona
    ]
  );
  return insert.rows[0].id_direccion;
}

async function upsertEdificio(client, school, direccionId) {
  const existing = await client.query(
    "SELECT id_edificio FROM edificio WHERE cui = $1",
    [school.cui]
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE edificio
       SET calle = $1,
           numero_puerta = $2,
           direccion = $3,
           localidad = $4,
           departamento = $5,
           codigo_postal = $6,
           latitud = $7,
           longitud = $8,
           letra_zona = $9,
           id_direccion = $10
       WHERE id_edificio = $11`,
      [
        school.calle,
        school.numero_puerta,
        `${school.calle} ${school.numero_puerta}`.trim(),
        school.localidad,
        school.departamento,
        school.codigo_postal,
        school.latitud,
        school.longitud,
        school.letra_zona,
        direccionId,
        existing.rows[0].id_edificio
      ]
    );
    return existing.rows[0].id_edificio;
  }

  const insert = await client.query(
    `INSERT INTO edificio (
      cui, calle, numero_puerta, direccion, localidad, departamento, codigo_postal,
      latitud, longitud, letra_zona, id_direccion
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id_edificio`,
    [
      school.cui,
      school.calle,
      school.numero_puerta,
      `${school.calle} ${school.numero_puerta}`.trim(),
      school.localidad,
      school.departamento,
      school.codigo_postal,
      school.latitud,
      school.longitud,
      school.letra_zona,
      direccionId
    ]
  );
  return insert.rows[0].id_edificio;
}

async function upsertInstitucion(client, school, edificioId) {
  const factor = calcularFactorAsignacion(school.matriculados);
  const existing = await client.query(
    `SELECT id_institucion
     FROM institucion
     WHERE cue = $1 AND COALESCE(nivel_educativo, '') = COALESCE($2, '')`,
    [school.cue, school.nivel_educativo]
  );

  const params = [
    school.nombre,
    school.cue,
    edificioId,
    school.establecimiento_cabecera,
    school.nivel_educativo,
    school.categoria,
    school.ambito,
    true,
    school.nivel_educativo,
    school.tipo,
    school.email,
    school.telefono,
    school.matriculados,
    factor,
    school.notas,
    null,
    `${school.calle} ${school.numero_puerta}`.trim(),
    school.localidad,
    school.departamento,
    school.tipo_escuela
  ];

  if (existing.rows[0]) {
    await client.query(
      `UPDATE institucion
       SET nombre = $1,
           cue = $2,
           id_edificio = $3,
           establecimiento_cabecera = $4,
           nivel_educativo = $5,
           categoria = $6,
           ambito = $7,
           activo = $8,
           nivel = $9,
           tipo = $10,
           email = $11,
           telefono = $12,
           matriculados = $13,
           factor_asignacion = $14,
           notas = $15,
           limite_productos = $16,
           direccion = $17,
           localidad = $18,
           departamento = $19,
           tipo_escuela = $20,
           updated_at = NOW()
       WHERE id_institucion = $21`,
      [...params, existing.rows[0].id_institucion]
    );
    return existing.rows[0].id_institucion;
  }

  const insert = await client.query(
    `INSERT INTO institucion (
      nombre, cue, id_edificio, establecimiento_cabecera, nivel_educativo,
      categoria, ambito, activo, nivel, tipo, email, telefono, matriculados,
      factor_asignacion, notas, limite_productos, direccion, localidad,
      departamento, tipo_escuela
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10, $11, $12, $13,
      $14, $15, $16, $17, $18,
      $19, $20
    )
    RETURNING id_institucion`,
    params
  );
  return insert.rows[0].id_institucion;
}

async function vincularUsuarios(client, institutionsByKey) {
  const directivo = await client.query(
    "SELECT id_usuario FROM usuario WHERE LOWER(email) = LOWER($1)",
    [DIRECTIVO_EMAIL]
  );

  const directivoInstitucion = institutionsByKey.get("700000101|primario");
  if (directivo.rows[0] && directivoInstitucion) {
    await client.query(
      "UPDATE usuario SET id_institucion = $1 WHERE id_usuario = $2",
      [directivoInstitucion.id, directivo.rows[0].id_usuario]
    );
  }

  const director = await client.query(
    "SELECT id_usuario FROM usuario WHERE LOWER(email) = LOWER($1)",
    [DIRECTOR_AREA_EMAIL]
  );
  const directorId = director.rows[0]?.id_usuario || null;

  for (const assignment of SUPERVISOR_ASSIGNMENTS) {
    const supervisor = await client.query(
      "SELECT id_usuario FROM usuario WHERE LOWER(email) = LOWER($1)",
      [assignment.email]
    );
    const supervisorId = supervisor.rows[0]?.id_usuario;
    if (!supervisorId) continue;

    for (const cue of assignment.cues) {
      for (const inst of institutionsByKey.values()) {
        if (inst.cue !== cue) continue;
        await client.query(
          `INSERT INTO supervisor_escuela_asignacion (supervisor_id, institucion_id, director_area_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (supervisor_id, institucion_id)
           DO UPDATE SET director_area_id = EXCLUDED.director_area_id`,
          [supervisorId, inst.id, directorId]
        );
      }
    }
  }
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureDirectorTable(client);

    const institutionsByKey = new Map();

    for (const school of SCHOOL_SEEDS) {
      const direccionId = await upsertDireccion(client, school);
      const edificioId = await upsertEdificio(client, school, direccionId);
      const institucionId = await upsertInstitucion(client, school, edificioId);
      institutionsByKey.set(`${school.cue}|${school.nivel_educativo}`, {
        id: institucionId,
        cue: school.cue,
        nivel_educativo: school.nivel_educativo,
        nombre: school.nombre
      });
    }

    await vincularUsuarios(client, institutionsByKey);
    await client.query("COMMIT");

    const resumen = await pool.query(
      `SELECT id_institucion, nombre, cue, nivel_educativo, departamento, localidad, matriculados, tipo_escuela
       FROM institucion
       ORDER BY cue, nivel_educativo`
    );

    console.log("Escuelas de prueba cargadas:");
    for (const row of resumen.rows) {
      console.log(
        `- #${row.id_institucion} | ${row.nombre} | CUE ${row.cue} | ${row.nivel_educativo} | ${row.departamento}/${row.localidad} | matriculados=${row.matriculados} | tipo=${row.tipo_escuela || "normal"}`
      );
    }

    const usuarios = await pool.query(
      `SELECT u.email, u.role, u.id_institucion, i.nombre AS institucion
       FROM usuario u
       LEFT JOIN institucion i ON i.id_institucion = u.id_institucion
       WHERE LOWER(u.email) IN (LOWER($1), LOWER($2), LOWER($3), LOWER($4), LOWER($5), LOWER($6), LOWER($7))
       ORDER BY u.id_usuario`,
      [
        DIRECTIVO_EMAIL,
        DIRECTOR_AREA_EMAIL,
        "sup1@gmail.com",
        "sup2@gmail.com",
        "sup3@gmail.com",
        "sup4@gmail.com",
        "sup5@gmail.com"
      ]
    );

    console.log("Usuarios vinculados:");
    for (const row of usuarios.rows) {
      console.log(`- ${row.email} | ${row.role} | institucion_id=${row.id_institucion || "-"} | ${row.institucion || "-"}`);
    }
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Error cargando escuelas de prueba:", err);
  process.exit(1);
});
