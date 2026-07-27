const { test, expect } = require('@playwright/test');

let getToken;
let authGet, authPost;

try {
  ({ getToken } = require('../helpers/auth.helper'));
  ({ authGet, authPost } = require('../helpers/api.helper'));
} catch (e) {
  ({ getToken } = require('../../helpers/auth.helper'));
  ({ authGet, authPost } = require('../../helpers/api.helper'));
}

const tokens = {};
const roles = [
  'admin',
  'director_area',
  'supervisor',
  'directivo',
  'area_compras',
  'operador',
  'consulta'
];

const ACCESS_RULES = [
  {
    path: '/users',
    method: 'GET',
    allowed: ['admin', 'director_area'],
    denied: ['supervisor', 'directivo', 'area_compras', 'consulta']
  },
  {
    path: '/productos',
    method: 'GET',
    allowed: ['admin', 'operador', 'area_compras', 'consulta', 'directivo', 'director_area'],
    denied: []
  },
  {
    path: '/movimientos',
    method: 'POST',
    allowed: ['admin', 'operador'],
    denied: ['directivo', 'consulta', 'area_compras']
  },
  {
    path: '/auditoria',
    method: 'GET',
    allowed: ['admin', 'consulta', 'operador'],
    denied: ['directivo']
  },
  {
    path: '/supervisor/instituciones',
    method: 'GET',
    allowed: ['supervisor'],
    denied: ['directivo', 'area_compras', 'consulta']
  },
  {
    path: '/director-area/catalogo',
    method: 'GET',
    allowed: ['director_area'],
    denied: ['directivo', 'area_compras', 'consulta', 'supervisor']
  },
  {
    path: '/compras/planillas',
    method: 'GET',
    allowed: ['admin', 'area_compras', 'director_area'],
    denied: ['directivo', 'consulta']
  }
];

test.describe('RBAC Matrix Tests', () => {
  test.beforeAll(async ({ request }) => {
    for (const role of roles) {
      try {
        tokens[role] = await getToken(request, role);
      } catch (e) {
        tokens[role] = null;
      }
    }
  });

  for (const rule of ACCESS_RULES) {
    test.describe(`Endpoint: ${rule.method} ${rule.path}`, () => {
      for (const role of rule.allowed) {
        test(`Rol ${role} tiene acceso`, async ({ request }) => {
          test.skip(tokens[role] === null, `Rol ${role} no disponible`);

          const token = tokens[role];
          let response;
          if (rule.method === 'GET') {
            response = await authGet(request, token, rule.path);
          } else if (rule.method === 'POST') {
            response = await authPost(request, token, rule.path, {});
          } else {
            response = await authGet(request, token, rule.path);
          }

          expect(response.status()).not.toBe(403);
        });
      }

      for (const role of rule.denied) {
        test(`Rol ${role} NO tiene acceso (403)`, async ({ request }) => {
          test.skip(tokens[role] === null, `Rol ${role} no disponible`);

          const token = tokens[role];
          let response;
          if (rule.method === 'GET') {
            response = await authGet(request, token, rule.path);
          } else if (rule.method === 'POST') {
            response = await authPost(request, token, rule.path, {});
          } else {
            response = await authGet(request, token, rule.path);
          }

          expect(response.status()).toBe(403);
        });
      }
    });
  }
});
