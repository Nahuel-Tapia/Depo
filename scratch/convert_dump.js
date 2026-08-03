const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '..', 'backend', 'depo_stock_dump.sql');
const outputPath = path.join(__dirname, '..', 'backend', 'depo_stock_supabase.sql');

console.log('Leyendo dump original:', inputPath);
const content = fs.readFileSync(inputPath, 'utf8');
const lines = content.split(/\r?\n/);

const outputLines = [];
let inCopy = false;
let copyTable = '';
let copyColumns = '';
let copyRows = [];

function escapeSqlValue(val) {
  if (val === '\\N' || val === null || val === undefined) {
    return 'NULL';
  }
  // Si es número entero/decimal puro
  if (/^-?\d+(\.\d+)?$/.test(val)) {
    return val;
  }
  // Si es booleano
  if (val === 't') return 'TRUE';
  if (val === 'f') return 'FALSE';
  // Escapar comillas simples
  const escaped = val.replace(/'/g, "''").replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  return `'${escaped}'`;
}

function flushCopyGroup() {
  if (copyRows.length === 0) return;
  
  // Agrupar inserts de a 100 filas
  const chunkSize = 100;
  for (let i = 0; i < copyRows.length; i += chunkSize) {
    const chunk = copyRows.slice(i, i + chunkSize);
    const valueTuples = chunk.map(row => {
      const values = row.split('\t').map(escapeSqlValue);
      return `(${values.join(', ')})`;
    });
    outputLines.push(`INSERT INTO ${copyTable} ${copyColumns} VALUES\n${valueTuples.join(',\n')};`);
  }
  copyRows = [];
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Ignorar comandos psql de restriccion
  if (/^\s*\\restrict/i.test(line) || /^\s*\\unrestrict/i.test(line)) {
    continue;
  }

  // Detectar inicio de COPY
  const copyMatch = line.match(/^COPY\s+([^\s(]+)\s*\(([^)]+)\)\s+FROM\s+stdin;/i);
  if (copyMatch) {
    inCopy = true;
    copyTable = copyMatch[1];
    copyColumns = `(${copyMatch[2]})`;
    copyRows = [];
    outputLines.push(`-- Insertando datos en ${copyTable}`);
    continue;
  }

  if (inCopy) {
    if (line.trim() === '\\.') {
      inCopy = false;
      flushCopyGroup();
      outputLines.push('');
    } else {
      copyRows.push(line);
    }
    continue;
  }

  outputLines.push(line);
}

fs.writeFileSync(outputPath, outputLines.join('\n'), 'utf8');
console.log('Dump limpio generado en:', outputPath);
