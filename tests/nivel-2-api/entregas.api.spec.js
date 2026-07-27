const { test, expect } = require('@playwright/test');
const { API_URL } = require('../helpers/constants');
const { getToken } = require('../helpers/auth.helper');
const { authGet, authPost } = require('../helpers/api.helper');

test.describe('API Entregas Tests', () => {
  let adminToken;
  let operadorToken;
  let directivoToken;

  test.beforeAll(async ({ request }) => {
    adminToken = await getToken(request, 'admin');

    try {
      operadorToken = await getToken(request, 'operador');
    } catch (err) {
      console.warn('Login como operador falló:', err.message);
    }

    try {
      directivoToken = await getToken(request, 'directivo');
    } catch (err) {
      console.warn('Login como directivo falló:', err.message);
    }
  });

  test('Listar pedidos disponibles para retiro', async ({ request }) => {
    const token = operadorToken || adminToken;
    const response = await authGet(request, token, '/entregas/pedidos-disponibles');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('Listar solicitudes pendientes', async ({ request }) => {
    const token = operadorToken || adminToken;
    const response = await authGet(request, token, '/entregas/solicitudes/pendientes');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('Obtener historial de entregas de un pedido', async ({ request }) => {
    const token = operadorToken || adminToken;
    const response = await authGet(request, token, '/entregas/historial/1');
    expect([200, 404]).toContain(response.status());
  });

  test.describe('Envío por departamento', () => {
    test('Listar departamentos con solicitudes de envío', async ({ request }) => {
      const token = operadorToken || adminToken;
      const response = await authGet(request, token, '/entregas/solicitudes-envio/departamentos');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toBeDefined();
    });

    test('Obtener detalle de solicitudes de envío para el departamento CAPITAL', async ({ request }) => {
      const token = operadorToken || adminToken;
      const response = await authGet(request, token, '/entregas/solicitudes-envio/departamentos/CAPITAL/detalle', { anio: 2026 });
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toBeDefined();
    });

    test('Registrar egreso múltiple con solicitud inexistente retorna error 400', async ({ request }) => {
      const token = operadorToken || adminToken;
      const payload = {
        departamento: 'CAPITAL',
        anio: 2026,
        id_deposito: 1,
        observaciones: 'test',
        entregas: [
          {
            id_solicitud: 999999,
            items: [{ id_producto: 1, cantidad: 1 }]
          }
        ]
      };

      const response = await authPost(request, token, '/entregas/solicitudes-envio/egreso-multiple', payload);
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Solicitudes de directivo', () => {
    test('Obtener solicitudes propias del directivo', async ({ request }) => {
      if (!directivoToken) {
        test.skip(true, 'Token de directivo no disponible');
        return;
      }
      const response = await authGet(request, directivoToken, '/entregas/solicitudes/mis');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toBeDefined();
    });

    test('Obtener productos disponibles para retiro (rol directivo)', async ({ request }) => {
      if (!directivoToken) {
        test.skip(true, 'Token de directivo no disponible');
        return;
      }
      const response = await authGet(request, directivoToken, '/entregas/solicitudes/productos-disponibles');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toBeDefined();
    });
  });
});
