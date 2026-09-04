const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const dbConfig = require("../src/config/database");

const pool = new Pool(dbConfig);

const NIVELES = ["inicial", "primario", "secundario", "especial"];
const PASSWORD_TEST = "Test123!";

async function run() {
  const client = await pool.connect();
  console.log("===============================================================");
  console.log("🚀 INICIANDO SEED GLOBAL: 10+ POR NIVEL (DIRECTIVOS, SUPERVISORES,");
  console.log("   ZONAS, KITS Y PEDIDOS)");
  console.log("===============================================================");

  try {
    await client.query("BEGIN");

    // 1. Asegurar constraints de roles
    console.log("\n1️⃣ Verificando constraint de roles...");
    const checks = await client.query(`
      SELECT conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'usuario'
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%role%'
    `);
    for (const row of checks.rows) {
      await client.query(`ALTER TABLE usuario DROP CONSTRAINT IF EXISTS ${row.conname}`);
    }
    await client.query(`
      ALTER TABLE usuario
      ADD CONSTRAINT usuario_role_check
      CHECK (role IN ('admin', 'master', 'supervisor', 'director_area', 'directivo', 'operador', 'operador_escolar', 'consulta', 'control_ministerio', 'area_compras'))
    `);

    // Sincronizar permisos de directivo en rol_permiso
    await client.query(`
      DELETE FROM rol_permiso
      WHERE id_rol IN (SELECT id_rol FROM rol WHERE LOWER(nombre) = 'directivo')
        AND id_permiso IN (SELECT id_permiso FROM permiso WHERE LOWER(codigo) = 'auditoria.view')
    `);

    const passwordHash = await bcrypt.hash(PASSWORD_TEST, 10);

    // 2. Obtener o asegurar productos para kits y pedidos
    console.log("2️⃣ Verificando productos de base...");
    let prodRes = await client.query("SELECT id_producto, nombre FROM producto ORDER BY id_producto ASC");
    if (prodRes.rows.length < 5) {
      await client.query(`
        INSERT INTO producto (nombre, unidad_medida, stock_actual, stock_minimo) VALUES
        ('Lavandina x 1L', 'unidad', 1000, 50),
        ('Detergente x 750ml', 'unidad', 1000, 50),
        ('Jabon liquido x 5L', 'bidon', 500, 20),
        ('Papel higienico pack x4', 'pack', 800, 40),
        ('Bolsas residuos pack x20', 'pack', 600, 30),
        ('Desinfectante piso x 5L', 'bidon', 400, 20),
        ('Alcohol en gel x 500ml', 'unidad', 500, 25),
        ('Guantes latex caja x100', 'caja', 300, 15)
        ON CONFLICT DO NOTHING
      `);
      prodRes = await client.query("SELECT id_producto, nombre FROM producto ORDER BY id_producto ASC");
    }
    const productos = prodRes.rows;
    console.log(`   ✅ ${productos.length} productos disponibles.`);

    // 3. Crear / asegurar usuarios estándar de testing Playwright
    console.log("3️⃣ Asegurando usuarios base (admin, operador, etc.)...");
    const adminRes = await client.query(`
      INSERT INTO usuario (nombre, apellido, email, password, role, activo)
      VALUES ('Admin', 'Sistema', 'admin@depo.local', $1, 'admin', true)
      ON CONFLICT (email) DO UPDATE SET password = $1, role = 'admin', activo = true
      RETURNING id_usuario
    `, [await bcrypt.hash("Admin123!", 10)]);
    const adminId = adminRes.rows[0].id_usuario;

    // Usuarios auxiliares Playwright
    const standardUsers = [
      { email: "compras@test.local", role: "area_compras", nombre: "Compras Test" },
      { email: "operador@test.local", role: "operador", nombre: "Operador Test" },
      { email: "control@test.local", role: "control_ministerio", nombre: "Control Test" },
      { email: "consulta@test.local", role: "consulta", nombre: "Consulta Test" }
    ];
    for (const u of standardUsers) {
      await client.query(`
        INSERT INTO usuario (nombre, apellido, email, password, role, activo)
        VALUES ($1, 'Test', $2, $3, $4, true)
        ON CONFLICT (email) DO UPDATE SET password = $3, role = $4, activo = true
      `, [u.nombre, u.email, passwordHash, u.role]);
    }

    // 4. Crear por cada nivel educativo:
    // - 1 Director de Área
    // - 10 Instituciones con Edificios
    // - 10 Directivos asociados a cada Institución
    // - 10 Supervisores
    // - 10 Zonas vinculadas con sus escuelas y supervisores
    // - 10 Kits con detalle
    // - 10 Pedidos con detalle y variados estados

    const estadosTramite = [
      "aprobado",
      "en_revision",
      "pendiente",
      "aprobado_parcial",
      "rechazado",
      "finalizado",
      "cancelado",
      "pendiente_director",
      "aprobado",
      "pendiente"
    ];

    for (const nivel of NIVELES) {
      console.log(`\n===============================================================`);
      console.log(`📚 PROCESANDO NIVEL EDUCATIVO: ${nivel.toUpperCase()}`);
      console.log(`===============================================================`);

      // 4.1 Director de Área
      const directorEmail = `director.${nivel}@test.local`;
      const directorRes = await client.query(`
        INSERT INTO usuario (nombre, apellido, email, password, role, nivel_educativo, activo)
        VALUES ($1, $2, $3, $4, 'director_area', $5, true)
        ON CONFLICT (email) DO UPDATE SET password = $4, role = 'director_area', nivel_educativo = $5, activo = true
        RETURNING id_usuario
      `, [`Director`, nivel.toUpperCase(), directorEmail, passwordHash, nivel]);
      const directorAreaId = directorRes.rows[0].id_usuario;
      console.log(`   👤 Director de Área: ${directorEmail} (ID: ${directorAreaId})`);

      // 4.2 Crear 10 Instituciones + 10 Edificios + 10 Directivos
      console.log(`   🏫 Creando 10 Instituciones y 10 Directivos para ${nivel}...`);
      const instituciones = [];
      const directivos = [];

      for (let i = 1; i <= 10; i++) {
        const cue = `700${NIVELES.indexOf(nivel) + 1}${String(i).padStart(4, "0")}`;
        const cui = `${cue}01`;
        const escuelaNombre = `Escuela ${nivel.charAt(0).toUpperCase() + nivel.slice(1)} N° ${i}`;

        // Edificio
        const edifRes = await client.query(`
          INSERT INTO edificio (cui, calle, numero_puerta, localidad, departamento, codigo_postal)
          VALUES ($1, $2, $3, 'Capital', 'Capital', 5400)
          ON CONFLICT (cui) DO UPDATE SET calle = EXCLUDED.calle
          RETURNING id_edificio
        `, [cui, `Calle Educativa ${i}`, `${100 + i}`]);
        const edificioId = edifRes.rows[0].id_edificio;

        // Institución
        const instExisting = await client.query(`
          SELECT id_institucion FROM institucion WHERE cue = $1 AND COALESCE(nivel_educativo, '') = $2
        `, [cue, nivel]);

        let instId;
        if (instExisting.rows.length > 0) {
          instId = instExisting.rows[0].id_institucion;
          await client.query(`
            UPDATE institucion
            SET nombre = $1, id_edificio = $2, matriculados = $3, activo = true
            WHERE id_institucion = $4
          `, [escuelaNombre, edificioId, 150 + i * 25, instId]);
        } else {
          const instInsert = await client.query(`
            INSERT INTO institucion (nombre, cue, id_edificio, nivel_educativo, tipo_escuela, matriculados, activo)
            VALUES ($1, $2, $3, $4, 'normal', $5, true)
            RETURNING id_institucion
          `, [escuelaNombre, cue, edificioId, nivel, 150 + i * 25]);
          instId = instInsert.rows[0].id_institucion;
        }
        instituciones.push({ id: instId, nombre: escuelaNombre, cue });

        // Directivo
        const directivoEmail = (i === 1 && nivel === "primario")
          ? "directivo.escuela1@test.local"
          : `directivo.${nivel}.${i}@test.local`;

        const dirRes = await client.query(`
          INSERT INTO usuario (nombre, apellido, email, password, role, nivel_educativo, id_institucion, activo)
          VALUES ($1, $2, $3, $4, 'directivo', $5, $6, true)
          ON CONFLICT (email) DO UPDATE 
          SET password = $4, role = 'directivo', nivel_educativo = $5, id_institucion = $6, activo = true
          RETURNING id_usuario
        `, [`Directivo`, `${nivel.toUpperCase()} ${i}`, directivoEmail, passwordHash, nivel, instId]);
        directivos.push({ id: dirRes.rows[0].id_usuario, email: directivoEmail, institucionId: instId });
      }
      console.log(`   ✅ 10 Instituciones y 10 Directivos creados para ${nivel}.`);

      // 4.3 Crear 10 Supervisores para este nivel
      console.log(`   👔 Creando 10 Supervisores para ${nivel}...`);
      const supervisores = [];
      for (let i = 1; i <= 10; i++) {
        const supEmail = (i === 1 && nivel === "primario")
          ? "supervisor.zona1@test.local"
          : `supervisor.${nivel}.${i}@test.local`;

        const supRes = await client.query(`
          INSERT INTO usuario (nombre, apellido, email, password, role, nivel_educativo, director_area_id, activo)
          VALUES ($1, $2, $3, $4, 'supervisor', $5, $6, true)
          ON CONFLICT (email) DO UPDATE 
          SET password = $4, role = 'supervisor', nivel_educativo = $5, director_area_id = $6, activo = true
          RETURNING id_usuario
        `, [`Supervisor`, `${nivel.toUpperCase()} ${i}`, supEmail, passwordHash, nivel, directorAreaId]);
        const supId = supRes.rows[0].id_usuario;
        supervisores.push({ id: supId, email: supEmail });

        // Asignación directa supervisor-escuela
        const instAsignada = instituciones[i - 1].id;
        await client.query(`
          INSERT INTO supervisor_escuela_asignacion (supervisor_id, institucion_id, director_area_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (supervisor_id, institucion_id) DO UPDATE SET director_area_id = EXCLUDED.director_area_id
        `, [supId, instAsignada, directorAreaId]);
      }
      console.log(`   ✅ 10 Supervisores creados y asignados para ${nivel}.`);

      // 4.4 Crear 10 Zonas para este nivel
      console.log(`   🗺️ Creando 10 Zonas para ${nivel}...`);
      const zonas = [];
      for (let i = 1; i <= 10; i++) {
        const zoneName = `Zona ${nivel.charAt(0).toUpperCase() + nivel.slice(1)} ${i}`;
        
        // Buscar o crear
        const zoneExisting = await client.query(`
          SELECT id FROM zona WHERE name = $1 AND nivel_educativo = $2
        `, [zoneName, nivel]);

        let zoneId;
        if (zoneExisting.rows.length > 0) {
          zoneId = zoneExisting.rows[0].id;
          await client.query(`
            UPDATE zona SET director_area_id = $1, activo = true WHERE id = $2
          `, [directorAreaId, zoneId]);
        } else {
          const zoneInsert = await client.query(`
            INSERT INTO zona (name, nombre, nivel_educativo, departamento, director_area_id, activo)
            VALUES ($1, $1, $2, 'Capital', $3, true)
            RETURNING id
          `, [zoneName, nivel, directorAreaId]);
          zoneId = zoneInsert.rows[0].id;
        }
        zonas.push({ id: zoneId, name: zoneName });

        // Vincular escuela a la zona
        const instId = instituciones[i - 1].id;
        await client.query(`
          INSERT INTO zona_institucion (zona_id, institucion_id)
          VALUES ($1, $2)
          ON CONFLICT (zona_id, institucion_id) DO NOTHING
        `, [zoneId, instId]);

        // Vincular supervisor a la zona
        const supId = supervisores[i - 1].id;
        await client.query(`
          INSERT INTO zona_supervisor (zona_id, supervisor_id)
          VALUES ($1, $2)
          ON CONFLICT (zona_id, supervisor_id) DO NOTHING
        `, [zoneId, supId]);
      }
      console.log(`   ✅ 10 Zonas creadas y vinculadas para ${nivel}.`);

      // 4.5 Crear 10 Kits para este nivel
      console.log(`   📦 Creando 10 Kits para ${nivel}...`);
      const kits = [];
      const kitNombres = [
        `Kit Higiene Integral ${nivel}`,
        `Kit Sanitarios y Baños ${nivel}`,
        `Kit Aulas y Desinfección ${nivel}`,
        `Kit Patios y Exteriores ${nivel}`,
        `Kit Primeros Auxilios ${nivel}`,
        `Kit Comedor Escolar ${nivel}`,
        `Kit Refuerzo Limpieza Invierno ${nivel}`,
        `Kit Refuerzo Verano ${nivel}`,
        `Kit Emergencia Sanitaria ${nivel}`,
        `Kit Anual Básico ${nivel}`
      ];

      for (let i = 0; i < 10; i++) {
        const nombreKit = kitNombres[i];
        const kitExisting = await client.query(`
          SELECT id FROM producto_kit WHERE nombre = $1
        `, [nombreKit]);

        let kitId;
        if (kitExisting.rows.length > 0) {
          kitId = kitExisting.rows[0].id;
          await client.query(`
            UPDATE producto_kit
            SET tipo_escuela = $1, activo = true, updated_at = NOW()
            WHERE id = $2
          `, [nivel, kitId]);
        } else {
          const kitInsert = await client.query(`
            INSERT INTO producto_kit (nombre, tipo_escuela, descripcion, cantidad_alumnos, activo, created_by)
            VALUES ($1, $2, $3, $4, true, $5)
            RETURNING id
          `, [
            nombreKit,
            nivel,
            `Kit oficial asignado a nivel ${nivel} - Variante #${i + 1}`,
            100 + (i + 1) * 20,
            directorAreaId
          ]);
          kitId = kitInsert.rows[0].id;
        }
        kits.push({ id: kitId, nombre: nombreKit });

        // Agregar 3 a 5 items al kit
        for (let pIdx = 0; pIdx < Math.min(productos.length, 4); pIdx++) {
          const prod = productos[(i + pIdx) % productos.length];
          await client.query(`
            INSERT INTO producto_kit_detalle (kit_id, id_producto, cantidad)
            VALUES ($1, $2, $3)
            ON CONFLICT (kit_id, id_producto) DO UPDATE SET cantidad = EXCLUDED.cantidad
          `, [kitId, prod.id_producto, (pIdx + 1) * 3]);
        }
      }
      console.log(`   ✅ 10 Kits creados y detallados para ${nivel}.`);

      // 4.6 Crear 10 Pedidos para este nivel (limpiando previos para evitar duplicaciones)
      console.log(`   📋 Creando 10 Pedidos para ${nivel}...`);
      const instIds = directivos.map(d => d.institucionId);
      await client.query("DELETE FROM detalle_pedido WHERE id_pedido IN (SELECT id_pedido FROM pedido WHERE id_institucion = ANY($1::int[]))", [instIds]);
      await client.query("DELETE FROM pedido WHERE id_institucion = ANY($1::int[])", [instIds]);

      for (let i = 0; i < 10; i++) {
        const estado = estadosTramite[i];
        const directivo = directivos[i];
        const supervisor = supervisores[i];
        const kit = kits[i];
        const instId = directivo.institucionId;

        const observaciones = `Pedido de prueba Nivel ${nivel.toUpperCase()} #${i + 1} - Estado: ${estado}`;
        const codigoRetiro = (estado === 'aprobado' || estado === 'finalizado')
          ? `RET-${nivel.substring(0, 3).toUpperCase()}-${String(1000 + i)}`
          : null;

        const pedidoInsert = await client.query(`
          INSERT INTO pedido (
            id_usuario_solicitante, id_institucion, estado, tipo,
            observaciones_generales, aprobado_director_area,
            aprobado_por_supervisor_id, fecha_aprobacion_supervisor,
            aprobado_por_director_id, fecha_aprobacion_director,
            kit_id, kit_nombre, kit_cantidad,
            codigo_retiro, fecha_creacion
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6,
            $7, $8,
            $9, $10,
            $11, $12, $13,
            $14, NOW() - INTERVAL '${i * 3} days'
          )
          RETURNING id_pedido
        `, [
          directivo.id,
          instId,
          estado,
          i % 2 === 0 ? "anual" : "emergencia",
          observaciones,
          estado === "aprobado" || estado === "finalizado",
          (estado !== "pendiente") ? supervisor.id : null,
          (estado !== "pendiente") ? new Date() : null,
          (estado === "aprobado" || estado === "finalizado") ? directorAreaId : null,
          (estado === "aprobado" || estado === "finalizado") ? new Date() : null,
          kit.id,
          kit.nombre,
          1,
          codigoRetiro
        ]);

        const pedidoId = pedidoInsert.rows[0].id_pedido;

        // Detalle de pedido con 2 a 4 productos
        for (let d = 0; d < 3; d++) {
          const prod = productos[(i + d) % productos.length];
          await client.query(`
            INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad_solicitada, observacion, stock_disponible_relevado)
            VALUES ($1, $2, $3, $4, $5)
          `, [
            pedidoId,
            prod.id_producto,
            (d + 1) * 5,
            `Solicitud ítem ${d + 1} para ${directivo.email}`,
            (d + 1) * 5
          ]);
        }
      }
      console.log(`   ✅ 10 Pedidos creados con sus detalles para ${nivel}.`);
    }

    await client.query("COMMIT");
    console.log("\n===============================================================");
    console.log("🎉 SEED GLOBAL COMPLETADO EXITOSAMENTE!");
    console.log("===============================================================");

    // Verificación final de cantidades
    const totDirectivos = await client.query("SELECT COUNT(*) FROM usuario WHERE role = 'directivo'");
    const totSupervisores = await client.query("SELECT COUNT(*) FROM usuario WHERE role = 'supervisor'");
    const totDirectores = await client.query("SELECT COUNT(*) FROM usuario WHERE role = 'director_area'");
    const totZonas = await client.query("SELECT COUNT(*) FROM zona");
    const totKits = await client.query("SELECT COUNT(*) FROM producto_kit");
    const totPedidos = await client.query("SELECT COUNT(*) FROM pedido");
    const totInstituciones = await client.query("SELECT COUNT(*) FROM institucion");

    console.log(`📊 TOTALES EN LA BASE DE DATOS:`);
    console.log(`   - Directores de Área: ${totDirectores.rows[0].count}`);
    console.log(`   - Directivos:         ${totDirectivos.rows[0].count} (Al menos 10 por cada uno de los 4 niveles)`);
    console.log(`   - Supervisores:       ${totSupervisores.rows[0].count} (Al menos 10 por cada uno de los 4 niveles)`);
    console.log(`   - Zonas:              ${totZonas.rows[0].count} (Al menos 10 por cada uno de los 4 niveles)`);
    console.log(`   - Kits de Productos:  ${totKits.rows[0].count} (Al menos 10 por cada uno de los 4 niveles)`);
    console.log(`   - Pedidos:            ${totPedidos.rows[0].count} (Al menos 10 por cada uno de los 4 niveles)`);
    console.log(`   - Instituciones:      ${totInstituciones.rows[0].count}`);
    console.log("===============================================================\n");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error durante el seed global:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Fallo fatal:", err);
  process.exit(1);
});
