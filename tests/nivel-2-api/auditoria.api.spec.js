const { test, expect } = require('@playwright/test');
const { API_URL } = require('../../helpers/constants');
const { getToken } = require('../../helpers/auth.helper');
const { authGet } = require('../../helpers/api.helper');

test.describe('API Auditoría Tests', () => {
  let adminToken;

  test.beforeAll(async ({ request }) => {
    adminToken = await getToken(request, 'admin');
  });

  test('Listar registros de auditoría', async ({ request }) => {
    const response = await authGet(request, adminToken, '/auditoria');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('Filtrar auditoría por entidad', async ({ request }) => {
    const response = await authGet(request, adminToken, '/auditoria', { entidad: 'producto' });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('Obtener resumen de auditoría con filtro de fechas', async ({ request }) => {
    const response = await authGet(request, adminToken, '/auditoria/stats/resumen', {
      fecha_desde: '2026-01-01',
      fecha_hasta: '2026-12-31'
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('Obtener auditoría por usuario admin', async ({ request }) => {
    const response = await authGet(request, adminToken, '/auditoria/usuario/10');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
  });
});
