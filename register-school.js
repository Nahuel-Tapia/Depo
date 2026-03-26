const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./backend/depo.sqlite');

const escuela = {
  cue: '123456789',
  nombre: 'Escuela Municipal San Jorge',
  nivel: 'secundario',
  tipo: 'municipal',
  matriculados: 450,
  direccion: 'Calle Principal 123',
  localidad: 'Mendoza',
  departamento: 'Capital',
  telefono: '2614567890',
  email: 'contacto@sanjorge.edu',
  notas: 'Escuela de prueba',
  activo: 1,
  factor_asignacion: 1.5
};

db.run(
  `INSERT INTO instituciones (cue, nombre, nivel, tipo, matriculados, direccion, localidad, departamento, telefono, email, notas, activo, factor_asignacion) 
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [escuela.cue, escuela.nombre, escuela.nivel, escuela.tipo, escuela.matriculados, escuela.direccion, escuela.localidad, escuela.departamento, escuela.telefono, escuela.email, escuela.notas, escuela.activo, escuela.factor_asignacion],
  function(err) {
    if (err) {
      console.error('Error al insertar:', err.message);
    } else {
      console.log('✓ Institución creada correctamente');
      console.log('');
      console.log('Datos registrados:');
      console.log(`  CUE: ${escuela.cue}`);
      console.log(`  Nombre: ${escuela.nombre}`);
      console.log(`  Tipo: ${escuela.tipo}`);
      console.log(`  Localidad: ${escuela.localidad}`);
      console.log(`  Matriculados: ${escuela.matriculados}`);
      console.log(`  Factor: ${escuela.factor_asignacion}x`);
    }
    db.close();
  }
);
