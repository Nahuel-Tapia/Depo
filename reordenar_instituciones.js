const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'instituciones_export.csv');
const outputFile = path.join(__dirname, 'instituciones_export_reordenado.csv');

// Orden deseado de columnas
const headerDeseado = [
  'id_institucion',
  'nombre',
  'cue',
  'id_edificio',
  'establecimiento_cabecera',
  'nivel_educativo',
  'categoria',
  'ambito',
  'activo'
];

function parseCSVLine(line) {
  // Divide la línea en columnas, respetando comillas
  const regex = /(?:"([^"]*)")|([^,]+)/g;
  const result = [];
  let match;
  let lastIndex = 0;
  while ((match = regex.exec(line)) !== null) {
    if (match[1] !== undefined) {
      result.push(match[1]);
    } else if (match[2] !== undefined) {
      result.push(match[2].replace(/^"|"$/g, ''));
    } else {
      result.push('');
    }
    lastIndex = regex.lastIndex;
    if (line[lastIndex] === ',') lastIndex++;
  }
  // Si la línea termina en coma, agregar columna vacía
  if (line.endsWith(',')) result.push('');
  return result;
}

fs.readFile(inputFile, 'utf8', (err, data) => {
  if (err) throw err;
  const lines = data.split(/\r?\n/).filter(Boolean);
  const headerOriginal = parseCSVLine(lines[0]);
  const outLines = [headerDeseado.join(',')];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    // Saltar encabezados repetidos
    if (cols.map(x => x.trim().toLowerCase()).join(',') === headerOriginal.map(x => x.trim().toLowerCase()).join(',')) continue;
    const rowObj = {};
    for (let j = 0; j < headerOriginal.length; j++) {
      rowObj[headerOriginal[j]] = cols[j] || '';
    }
    const reordered = [
      rowObj['id_institucion'] || '',
      rowObj['nombre'] || '',
      rowObj['cue'] || '',
      rowObj['id_edificio'] || '',
      rowObj['establecimiento_cabecera'] || '',
      rowObj['nivel_educativo'] || '',
      rowObj['categoria'] || '',
      rowObj['ambito'] || '',
      '1'
    ];
    outLines.push(reordered.map(v => `"${v}"`).join(','));
  }
  fs.writeFile(outputFile, outLines.join('\n'), 'utf8', err => {
    if (err) throw err;
    console.log('Archivo reordenado y campo activo agregado correctamente.');
  });
});
