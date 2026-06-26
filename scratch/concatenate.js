const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '../docs');
const outputFile = path.join(docsDir, 'documento_completo_depo.md');

const files = [
  'capitulo1_introduccion.md',
  'capitulo2_problema.md',
  'capitulo3_objetivos.md',
  'capitulo4_alcance.md',
  'capitulo5_marco_teorico.md',
  'capitulo6_metodologia.md',
  'capitulo7_requerimientos.md',
  'capitulo8_diseno.md',
  'capitulo9_casos_de_uso.md',
  'capitulo10_implementacion.md',
  'capitulo11_pruebas.md',
  'capitulo12_seguridad.md',
  'capitulo13_legal.md',
  'capitulo14_implementacion_plan.md',
  'capitulo15_factibilidad.md',
  'capitulo16_conclusiones.md',
  'capitulo17_bibliografia.md',
  'capitulo18_anexos.md'
];

let consolidatedContent = `# TRABAJO FINAL DE TECNICATURA: DEPO\n\n## SISTEMA DE GESTIÓN DE STOCK, PEDIDOS Y DISTRIBUCIÓN PARA EL MINISTERIO DE EDUCACIÓN DE SAN JUAN\n\n\n**Institución:** Universidad Católica de Cuyo (UCCuyo)\n\n**Carrera:** Tecnicatura Universitaria en Desarrollo de Software\n\n**Fecha:** Junio 2026\n\n---\n\n`;

for (const file of files) {
  const filePath = path.join(docsDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`Leyendo: ${file}`);
    const content = fs.readFileSync(filePath, 'utf8');
    // Agrega salto de página en formato compatible con exportadores Markdown PDF
    consolidatedContent += content + '\n\n<div style="page-break-after: always;"></div>\n\n';
  } else {
    console.error(`Error: Archivo no encontrado: ${filePath}`);
    process.exit(1);
  }
}

fs.writeFileSync(outputFile, consolidatedContent, 'utf8');
console.log(`\nÉxito: Documento consolidado creado en: ${outputFile}`);
