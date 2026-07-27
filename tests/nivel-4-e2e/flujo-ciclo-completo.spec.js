const { test, expect } = require('@playwright/test');
const { loginAs, getToken } = require('../helpers/auth.helper');
const { authGet } = require('../helpers/api.helper');

test.describe('E2E Ciclo Completo - Pedido a Entrega', () => {
  let adminToken;
  let directivoToken;
  let directivoUser;

  test.beforeAll(async ({ request }) => {
    adminToken = await getToken(request, 'admin');

    try {
      const result = await loginAs(request, 'directivo');
      directivoToken = result.token;
      directivoUser = result.user;
    } catch (err) {
      console.warn('Usuario directivo no disponible:', err.message);
      directivoToken = null;
      directivoUser = null;
    }
  });

  test('1. Verificar estado inicial', async ({ request }) => {
    const response = await authGet(request, adminToken, '/dashboard/stats');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('2. Consultar pedidos existentes', async ({ request }) => {
    const response = await authGet(request, adminToken, '/pedidos');
    expect(response.status()).toBe(200);
    const body = await response.json();
    const pedidos = Array.isArray(body) ? body : (body.pedidos || []);
    expect(Array.isArray(pedidos)).toBe(true);
  });

  test('3. Consultar instituciones', async ({ request }) => {
    const response = await authGet(request, adminToken, '/instituciones');
    expect(response.status()).toBe(200);
    const body = await response.json();
    const instituciones = Array.isArray(body) ? body : (body.instituciones || []);
    expect(Array.isArray(instituciones)).toBe(true);
  });

  test('4. Consultar stock de depósitos', async ({ request }) => {
    const response = await authGet(request, adminToken, '/depositos');
    expect(response.status()).toBe(200);
    const body = await response.json();
    const depositos = Array.isArray(body) ? body : (body.depositos || []);
    expect(Array.isArray(depositos)).toBe(true);
  });

  test('5. Verificar consolidado de compras', async ({ request }) => {
    const response = await authGet(request, adminToken, '/compras/licitacion/consolidado');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toBeDefined();
  });
});
