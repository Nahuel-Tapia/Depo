require('dotenv').config()
const path = require('path')
const fs = require('fs')

console.log('====================================================')
console.log('🚀 INICIANDO AUDITORÍA Y TEST GLOBAL DE LA APLICACIÓN')
console.log('====================================================\n')

let errorsFound = []
let passedTests = 0

function runTest(name, fn) {
  process.stdout.write(`⏳ Probando: ${name}... `)
  try {
    fn()
    console.log('✅ OK')
    passedTests++
  } catch (err) {
    console.log('❌ ERROR')
    console.error(`   Detalle: ${err.message}`)
    errorsFound.push({ name, error: err.message, stack: err.stack })
  }
}

async function runAsyncTest(name, fn) {
  process.stdout.write(`⏳ Probando (async): ${name}... `)
  try {
    await fn()
    console.log('✅ OK')
    passedTests++
  } catch (err) {
    console.log('❌ ERROR')
    console.error(`   Detalle: ${err.message}`)
    errorsFound.push({ name, error: err.message, stack: err.stack })
  }
}

async function start() {
  // 1. Test Base Database & Config
  runTest('Importación de db.pg.js y configuración DB', () => {
    const db = require('../backend/src/db.pg')
    if (!db.all || !db.get || !db.run || !db.pool) {
      throw new Error('Faltan métodos clave en db.pg.js (all, get, run, pool)')
    }
  })

  // 2. Test DB Connection
  await runAsyncTest('Conexión activa a base de datos PostgreSQL', async () => {
    const { get } = require('../backend/src/db.pg')
    const result = await get('SELECT NOW() as fecha_actual')
    if (!result || !result.fecha_actual) {
      throw new Error('No se pudo ejecutar SELECT NOW() en la BD')
    }
  })

  // 3. Test permissions.js
  runTest('Carga de matriz de permisos (permissions.js)', () => {
    const { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } = require('../backend/src/permissions')
    if (!PERMISSIONS || Object.keys(PERMISSIONS).length === 0) {
      throw new Error('PERMISSIONS está vacío')
    }
    if (!DEFAULT_ROLE_PERMISSIONS || Object.keys(DEFAULT_ROLE_PERMISSIONS).length === 0) {
      throw new Error('DEFAULT_ROLE_PERMISSIONS está vacío')
    }
  })

  // 4. Test ALL Backend Service Files
  const servicesDir = path.join(__dirname, '..', 'backend', 'src', 'services')
  const serviceFiles = fs.readdirSync(servicesDir).filter(f => f.endsWith('.js'))
  console.log(`\n📁 Verificando ${serviceFiles.length} servicios de Backend...`)

  for (const file of serviceFiles) {
    runTest(`Servicio: ${file}`, () => {
      const service = require(path.join(servicesDir, file))
      if (!service || typeof service !== 'object') {
        throw new Error(`El módulo ${file} no exporta un objeto válido`)
      }
    })
  }

  // 5. Test ALL Backend Controller Files
  const controllersDir = path.join(__dirname, '..', 'backend', 'src', 'controllers')
  const controllerFiles = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'))
  console.log(`\n📁 Verificando ${controllerFiles.length} controladores de Backend...`)

  for (const file of controllerFiles) {
    runTest(`Controlador: ${file}`, () => {
      const controller = require(path.join(controllersDir, file))
      if (!controller || typeof controller !== 'object') {
        throw new Error(`El módulo ${file} no exporta un objeto válido`)
      }
    })
  }

  // 6. Test ALL Backend Route Files
  const routesDir = path.join(__dirname, '..', 'backend', 'src', 'routes')
  const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'))
  console.log(`\n📁 Verificando ${routeFiles.length} rutas de Backend...`)

  for (const file of routeFiles) {
    runTest(`Ruta Express: ${file}`, () => {
      const route = require(path.join(routesDir, file))
      if (!route || (typeof route !== 'function' && typeof route !== 'object')) {
        throw new Error(`El módulo ${file} no exporta un router Express válido`)
      }
    })
  }

  // 7. Test Middlewares
  const middlewareDir = path.join(__dirname, '..', 'backend', 'src', 'middleware')
  const middlewareFiles = fs.readdirSync(middlewareDir).filter(f => f.endsWith('.js'))
  console.log(`\n📁 Verificando ${middlewareFiles.length} middlewares de Backend...`)

  for (const file of middlewareFiles) {
    runTest(`Middleware: ${file}`, () => {
      const mw = require(path.join(middlewareDir, file))
      if (!mw) {
        throw new Error(`El middleware ${file} no se pudo cargar`)
      }
    })
  }

  // 8. Test Main Server
  runTest('Inicialización de Express App (server.js)', () => {
    const app = require('../backend/src/server')
    if (!app || typeof app !== 'function') {
      throw new Error('server.js no exporta una instancia Express válida')
    }
  })

  // 9. Execute DB Queries on Core Tables
  console.log('\n📊 Verificando integridad de Tablas y Consultas de BD...')

  await runAsyncTest('Consulta a tabla usuario', async () => {
    const { all } = require('../backend/src/db.pg')
    const users = await all('SELECT id_usuario, email, role, activo FROM usuario LIMIT 5')
    if (!Array.isArray(users)) throw new Error('Query usuario no devolvió un array')
  })

  await runAsyncTest('Consulta a tabla rol', async () => {
    const { all } = require('../backend/src/db.pg')
    const roles = await all('SELECT id_rol, nombre FROM rol ORDER BY nombre ASC')
    if (!Array.isArray(roles) || roles.length === 0) throw new Error('Query rol no devolvió roles')
  })

  await runAsyncTest('Consulta a tabla producto', async () => {
    const { all } = require('../backend/src/db.pg')
    const prods = await all('SELECT id_producto, nombre, codigo_sku, marca, ubicacion_estante, es_perecedero FROM producto LIMIT 5')
    if (!Array.isArray(prods)) throw new Error('Query producto no devolvió un array')
  })

  await runAsyncTest('Consulta a tabla institucion', async () => {
    const { all } = require('../backend/src/db.pg')
    const insts = await all('SELECT id_institucion, cue, nombre, nivel_educativo, departamento FROM institucion LIMIT 5')
    if (!Array.isArray(insts)) throw new Error('Query institucion no devolvió un array')
  })

  await runAsyncTest('Consulta a tabla deposito', async () => {
    const { all } = require('../backend/src/db.pg')
    const deps = await all('SELECT id_deposito, nombre, tipo_deposito, ubicacion FROM deposito LIMIT 5')
    if (!Array.isArray(deps)) throw new Error('Query deposito no devolvió un array')
  })

  await runAsyncTest('Consulta a tabla movimiento_stock', async () => {
    const { all } = require('../backend/src/db.pg')
    const movs = await all('SELECT id_movimiento, tipo, fecha_movimiento FROM movimiento_stock LIMIT 5')
    if (!Array.isArray(movs)) throw new Error('Query movimiento_stock no devolvió un array')
  })

  // Summary
  console.log('\n====================================================')
  console.log(`RESUMEN DE PRUEBAS BACKEND Y BASE DE DATOS:`)
  console.log(`✅ Pruebas Exitosas: ${passedTests}`)
  console.log(`❌ Errores Encontrados: ${errorsFound.length}`)
  console.log('====================================================\n')

  if (errorsFound.length > 0) {
    console.error('LISTADO DE ERRORES:')
    errorsFound.forEach(e => console.error(`- [${e.name}]: ${e.error}`))
    process.exit(1)
  }
}

start().catch(err => {
  console.error('Error fatal durante la prueba:', err)
  process.exit(1)
})
