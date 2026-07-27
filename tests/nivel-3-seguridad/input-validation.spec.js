const { test, expect } = require('@playwright/test');
const { API_URL } = require('../../helpers/constants');
const { getToken } = require('../../helpers/auth.helper');
const { authGet, authPost, publicPost } = require('../../helpers/api.helper');

test.describe('Input Validation & Security Tests', () => {
  let adminToken;

  test.beforeAll(async ({ request }) => {
    adminToken = await getToken(request, 'admin');
  });

  test('SQL injection en login email devuelve 401 y no 500', async ({ request }) => {
    const response = await publicPost(request, '/auth/login', {
      email: "admin' OR '1'='1",
      password: 'test'
    });
    expect(response.status()).toBe(401);
    expect(response.status()).not.toBe(500);
  });

  test('SQL injection en login password devuelve 401 y no 500', async ({ request }) => {
    const response = await publicPost(request, '/auth/login', {
      email: 'admin@depo.local',
      password: "' OR '1'='1"
    });
    expect(response.status()).toBe(401);
    expect(response.status()).not.toBe(500);
  });

  test('XSS en nombre de producto no devuelve 500', async ({ request }) => {
    const response = await authPost(request, adminToken, '/productos', {
      nombre: '<script>alert(1)</script>_' + Date.now(),
      unidad_medida: 'unidad',
      stock_actual: 1,
      stock_minimo: 0,
      id_categoria: 1
    });
    expect(response.status()).not.toBe(500);
  });

  test('Cantidad negativa en movimiento devuelve 400', async ({ request }) => {
    const response = await authPost(request, adminToken, '/movimientos', {
      producto_id: 1,
      tipo: 'ingreso',
      cantidad: -10,
      motivo: 'negative test'
    });
    expect(response.status()).toBe(400);
    expect(response.status()).not.toBe(500);
  });

  test('Cantidad cero en movimiento devuelve 400', async ({ request }) => {
    const response = await authPost(request, adminToken, '/movimientos', {
      producto_id: 1,
      tipo: 'ingreso',
      cantidad: 0,
      motivo: 'zero test'
    });
    expect(response.status()).toBe(400);
    expect(response.status()).not.toBe(500);
  });

  test('Body vacío en POST productos devuelve 400', async ({ request }) => {
    const response = await authPost(request, adminToken, '/productos', {});
    expect(response.status()).toBe(400);
    expect(response.status()).not.toBe(500);
  });

  test('ID no numérico en path de productos devuelve 400 o 404 y no 500', async ({ request }) => {
    const response = await authGet(request, adminToken, '/productos/abc');
    expect([400, 404]).toContain(response.status());
    expect(response.status()).not.toBe(500);
  });

  test('Payload extremadamente grande en POST productos devuelve 400 o 413 y no 500', async ({ request }) => {
    const response = await authPost(request, adminToken, '/productos', {
      nombre: 'x'.repeat(10000),
      unidad_medida: 'unidad'
    });
    expect([400, 413]).toContain(response.status());
    expect(response.status()).not.toBe(500);
  });
});
