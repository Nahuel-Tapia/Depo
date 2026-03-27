const Database = require('better-sqlite3');
const db = new Database('C:/Users/Docente/Downloads/database.sqlite', { readonly: true });

// Obtener todas las tablas
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();

console.log('=== RESUMEN DE BASE DE DATOS SQLITE ===\n');
console.log('Total tablas:', tables.length);
console.log('Tablas:', tables.map(t => t.name).join(', '));

tables.forEach(table => {
  const tableName = table.name;
  
  // Contar registros
  const count = db.prepare(`SELECT COUNT(*) as total FROM "${tableName}"`).get();
  
  // Obtener columnas
  const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all();
  
  console.log(`\n--- ${tableName} (${count.total} registros) ---`);
  console.log('Columnas:');
  columns.forEach(c => console.log(`  - ${c.name}: ${c.type}${c.pk ? ' (PK)' : ''}`));
  
  // Mostrar solo ID/key de los primeros 3 registros (sin datos largos)
  if (count.total > 0 && tableName !== 'cache') {
    const sample = db.prepare(`SELECT * FROM "${tableName}" LIMIT 3`).all();
    sample.forEach((row, i) => {
      // Truncar valores largos
      const truncated = {};
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'string' && value.length > 80) {
          truncated[key] = value.substring(0, 77) + '...';
        } else {
          truncated[key] = value;
        }
      }
      console.log(`  Registro ${i+1}:`, JSON.stringify(truncated));
    });
  }
});

db.close();
console.log('\n=== FIN ===');
