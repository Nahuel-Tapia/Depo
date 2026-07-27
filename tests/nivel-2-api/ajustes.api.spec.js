const { test, expect } = require('@playwright/test');
const { getToken } = require('../../helpers/auth.helper');
const { authGet, authPost } = require('../../helpers/api.helper');

test.describe.serial('API Ajustes Tests', () => {
  let adminToken;
  let testProductId;
  let createdId;

  test.beforeAll(async ({ request }) => {
    adminToken = await getToken(request, 'admin');
    const response = await authGet(request, adminToken, '/productos');
    expect(response.status()).toBe(200);

    const body = await response.json();
    const productos = Array.isArray(body) ? body : (body.productos || []);
    expect(productos.length).toBeGreaterThan(0);

    testProductId = productos[0].id || productos[0].id_producto;
    expect(testProductId).toBeDefined();
  });

  test('Listar ajustes', async ({ request }) => {
    const response = await authGet(request, adminToken, '/ajustes');
    expect(response.status()).toBe(200);

    const body = await response.json();
    const ajustes = Array.isArray(body) ? body : (body.ajustes || []);
    expect(Array.isArray(ajustes)).toBe(true);
  });

  test('Crear ajuste válido', async ({ request }) => {
    const payload = {
      producto_id: testProductId,
      cantidad_nueva: 48,
      motivo: 'Corrección por inventario físico test'
    };

    const response = await authPost(request, adminToken, '/ajustes', payload);
    expect([200, 201]).toContain(response.status());

    const body = await response.json();
    createdId = body.id || body.id_ajuste || (body.ajuste && (body.ajuste.id || body.ajuste.id_ajuste));
    expect(createdId).toBeTruthy();
  });

  test('Obtener ajuste por ID', async ({ request }) => {
    expect(createdId).toBeDefined();

    const response = await authGet(request, adminToken, `/ajustes/${createdId}`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    const ajuste = body.ajuste || body;
    expect(ajuste).toBeDefined();
  });

  test('Crear ajuste sin motivo', async ({ request }) => {
    const response = await authPost(request, adminToken, '/ajustes', {
      producto_id: testProductId,
      cantidad_nueva: 10
    });
    expect(response.status()).toBe(400);
  });

  test('Crear ajuste con producto inexistente', async ({ request }) => {
    const response = await authPost(request, adminToken, '/ajustes', {
      producto_id: 999999,
      cantidad_nueva: 10,
      motivo: 'test'
    });
    expect([400, 404]).toContain(response.status());
  });
});
