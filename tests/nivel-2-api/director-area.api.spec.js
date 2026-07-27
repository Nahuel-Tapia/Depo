const { test, expect } = require('@playwright/test');
const { API_URL } = require('../../helpers/constants');
const { loginAs } = require('../../helpers/auth.helper');
const { authGet } = require('../../helpers/api.helper');

test.describe('API Director de Área Tests', () => {
  let directorToken;

  test.beforeAll(async ({ request }) => {
    try {
      const auth = await loginAs(request, 'director_area');
      directorToken = auth.token;
    } catch (error) {
      console.warn('No se pudo autenticar como director_area:', error.message);
      directorToken = null;
    }
  });

  test.beforeEach(() => {
    if (!directorToken) {
      test.skip(true, 'Login como director_area falló o no está disponible');
    }
  });

  test('Obtener catálogo del director de área', async ({ request }) => {
    const response = await authGet(request, directorToken, '/director-area/catalogo');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('Obtener asignaciones del director de área', async ({ request }) => {
    const response = await authGet(request, directorToken, '/director-area/asignaciones');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('Obtener supervisores del director de área', async ({ request }) => {
    const response = await authGet(request, directorToken, '/director-area/supervisores');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('Obtener edificios del director de área', async ({ request }) => {
    const response = await authGet(request, directorToken, '/director-area/edificios');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('Obtener zonas-edificio del director de área', async ({ request }) => {
    const response = await authGet(request, directorToken, '/director-area/zonas-edificio');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('Obtener informes del director de área', async ({ request }) => {
    const response = await authGet(request, directorToken, '/director-area/informes');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('Obtener solicitudes del director de área', async ({ request }) => {
    const response = await authGet(request, directorToken, '/director-area/solicitudes');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
  });
});
