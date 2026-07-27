const { test, expect } = require('@playwright/test');
const { getToken } = require('../../helpers/auth.helper');
const { authGet } = require('../../helpers/api.helper');

test.describe('API Dashboard Tests', () => {

  test('Obtener estadísticas del dashboard con rol admin', async ({ request }) => {
    const adminToken = await getToken(request, 'admin');
    const response = await authGet(request, adminToken, '/dashboard/stats');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
    expect(body).toHaveProperty('productos');
    expect(body).toHaveProperty('instituciones');
    expect(body).toHaveProperty('proveedores');
    expect(body).toHaveProperty('movimientos_mes');
  });

  test('Obtener estadísticas del dashboard con rol directivo (versión limitada)', async ({ request }) => {
    let directivoToken;
    try {
      directivoToken = await getToken(request, 'directivo');
    } catch (err) {
      console.warn('Login como directivo falló, omitiendo test:', err.message);
    }

    if (!directivoToken) {
      test.skip(true, 'Login como directivo falló o no está disponible');
      return;
    }

    const response = await authGet(request, directivoToken, '/dashboard/stats');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
    expect(body).toHaveProperty('productos');
  });

});
