/**
 * Usuarios de Prueba (Mock Data)
 * 
 * Este archivo contiene usuarios de prueba para desarrollo y testing.
 * NO inserta datos en la base de datos - solo proporciona datos mock.
 * 
 * Uso:
 *   const { TEST_USERS, getMockUser, getMockToken } = require('./mock/test_users');
 * 
 *   // Obtener todos los usuarios de prueba
 *   console.log(TEST_USERS);
 * 
 *   // Obtener un usuario específico por rol
 *   const admin = getMockUser('admin');
 * 
 *   // Simular token JWT (para testing)
 *   const token = getMockToken(admin);
 */

const { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } = require('../permissions');

/**
 * Lista de usuarios de prueba con diferentes roles y permisos
 * Las contraseñas están en texto plano para propósitos de testing
 */
const TEST_USERS = [
  {
    id: 1,
    nombre: 'Administrador',
    apellido: 'Sistema',
    email: 'admin@depo.test',
    dni: '11111111',
    password: 'admin123', // Contraseña de prueba
    role: 'admin',
    telefono: '+54 9 11 1111-1111',
    id_institucion: null,
    activo: true,
    nivel_educativo: null,
    director_area_id: null,
    jurisdiccion: null,
    permisos: DEFAULT_ROLE_PERMISSIONS.admin,
    descripcion: 'Administrador con acceso completo a todas las funcionalidades'
  },
  {
    id: 2,
    nombre: 'Control',
    apellido: 'Ministerio',
    email: 'control@ministry.test',
    dni: '22222222',
    password: 'control123',
    role: 'control_ministerio',
    telefono: '+54 9 11 2222-2222',
    id_institucion: null,
    activo: true,
    nivel_educativo: null,
    director_area_id: null,
    jurisdiccion: null,
    permisos: DEFAULT_ROLE_PERMISSIONS.control_ministerio,
    descripcion: 'Usuario de control del ministerio con vista de auditoría y gestión de instituciones'
  },
  {
    id: 3,
    nombre: 'Director',
    apellido: 'Escuela',
    email: 'director@school1.test',
    dni: '33333333',
    password: 'director123',
    role: 'directivo',
    telefono: '+54 9 11 3333-3333',
    id_institucion: 1, // Escuela Primaria N°1
    activo: true,
    nivel_educativo: null,
    director_area_id: null,
    jurisdiccion: null,
    permisos: DEFAULT_ROLE_PERMISSIONS.directivo,
    descripcion: 'Directivo de institución educativa - puede crear pedidos y ver auditoría'
  },
  {
    id: 4,
    nombre: 'Supervisor',
    apellido: 'Zona Norte',
    email: 'supervisor@zone1.test',
    dni: '44444444',
    password: 'supervisor123',
    role: 'supervisor',
    telefono: '+54 9 11 4444-4444',
    id_institucion: null,
    activo: true,
    nivel_educativo: 'Primario',
    director_area_id: 5, // Reporta al Director de Área
    jurisdiccion: 'Zona Norte',
    permisos: DEFAULT_ROLE_PERMISSIONS.supervisor,
    descripcion: 'Supervisor de zona - gestiona pedidos e instituciones asignadas'
  },
  {
    id: 5,
    nombre: 'Director',
    apellido: 'Area Primario',
    email: 'director.area@primary.test',
    dni: '55555555',
    password: 'directorarea123',
    role: 'director_area',
    telefono: '+54 9 11 5555-5555',
    id_institucion: null,
    activo: true,
    nivel_educativo: 'Primario',
    director_area_id: null,
    jurisdiccion: null,
    permisos: DEFAULT_ROLE_PERMISSIONS.director_area,
    descripcion: 'Director de Área de Nivel Primario - gestiona usuarios y supervisión'
  },
  {
    id: 6,
    nombre: 'Operador',
    apellido: 'Deposito',
    email: 'operador@depo.test',
    dni: '66666666',
    password: 'operador123',
    role: 'operador',
    telefono: '+54 9 11 6666-6666',
    id_institucion: null,
    activo: true,
    nivel_educativo: null,
    director_area_id: null,
    jurisdiccion: null,
    permisos: DEFAULT_ROLE_PERMISSIONS.operador,
    descripcion: 'Operador de depósito - gestiona stock, productos y movimientos'
  },
  {
    id: 7,
    nombre: 'Consulta',
    apellido: 'General',
    email: 'consulta@depo.test',
    dni: '77777777',
    password: 'consulta123',
    role: 'consulta',
    telefono: '+54 9 11 7777-7777',
    id_institucion: null,
    activo: true,
    nivel_educativo: null,
    director_area_id: null,
    jurisdiccion: null,
    permisos: DEFAULT_ROLE_PERMISSIONS.consulta,
    descripcion: 'Usuario de solo consulta - vista de dashboard, stock y movimientos'
  },
  {
    id: 8,
    nombre: 'Compras',
    apellido: 'Area',
    email: 'compras@depo.test',
    dni: '88888888',
    password: 'compras123',
    role: 'area_compras',
    telefono: '+54 9 11 8888-8888',
    id_institucion: null,
    activo: true,
    nivel_educativo: null,
    director_area_id: null,
    jurisdiccion: null,
    permisos: DEFAULT_ROLE_PERMISSIONS.area_compras,
    descripcion: 'Área de compras - gestiona planillas y proveedores'
  },
  {
    id: 9,
    nombre: 'Director',
    apellido: 'Area Secundario',
    email: 'director.area@secondary.test',
    dni: '99999999',
    password: 'directorarea123',
    role: 'director_area',
    telefono: '+54 9 11 9999-9999',
    id_institucion: null,
    activo: true,
    nivel_educativo: 'Secundario',
    director_area_id: null,
    jurisdiccion: null,
    permisos: DEFAULT_ROLE_PERMISSIONS.director_area,
    descripcion: 'Director de Área de Nivel Secundario - gestiona usuarios y supervisión'
  },
  {
    id: 10,
    nombre: 'Supervisor',
    apellido: 'Zona Sur',
    email: 'supervisor@zone2.test',
    dni: '10101010',
    password: 'supervisor123',
    role: 'supervisor',
    telefono: '+54 9 11 1010-1010',
    id_institucion: null,
    activo: true,
    nivel_educativo: 'Secundario',
    director_area_id: 9, // Reporta al Director de Área Secundario
    jurisdiccion: 'Zona Sur',
    permisos: DEFAULT_ROLE_PERMISSIONS.supervisor,
    descripcion: 'Supervisor de zona sur - gestiona pedidos e instituciones asignadas'
  }
];

/**
 * Instituciones de prueba asociadas a los usuarios
 */
const TEST_INSTITUTIONS = [
  {
    id: 1,
    nombre: 'Escuela Primaria N°1',
    cue: 'CUE001',
    nivel_educativo: 'Primario',
    descripcion: 'Escuela primaria de referencia para testing'
  },
  {
    id: 2,
    nombre: 'Escuela Secundaria N°2',
    cue: 'CUE002',
    nivel_educativo: 'Secundario',
    descripcion: 'Escuela secundaria de referencia for testing'
  },
  {
    id: 3,
    nombre: 'Jardin de Infantes N°3',
    cue: 'CUE003',
    nivel_educativo: 'Inicial',
    descripcion: 'Jardín de infantes de referencia for testing'
  }
];

/**
 * Obtiene un usuario mock por su rol
 * @param {string} role - El rol del usuario (admin, directivo, operador, etc.)
 * @returns {Object|null} El usuario mock o null si no se encuentra
 */
function getMockUser(role) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return TEST_USERS.find(user => user.role.toLowerCase() === normalizedRole) || null;
}

/**
 * Obtiene un usuario mock por su ID
 * @param {number} id - El ID del usuario
 * @returns {Object|null} El usuario mock o null si no se encuentra
 */
function getMockUserById(id) {
  return TEST_USERS.find(user => user.id === id) || null;
}

/**
 * Obtiene un usuario mock por su email
 * @param {string} email - El email del usuario
 * @returns {Object|null} El usuario mock o null si no se encuentra
 */
function getMockUserByEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return TEST_USERS.find(user => user.email.toLowerCase() === normalizedEmail) || null;
}

/**
 * Genera un token JWT mock para testing (no válido para producción)
 * @param {Object} user - El usuario mock
 * @returns {string} Token JWT simulado
 */
function getMockToken(user) {
  if (!user) return null;
  
  // Token base64 simple para testing (NO es un JWT válido criptográficamente)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    email: user.email,
    role: user.role,
    permisos: user.permisos,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 horas
  })).toString('base64');
  const signature = Buffer.from('mock-signature').toString('base64');
  
  return `${header}.${payload}.${signature}`;
}

/**
 * Obtiene todos los usuarios de un rol específico
 * @param {string} role - El rol a filtrar
 * @returns {Array} Lista de usuarios mock con ese rol
 */
function getMockUsersByRole(role) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return TEST_USERS.filter(user => user.role.toLowerCase() === normalizedRole);
}

/**
 * Obtiene todos los usuarios activos
 * @returns {Array} Lista de usuarios mock activos
 */
function getMockActiveUsers() {
  return TEST_USERS.filter(user => user.activo === true);
}

/**
 * Obtiene la matriz de permisos para todos los roles
 * @returns {Object} Matriz de permisos por rol
 */
function getMockPermissionsMatrix() {
  const matrix = {};
  TEST_USERS.forEach(user => {
    if (!matrix[user.role]) {
      matrix[user.role] = {
        permisos: user.permisos,
        descripcion: user.descripcion,
        usuarios: []
      };
    }
    matrix[user.role].usuarios.push({
      id: user.id,
      nombre: `${user.nombre} ${user.apellido}`,
      email: user.email
    });
  });
  return matrix;
}

/**
 * Valida credenciales de prueba (solo para testing)
 * @param {string} email - Email del usuario
 * @param {string} password - Contraseña en texto plano
 * @returns {Object|null} Usuario si las credenciales son válidas, null en caso contrario
 */
function validateMockCredentials(email, password) {
  const user = getMockUserByEmail(email);
  if (user && user.password === password) {
    // Retornar usuario sin la contraseña
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  return null;
}

/**
 * Exporta todas las funciones y datos mock
 */
module.exports = {
  TEST_USERS,
  TEST_INSTITUTIONS,
  getMockUser,
  getMockUserById,
  getMockUserByEmail,
  getMockToken,
  getMockUsersByRole,
  getMockActiveUsers,
  getMockPermissionsMatrix,
  validateMockCredentials,
  // Exportar también los permisos para referencia
  PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS
};