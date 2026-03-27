const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('C:/Users/Docente/Downloads/database.sqlite', { readonly: true });

// 1. Exportar direcciones únicas
const direcciones = db.prepare(`
  SELECT DISTINCT calle, numero_puerta, localidad, zona_departamento AS departamento, codigo_postal, latitud, longitud, te_voip, letra_zona
  FROM edificios
`).all();

// Asignar un id_direccion incremental
direcciones.forEach((d, i) => d.id_direccion = i + 1);

const direccionesCsv = [
  'id_direccion,calle,numero_puerta,localidad,departamento,codigo_postal,latitud,longitud,te_voip,letra_zona',
  ...direcciones.map(d => [
    d.id_direccion, d.calle, d.numero_puerta, d.localidad, d.departamento, d.codigo_postal, d.latitud, d.longitud, d.te_voip, d.letra_zona
  ].map(v => v === null ? '' : String(v).replace(/"/g, '""')).map(v => `"${v}"`).join(','))
].join('\n');
fs.writeFileSync('direcciones_export.csv', direccionesCsv);
console.log('Archivo direcciones_export.csv generado');

// 2. Exportar edificios con FK a direccion
const edificios = db.prepare(`
  SELECT id AS id_edificio, cui, calle, numero_puerta, localidad, zona_departamento AS departamento, codigo_postal, latitud, longitud, te_voip, letra_zona
  FROM edificios
`).all();

// Relacionar cada edificio con su id_direccion
edificios.forEach(e => {
  const dir = direcciones.find(d =>
    d.calle === e.calle &&
    d.numero_puerta === e.numero_puerta &&
    d.localidad === e.localidad &&
    d.departamento === e.departamento &&
    String(d.codigo_postal || '') === String(e.codigo_postal || '') &&
    String(d.latitud || '') === String(e.latitud || '') &&
    String(d.longitud || '') === String(e.longitud || '') &&
    d.te_voip === e.te_voip &&
    d.letra_zona === e.letra_zona
  );
  e.id_direccion = dir ? dir.id_direccion : '';
});

const edificiosCsv = [
  'id_edificio,cui,id_direccion',
  ...edificios.map(e => [e.id_edificio, e.cui, e.id_direccion].map(v => v === null ? '' : String(v).replace(/"/g, '""')).map(v => `"${v}"`).join(','))
].join('\n');
fs.writeFileSync('edificios_export.csv', edificiosCsv);
console.log('Archivo edificios_export.csv generado');

// 3. Exportar instituciones con FK a edificio
const instituciones = db.prepare(`
  SELECT e.id AS id_institucion, e.cue, e.nombre, e.establecimiento_cabecera, e.edificio_id, m.nivel_educativo, m.categoria, m.ambito
  FROM establecimientos e
  LEFT JOIN (
    SELECT establecimiento_id, nivel_educativo, categoria, ambito
    FROM modalidades
    WHERE deleted_at IS NULL
    GROUP BY establecimiento_id, nivel_educativo, categoria, ambito
  ) m ON m.establecimiento_id = e.id
  WHERE e.deleted_at IS NULL
`).all();

const institucionesCsv = [
  'id_institucion,cue,nombre,establecimiento_cabecera,id_edificio,nivel_educativo,categoria,ambito',
  ...instituciones.map(i => [
    i.id_institucion, i.cue, i.nombre, i.establecimiento_cabecera, i.edificio_id, i.nivel_educativo, i.categoria, i.ambito
  ].map(v => v === null ? '' : String(v).replace(/"/g, '""')).map(v => `"${v}"`).join(','))
].join('\n');
fs.writeFileSync('instituciones_export.csv', institucionesCsv);
console.log('Archivo instituciones_export.csv generado');

