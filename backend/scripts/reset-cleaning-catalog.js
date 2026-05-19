require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') })
const { Pool } = require('pg')
const dbConfig = require('../src/config/database')

const pool = new Pool(dbConfig)

const PRODUCTOS = [
  { nombre: 'Lavandina x 1L', unidad: 'unidad', stock: 480, stockMinimo: 60 },
  { nombre: 'Detergente x 750ml', unidad: 'unidad', stock: 360, stockMinimo: 40 },
  { nombre: 'Jabon liquido para manos x 5L', unidad: 'bidon', stock: 180, stockMinimo: 24 },
  { nombre: 'Desinfectante multiuso x 5L', unidad: 'bidon', stock: 180, stockMinimo: 24 },
  { nombre: 'Desodorante de piso x 5L', unidad: 'bidon', stock: 180, stockMinimo: 24 },
  { nombre: 'Alcohol etilico 70% x 500ml', unidad: 'unidad', stock: 240, stockMinimo: 30 },
  { nombre: 'Limpia vidrios x 500ml', unidad: 'unidad', stock: 180, stockMinimo: 24 },
  { nombre: 'Papel higienico pack x4', unidad: 'pack', stock: 520, stockMinimo: 80 },
  { nombre: 'Toallas de papel pack x3', unidad: 'pack', stock: 320, stockMinimo: 45 },
  { nombre: 'Bolsas residuos 45x60 pack x20', unidad: 'pack', stock: 260, stockMinimo: 36 },
  { nombre: 'Bolsas residuos 80x110 pack x10', unidad: 'pack', stock: 210, stockMinimo: 28 },
  { nombre: 'Esponja doble uso pack x10', unidad: 'pack', stock: 220, stockMinimo: 30 },
  { nombre: 'Trapo de piso reforzado', unidad: 'unidad', stock: 180, stockMinimo: 24 },
  { nombre: 'Escoba plastica', unidad: 'unidad', stock: 140, stockMinimo: 18 },
  { nombre: 'Secador 50 cm', unidad: 'unidad', stock: 140, stockMinimo: 18 },
  { nombre: 'Guantes de latex caja x100', unidad: 'caja', stock: 160, stockMinimo: 20 },
  { nombre: 'Jabon en polvo x 800g', unidad: 'unidad', stock: 200, stockMinimo: 30 },
  { nombre: 'Cera acrilica x 5L', unidad: 'bidon', stock: 90, stockMinimo: 12 }
]

const KIT_DEFINITIONS = [
  {
    nombre: 'Kit Limpieza Escuela Normal',
    tipo: 'normal',
    descripcion: 'Kit de prueba para instituciones de jornada normal.',
    cantidadAlumnos: 100,
    items: [
      ['Lavandina x 1L', 12],
      ['Detergente x 750ml', 10],
      ['Jabon liquido para manos x 5L', 3],
      ['Desinfectante multiuso x 5L', 2],
      ['Papel higienico pack x4', 20],
      ['Toallas de papel pack x3', 10],
      ['Bolsas residuos 45x60 pack x20', 8],
      ['Esponja doble uso pack x10', 4],
      ['Trapo de piso reforzado', 4],
      ['Escoba plastica', 2],
      ['Secador 50 cm', 2],
      ['Guantes de latex caja x100', 2]
    ]
  },
  {
    nombre: 'Kit Limpieza Jornada Extendida',
    tipo: 'jornada_extendida',
    descripcion: 'Kit de prueba para instituciones con jornada extendida.',
    cantidadAlumnos: 100,
    items: [
      ['Lavandina x 1L', 16],
      ['Detergente x 750ml', 14],
      ['Jabon liquido para manos x 5L', 4],
      ['Desinfectante multiuso x 5L', 3],
      ['Desodorante de piso x 5L', 3],
      ['Alcohol etilico 70% x 500ml', 8],
      ['Papel higienico pack x4', 26],
      ['Toallas de papel pack x3', 14],
      ['Bolsas residuos 45x60 pack x20', 10],
      ['Bolsas residuos 80x110 pack x10', 4],
      ['Esponja doble uso pack x10', 5],
      ['Trapo de piso reforzado', 5],
      ['Escoba plastica', 3],
      ['Secador 50 cm', 3],
      ['Guantes de latex caja x100', 3]
    ]
  },
  {
    nombre: 'Kit Limpieza Albergue',
    tipo: 'albergue',
    descripcion: 'Kit de prueba para instituciones tipo albergue.',
    cantidadAlumnos: 100,
    items: [
      ['Lavandina x 1L', 20],
      ['Detergente x 750ml', 18],
      ['Jabon liquido para manos x 5L', 5],
      ['Desinfectante multiuso x 5L', 4],
      ['Desodorante de piso x 5L', 4],
      ['Alcohol etilico 70% x 500ml', 10],
      ['Limpia vidrios x 500ml', 6],
      ['Papel higienico pack x4', 32],
      ['Toallas de papel pack x3', 18],
      ['Bolsas residuos 45x60 pack x20', 10],
      ['Bolsas residuos 80x110 pack x10', 8],
      ['Esponja doble uso pack x10', 6],
      ['Trapo de piso reforzado', 6],
      ['Escoba plastica', 4],
      ['Secador 50 cm', 4],
      ['Guantes de latex caja x100', 4],
      ['Jabon en polvo x 800g', 8]
    ]
  }
]

const ANNUAL_RULES_BY_TYPE = {
  normal: {
    base: 8,
    alumnosPorUnidad: 60,
    multiplicador: 1
  },
  jornada_extendida: {
    base: 10,
    alumnosPorUnidad: 55,
    multiplicador: 1.25
  },
  albergue: {
    base: 12,
    alumnosPorUnidad: 45,
    multiplicador: 1.5
  }
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [tableName]
  )
  return Boolean(result.rows[0]?.exists)
}

async function ensureCatalogSchema(client) {
  await client.query(`
    ALTER TABLE producto
    ADD COLUMN IF NOT EXISTS requiere_autorizacion BOOLEAN DEFAULT FALSE
  `)

  await client.query(`
    ALTER TABLE producto
    ADD COLUMN IF NOT EXISTS stock_minimo INT DEFAULT 0
  `)

  await client.query(`
    ALTER TABLE producto
    ADD COLUMN IF NOT EXISTS marca VARCHAR(120)
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS producto_kit (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(180) NOT NULL,
      tipo_escuela VARCHAR(40) NOT NULL,
      descripcion TEXT,
      cantidad_alumnos INT,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      created_by INT REFERENCES usuario(id_usuario),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `)

  await client.query(`
    ALTER TABLE producto_kit
    ADD COLUMN IF NOT EXISTS cantidad_alumnos INT
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS producto_kit_detalle (
      id SERIAL PRIMARY KEY,
      kit_id INT NOT NULL REFERENCES producto_kit(id) ON DELETE CASCADE,
      id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
      cantidad NUMERIC(12,2) NOT NULL,
      UNIQUE (kit_id, id_producto)
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS kit_producto_anual (
      id SERIAL PRIMARY KEY,
      tipo_escuela VARCHAR(40) NOT NULL,
      id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
      cantidad_base INT NOT NULL DEFAULT 0,
      alumnos_por_unidad INT NOT NULL DEFAULT 100,
      cantidad_por_unidad INT NOT NULL DEFAULT 0,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE (tipo_escuela, id_producto)
    )
  `)

  if (await tableExists(client, 'institucion')) {
    await client.query(`
      ALTER TABLE institucion
      ADD COLUMN IF NOT EXISTS kit_id INT REFERENCES producto_kit(id)
    `)
  }
}

async function deleteFromIfExists(client, tableName, whereClause = '') {
  if (!(await tableExists(client, tableName))) return
  const sql = `DELETE FROM ${tableName}${whereClause ? ` WHERE ${whereClause}` : ''}`
  await client.query(sql)
}

async function resetCatalog(client) {
  if (await tableExists(client, 'institucion')) {
    await client.query('UPDATE institucion SET kit_id = NULL WHERE kit_id IS NOT NULL')
  }

  await deleteFromIfExists(client, 'pedido_entrega')
  await deleteFromIfExists(client, 'solicitud_retiro_detalle')
  await deleteFromIfExists(client, 'planilla_pedido_anual_detalle')
  await deleteFromIfExists(client, 'detalle_pedido')
  await deleteFromIfExists(client, 'detalle_orden')
  await deleteFromIfExists(client, 'detalle_ingreso')

  if (await tableExists(client, 'producto')) {
    await client.query('UPDATE producto SET stock_actual = 0 WHERE stock_actual <> 0')
  }

  if (await tableExists(client, 'movimiento_stock')) {
    await client.query('ALTER TABLE movimiento_stock DISABLE TRIGGER USER')
    try {
      await client.query('DELETE FROM movimiento_stock')
    } finally {
      await client.query('ALTER TABLE movimiento_stock ENABLE TRIGGER USER')
    }
  }

  await deleteFromIfExists(client, 'movimientos')
  await deleteFromIfExists(client, 'ajustes')
  await deleteFromIfExists(client, 'asignaciones_stock')
  await deleteFromIfExists(client, 'limite_stock')
  await deleteFromIfExists(client, 'stock_deposito')
  await deleteFromIfExists(client, 'compra_precio_historico')
  await deleteFromIfExists(client, 'entrega_anual')
  await deleteFromIfExists(client, 'kit_producto_anual')
  await deleteFromIfExists(client, 'producto_kit_detalle')
  await deleteFromIfExists(client, 'producto_kit')
  await deleteFromIfExists(client, 'pedidos')

  if (await tableExists(client, 'producto')) {
    await client.query('DELETE FROM producto')
    await client.query("SELECT setval(pg_get_serial_sequence('producto', 'id_producto'), COALESCE(MAX(id_producto), 1), false) FROM producto")
  }

  if (await tableExists(client, 'producto_kit')) {
    await client.query("SELECT setval(pg_get_serial_sequence('producto_kit', 'id'), COALESCE(MAX(id), 1), false) FROM producto_kit")
  }

  if (await tableExists(client, 'kit_producto_anual')) {
    await client.query("SELECT setval(pg_get_serial_sequence('kit_producto_anual', 'id'), COALESCE(MAX(id), 1), false) FROM kit_producto_anual")
  }
}

async function findCentralDepositoId(client) {
  const centralResult = await client.query(
    "SELECT id_deposito FROM deposito WHERE tipo = 'central' ORDER BY id_deposito LIMIT 1"
  )
  const centralId = Number(centralResult.rows[0]?.id_deposito || 0)
  if (!centralId) {
    throw new Error('No se encontro un deposito central. Ejecuta primero backend/scripts/create-depositos.js')
  }
  return centralId
}

async function findSeedUserId(client) {
  const result = await client.query(
    `SELECT id_usuario
     FROM usuario
     WHERE role IN ('admin', 'master')
     ORDER BY id_usuario
     LIMIT 1`
  )
  return Number(result.rows[0]?.id_usuario || 0) || null
}

async function insertProducts(client, centralDepositoId, seedUserId) {
  const productosByName = new Map()

  for (const producto of PRODUCTOS) {
    const insertResult = await client.query(
      `INSERT INTO producto (nombre, unidad_medida, stock_actual, stock_minimo, requiere_autorizacion)
       VALUES ($1, $2, $3, $4, FALSE)
       RETURNING id_producto`,
      [producto.nombre, producto.unidad, producto.stock, producto.stockMinimo]
    )

    const productoId = Number(insertResult.rows[0].id_producto)
    productosByName.set(producto.nombre, { id: productoId, ...producto })

    if (await tableExists(client, 'stock_deposito')) {
      await client.query(
        `INSERT INTO stock_deposito (id_deposito, id_producto, cantidad)
         VALUES ($1, $2, $3)` ,
        [centralDepositoId, productoId, producto.stock]
      )
    }

    if (seedUserId && await tableExists(client, 'movimiento_stock')) {
      await client.query(
        `INSERT INTO movimiento_stock (id_producto, tipo, cantidad, motivo, id_usuario, id_deposito)
         VALUES ($1, 'ingreso', $2, $3, $4, $5)`,
        [productoId, producto.stock, 'Seed catalogo limpieza', seedUserId, centralDepositoId]
      )
    }
  }

  return productosByName
}

async function insertAnnualRules(client, productosByName) {
  for (const [tipoEscuela, config] of Object.entries(ANNUAL_RULES_BY_TYPE)) {
    for (const producto of PRODUCTOS) {
      const productoInfo = productosByName.get(producto.nombre)
      const cantidadBase = Math.max(1, Math.round(config.base * config.multiplicador))
      const cantidadPorUnidad = Math.max(1, Math.round((producto.stockMinimo / 12) * config.multiplicador))

      await client.query(
        `INSERT INTO kit_producto_anual (
           tipo_escuela,
           id_producto,
           cantidad_base,
           alumnos_por_unidad,
           cantidad_por_unidad,
           activo
         )
         VALUES ($1, $2, $3, $4, $5, TRUE)`,
        [tipoEscuela, productoInfo.id, cantidadBase, config.alumnosPorUnidad, cantidadPorUnidad]
      )
    }
  }
}

async function insertKits(client, productosByName, seedUserId) {
  const createdKits = []

  for (const kit of KIT_DEFINITIONS) {
    const insertKit = await client.query(
      `INSERT INTO producto_kit (nombre, tipo_escuela, descripcion, cantidad_alumnos, activo, created_by)
       VALUES ($1, $2, $3, $4, TRUE, $5)
       RETURNING id`,
      [kit.nombre, kit.tipo, kit.descripcion, kit.cantidadAlumnos, seedUserId]
    )

    const kitId = Number(insertKit.rows[0].id)
    createdKits.push({ id: kitId, nombre: kit.nombre, tipo: kit.tipo, items: kit.items.length })

    for (const [productoNombre, cantidad] of kit.items) {
      const productoInfo = productosByName.get(productoNombre)
      if (!productoInfo) {
        throw new Error(`No se encontro el producto requerido para kit: ${productoNombre}`)
      }

      await client.query(
        `INSERT INTO producto_kit_detalle (kit_id, id_producto, cantidad)
         VALUES ($1, $2, $3)`,
        [kitId, productoInfo.id, cantidad]
      )
    }
  }

  return createdKits
}

async function main() {
  const client = await pool.connect()

  try {
    console.log('1/4 - Preparando esquema de catalogo y kits...')
    await client.query('BEGIN')
    await ensureCatalogSchema(client)

    console.log('2/4 - Eliminando productos y datos relacionados...')
    await resetCatalog(client)

    console.log('3/4 - Insertando articulos de limpieza y stock central...')
    const centralDepositoId = await findCentralDepositoId(client)
    const seedUserId = await findSeedUserId(client)
    const productosByName = await insertProducts(client, centralDepositoId, seedUserId)

    console.log('4/4 - Creando kits de prueba y reglas anuales...')
    await insertAnnualRules(client, productosByName)
    const kits = await insertKits(client, productosByName, seedUserId)

    await client.query('COMMIT')

    const productosCount = Number((await client.query('SELECT COUNT(*)::int AS total FROM producto')).rows[0].total)
    const kitsCount = Number((await client.query('SELECT COUNT(*)::int AS total FROM producto_kit WHERE activo = TRUE')).rows[0].total)
    const stockCount = Number((await client.query('SELECT COUNT(*)::int AS total FROM stock_deposito')).rows[0].total)

    console.log('\n=== RESUMEN ===')
    console.log(`Productos creados: ${productosCount}`)
    console.log(`Kits activos creados: ${kitsCount}`)
    console.log(`Registros de stock central: ${stockCount}`)
    console.log(`Deposito central usado: ${centralDepositoId}`)
    console.log('\nKits generados:')
    kits.forEach((kit) => {
      console.log(`- ${kit.nombre} [${kit.tipo}] con ${kit.items} items`)
    })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('No se pudo resetear y sembrar el catalogo de limpieza', err)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main()