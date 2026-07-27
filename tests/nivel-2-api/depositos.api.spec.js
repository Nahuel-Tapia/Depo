const { test, expect } = require('@playwright/test');
const { getToken } = require('../helpers/auth.helper');
const { authGet, authPost } = require('../helpers/api.helper');

test.describe.serial('API Depósitos Tests', () => {
  let adminToken;
  let testDepositoId;
  let productId;

  test.beforeAll(async ({ request }) => {
    adminToken = await getToken(request, 'admin');

    const response = await authGet(request, adminToken, '/depositos');
    expect(response.status()).toBe(200);

    const body = await response.json();
    const depositos = Array.isArray(body) ? body : (body.depositos || []);
    expect(depositos.length).toBeGreaterThan(0);
    testDepositoId = depositos[0].id || depositos[0].id_deposito;
    expect(testDepositoId).toBeDefined();

    const prodResponse = await authGet(request, adminToken, '/productos');
    if (prodResponse.status() === 200) {
      const prodBody = await prodResponse.json();
      const productos = Array.isArray(prodBody) ? prodBody : (prodBody.productos || []);
      if (productos.length > 0) {
        productId = productos[0].id || productos[0].id_producto;
      }
    }
  });

  test('Listar depósitos', async ({ request }) => {
    const response = await authGet(request, adminToken, '/depositos');
    expect(response.status()).toBe(200);

    const body = await response.json();
    const depositos = Array.isArray(body) ? body : (body.depositos || []);
    expect(Array.isArray(depositos)).toBe(true);
  });

  test('Productos por depósito', async ({ request }) => {
    expect(testDepositoId).toBeDefined();

    const response = await authGet(request, adminToken, `/depositos/${testDepositoId}/productos`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    const productos = Array.isArray(body) ? body : (body.productos || []);
    expect(Array.isArray(productos)).toBe(true);
  });

  test('Stock por producto global', async ({ request }) => {
    const response = await authGet(request, adminToken, '/depositos/stock-por-producto');
    expect(response.status()).toBe(200);

    const body = await response.json();
    const productos = Array.isArray(body) ? body : (body.productos || []);
    expect(Array.isArray(productos)).toBe(true);
  });

  test('Stock de un depósito', async ({ request }) => {
    expect(testDepositoId).toBeDefined();

    const response = await authGet(request, adminToken, `/depositos/${testDepositoId}/stock`);
    expect(response.status()).toBe(200);
  });

  test('Ingreso a depósito', async ({ request }) => {
    expect(testDepositoId).toBeDefined();

    if (!productId) {
      const prodResponse = await authGet(request, adminToken, '/productos');
      const prodBody = await prodResponse.json();
      const productos = Array.isArray(prodBody) ? prodBody : (prodBody.productos || []);
      productId = productos[0]?.id || productos[0]?.id_producto;
    }
    expect(productId).toBeDefined();

    const payload = {
      producto_id: productId,
      id_producto: productId,
      cantidad: 5,
      motivo: 'Test ingreso depósito'
    };

    const response = await authPost(request, adminToken, `/depositos/${testDepositoId}/ingreso`, payload);
    expect(response.status()).toBe(200);
  });

  test('Vencimientos próximos', async ({ request }) => {
    const response = await authGet(request, adminToken, '/depositos/vencimientos-proximos');
    expect(response.status()).toBe(200);
  });

  test('Recepciones de licitación', async ({ request }) => {
    const response = await authGet(request, adminToken, '/depositos/licitacion/recepciones');
    expect(response.status()).toBe(200);
  });

  test('Distribución pendientes', async ({ request }) => {
    const response = await authGet(request, adminToken, '/depositos/distribucion/pendientes');
    expect(response.status()).toBe(200);
  });

  test('Mover stock entre depósitos', async ({ request }) => {
    const listRes = await authGet(request, adminToken, '/depositos');
    expect(listRes.status()).toBe(200);
    const listBody = await listRes.json();
    const depositos = Array.isArray(listBody) ? listBody : (listBody.depositos || []);

    test.skip(depositos.length < 2, 'Se requieren al menos 2 depósitos para realizar el movimiento');

    if (!productId) {
      const prodResponse = await authGet(request, adminToken, '/productos');
      const prodBody = await prodResponse.json();
      const productos = Array.isArray(prodBody) ? prodBody : (prodBody.productos || []);
      productId = productos[0]?.id || productos[0]?.id_producto;
    }

    const dep1 = depositos[0].id || depositos[0].id_deposito;
    const dep2 = depositos[1].id || depositos[1].id_deposito;

    const payload = {
      producto_id: productId,
      id_producto: productId,
      origen_id: dep1,
      destino_id: dep2,
      cantidad: 1,
      motivo: 'test traslado'
    };

    const response = await authPost(request, adminToken, '/depositos/mover', payload);
    expect(response.status()).toBe(200);
  });

  test('Egreso sin stock suficiente', async ({ request }) => {
    expect(testDepositoId).toBeDefined();

    if (!productId) {
      const prodResponse = await authGet(request, adminToken, '/productos');
      const prodBody = await prodResponse.json();
      const productos = Array.isArray(prodBody) ? prodBody : (prodBody.productos || []);
      productId = productos[0]?.id || productos[0]?.id_producto;
    }

    const payload = {
      producto_id: productId,
      id_producto: productId,
      cantidad: 999999,
      motivo: 'test'
    };

    const response = await authPost(request, adminToken, `/depositos/${testDepositoId}/egreso`, payload);
    expect(response.status()).toBe(400);
  });
});
