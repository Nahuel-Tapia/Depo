const path = require('path')
const fs = require('fs')

console.log('====================================================')
console.log('💻 INICIANDO AUDITORÍA Y TEST DE COMPONENTES FRONTEND')
console.log('====================================================\n')

let errors = []
let passedCount = 0

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath)

  files.forEach(file => {
    const fullPath = path.join(dirPath, file)
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles)
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      arrayOfFiles.push(fullPath)
    }
  })

  return arrayOfFiles
}

const frontendSrc = path.join(__dirname, '..', 'frontend', 'src')
const allFrontendFiles = getAllFiles(frontendSrc)

console.log(`📁 Encontrados ${allFrontendFiles.length} archivos fuente en frontend/src:\n`)

allFrontendFiles.forEach(filePath => {
  const relPath = path.relative(frontendSrc, filePath)
  process.stdout.write(`⏳ Verificando archivo: frontend/src/${relPath}... `)

  try {
    const content = fs.readFileSync(filePath, 'utf8')

    // 1. Basic non-empty check
    if (!content.trim()) {
      throw new Error('El archivo está completamente vacío')
    }

    // 2. Check imports
    const importRegex = /import\s+.*?from\s+['"](.*?)['"]/g
    let match
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1]

      // Check relative imports
      if (importPath.startsWith('.')) {
        const resolvedBase = path.resolve(path.dirname(filePath), importPath)
        const possibleExtensions = ['', '.jsx', '.js', '.css', '/index.jsx', '/index.js']
        const exists = possibleExtensions.some(ext => fs.existsSync(resolvedBase + ext))

        if (!exists) {
          throw new Error(`Import relativo no encontrado: "${importPath}" (resuelto como ${resolvedBase})`)
        }
      }
    }

    // 3. Check export default or exports
    if (!content.includes('export default') && !content.includes('export const') && !content.includes('export function') && !relPath.endsWith('main.jsx')) {
      console.log('⚠️ AVISO: Sin exportaciones explícitas')
    } else {
      console.log('✅ OK')
    }
    passedCount++
  } catch (err) {
    console.log('❌ ERROR')
    console.error(`   Detalle: ${err.message}`)
    errors.push({ file: relPath, error: err.message })
  }
})

console.log('\n====================================================')
console.log(`RESUMEN DE AUDITORÍA FRONTEND:`)
console.log(`✅ Archivos Verificados Exitosamente: ${passedCount}`)
console.log(`❌ Errores de Importación/Archivos: ${errors.length}`)
console.log('====================================================\n')

if (errors.length > 0) {
  console.error('LISTADO DE ERRORES FRONTEND:')
  errors.forEach(e => console.error(`- [${e.file}]: ${e.error}`))
  process.exit(1)
}
