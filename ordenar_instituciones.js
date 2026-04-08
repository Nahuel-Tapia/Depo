const fs = require('fs');

const inputFile = 'instituciones_export.csv';
const outputFile = 'instituciones_export_ordenado.csv';

// Orden deseado de las columnas
const orden = [
  'id_institucion',
  'nombre',
  'cue',
  'id_edificio',
  'establecimiento_de_cabecera',
  'nivel_educativo',
  'categoria',
  'ambito'
];

const data = fs.readFileSync(inputFile, 'utf8').split('\n');
const headers = data[0].split(',');

// Mapear el índice de cada columna deseada
const indices = orden.map(col => headers.indexOf(col));

const output = [];
output.push(orden.join(','));

for (let i = 1; i < data.length; i++) {
  if (!data[i].trim()) continue; // Saltar líneas vacías
  const row = data[i].split(',');
  const newRow = indices.map(idx => row[idx]);
  output.push(newRow.join(','));
}

fs.writeFileSync(outputFile, output.join('\n'), 'utf8');
console.log('Archivo ordenado generado:', outputFile);
