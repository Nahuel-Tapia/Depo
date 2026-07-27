const { test, expect } = require('@playwright/test');
const { API_URL } = require('../../helpers/constants');
const { loginAs } = require('../../helpers/auth.helper');
const { authGet } = require('../../helpers/api.helper');

test.describe('API Supervisor Tests', () => {
  let supervisorToken;

  test.beforeAll(async ({ request }) => {
    try {
      const auth = await loginAs(request, 'supervisor');
      supervisorToken = auth.token;
    } catch (error) {
      console.warn('No se pudo autenticar como supervisor:', error.message);
      supervisorToken = null;
    }
  });

  test.beforeEach(() => {
    if (!supervisorToken) {
      test.skip(true, 'Login como supervisor falló o no está disponible');
    }
  });

  test('Listar instituciones del supervisor', async ({ request }) => {
    const response = await authGet(request, supervisorToken, '/supervisor/instituciones');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('Obtener estadísticas del dashboard del supervisor', async ({ request }) => {
    const response = await authGet(request, supervisorToken, '/supervisor/dashboard/stats');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('Listar pedidos pendientes del supervisor', async ({ request }) => {
    const response = await authGet(request, supervisorToken, '/supervisor/pedidos-pendientes');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('Listar solicitudes del supervisor', async ({ request }) => {
    const response = await authGet(request, supervisorToken, '/supervisor/solicitudes');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
  });
});
