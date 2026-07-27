const { test, expect } = require('@playwright/test');
const { getToken } = require('../helpers/auth.helper');
const { authGet, authPost } = require('../helpers/api.helper');

test.describe.serial('API Movimientos Tests', () => {
  let adminToken;
  let createdMovId;
  let testProductId;

  test.beforeAll(async ({ request }) => {
    adminToken = await getToken(request, 'admin');

    const response = await authGet(request, adminToken, '/productos');
    expect(response.status()).toBe(200);

    const body = await response.json();
    const productos = Array.isArray(body) ? body : (body.productos || []);
    expect(productos.length).toBeGreaterThan(0);

    const firstProduct = productos[0];
    testProductId = firstProduct.id || firstProduct.id_producto;
    expect(testProductId).toBeTruthy();
  });

  test('Listar movimientos', async ({ request }) => {
    const response = await authGet(request, adminToken, '/movimientos');
    expect(response.status()).toBe(200);

    const body = await response.json();
    const movimientos = body.movimientos || body;
    expect(Array.isArray(movimientos)).toBe(true);
  });

  test('Filtrar por tipo', async ({ request }) => {
    const response = await authGet(request, adminToken, '/movimientos', { tipo: 'ingreso' });
    expect(response.status()).toBe(200);

    const body = await response.json();
    const movimientos = body.movimientos || body;
    expect(Array.isArray(movimientos)).toBe(true);
  });

  test('Filtrar por producto_id', async ({ request }) => {
    const response = await authGet(request, adminToken, '/movimientos', { producto_id: testProductId });
    expect(response.status()).toBe(200);

    const body = await response.json();
    const movimientos = body.movimientos || body;
    expect(Array.isArray(movimientos)).toBe(true);
  });

  test('Paginación', async ({ request }) => {
    const response = await authGet(request, adminToken, '/movimientos', { limit: 2, offset: 0 });
    expect(response.status()).toBe(200);

    const body = await response.json();
    const movimientos = body.movimientos || body;
    expect(Array.isArray(movimientos)).toBe(true);
    expect(movimientos.length).toBeLessThanOrEqual(2);
  });

  test('Crear ingreso', async ({ request }) => {
    const response = await authPost(request, adminToken, '/movimientos', {
      producto_id: testProductId,
      tipo: 'ingreso',
      cantidad: 5,
      motivo: 'Test ingreso automatizado'
    });
    expect([200, 201]).toContain(response.status());

    const body = await response.json();
    createdMovId = body.id || body.id_movimiento || (body.movimiento && (body.movimiento.id || body.movimiento.id_movimiento));
    expect(createdMovId).toBeTruthy();
  });

  test('Obtener detalle del movimiento creado', async ({ request }) => {
    expect(createdMovId).toBeDefined();

    const response = await authGet(request, adminToken, `/movimientos/${createdMovId}`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    const movimiento = body.movimiento || body;
    expect(movimiento).toHaveProperty('tipo', 'ingreso');
  });

  test('Tipo inválido "entrada" retorna error', async ({ request }) => {
    const response = await authPost(request, adminToken, '/movimientos', {
      producto_id: testProductId,
      tipo: 'entrada',
      cantidad: 1,
      motivo: 'invalid'
    });
    expect(response.status()).toBe(400);
  });

  test('Cantidad negativa retorna error', async ({ request }) => {
    const response = await authPost(request, adminToken, '/movimientos', {
      producto_id: testProductId,
      tipo: 'ingreso',
      cantidad: -5,
      motivo: 'negative'
    });
    expect(response.status()).toBe(400);
  });

  test('Movimiento sin producto_id retorna error', async ({ request }) => {
    const response = await authPost(request, adminToken, '/movimientos', {
      tipo: 'ingreso',
      cantidad: 1,
      motivo: 'no product'
    });
    expect(response.status()).toBe(400);
  });

  test('Movimiento en lote', async ({ request }) => {
    const response = await authPost(request, adminToken, '/movimientos/lote', {
      tipo: 'ingreso',
      motivo: 'lote test',
      movimientos: [{ producto_id: parseInt(testProductId, 10), cantidad: 2 }]
    });
    expect([200, 201]).toContain(response.status());
  });

  test('Resumen estadístico', async ({ request }) => {
    const response = await authGet(request, adminToken, '/movimientos/stats/resumen');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.stats).toBeDefined();
    expect(body.stats).toHaveProperty('total_ingresos');
  });

  test('Movimiento directo transaccional', async ({ request }) => {
    const response = await authPost(request, adminToken, '/movimientos/directo', {
      tipo: 'ingreso',
      motivo: 'directo test',
      id_deposito: 1,
      productos: [{ producto_id: parseInt(testProductId, 10), cantidad: 3, estado: 'bueno' }]
    });
    expect([200, 201]).toContain(response.status());
  });
});
