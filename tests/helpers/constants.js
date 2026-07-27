/**
 * Constantes compartidas para todos los tests de Depo Stock
 */

const BASE_URL = 'http://localhost:4000';
const API_URL = `${BASE_URL}/api`;

// Credenciales de test por rol
const TEST_USERS = {
  admin: {
    email: 'admin@depo.local',
    password: 'Admin123!',
    role: 'admin'
  },
  director_area: {
    email: 'director.primario@test.local',
    password: 'Test123!',
    role: 'director_area'
  },
  supervisor: {
    email: 'supervisor.zona1@test.local',
    password: 'Test123!',
    role: 'supervisor'
  },
  directivo: {
    email: 'directivo.escuela1@test.local',
    password: 'Test123!',
    role: 'directivo'
  },
  area_compras: {
    email: 'compras@test.local',
    password: 'Test123!',
    role: 'area_compras'
  },
  operador: {
    email: 'operador@test.local',
    password: 'Test123!',
    role: 'operador'
  },
  operador_escolar: {
    email: 'opescolar@test.local',
    password: 'Test123!',
    role: 'operador_escolar'
  },
  control_ministerio: {
    email: 'control@test.local',
    password: 'Test123!',
    role: 'control_ministerio'
  },
  consulta: {
    email: 'consulta@test.local',
    password: 'Test123!',
    role: 'consulta'
  }
};

// Roles que el sistema reconoce
const ALL_ROLES = [
  'admin', 'master', 'director_area', 'supervisor', 'directivo',
  'area_compras', 'operador', 'operador_escolar', 'control_ministerio', 'consulta'
];

// Tipos de movimiento válidos
const MOVEMENT_TYPES = ['ingreso', 'egreso', 'ajuste', 'devolucion'];

// Estados de pedido
const ORDER_STATES = [
  'pendiente', 'pendiente_director', 'aprobado', 'rechazado',
  'adjudicada', 'en_deposito', 'entregado', 'cancelado'
];

module.exports = {
  BASE_URL,
  API_URL,
  TEST_USERS,
  ALL_ROLES,
  MOVEMENT_TYPES,
  ORDER_STATES
};
