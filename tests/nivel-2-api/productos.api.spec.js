const { test, expect } = require('@playwright/test');
const { getToken } = require('../helpers/auth.helper');
const { authGet, authPost, authPatch, authDelete } = require('../helpers/api.helper');

test.describe.serial('API Productos Tests', () => {
  let adminToken;
  let createdProductId;

  test.beforeAll(async ({ request }) => {
    adminToken = await getToken(request, 'admin');
  });

  test('Listar productos', async ({ request }) => {
    const response = await authGet(request, adminToken, '/productos');
    expect(response.status()).toBe(200);

    const body = await response.json();
    const productos = Array.isArray(body) ? body : body.productos;
    expect(Array.isArray(productos)).toBe(true);
  });

  test('Listar categorías', async ({ request }) => {
    const response = await authGet(request, adminToken, '/productos/categorias');
    expect(response.status()).toBe(200);

    const body = await response.json();
    const categorias = Array.isArray(body) ? body : body.categorias;
    expect(Array.isArray(categorias)).toBe(true);
  });

  test('Crear producto válido', async ({ request }) => {
    const payload = {
      nombre: 'TestProduct_' + Date.now(),
      unidad_medida: 'unidad',
      stock_actual: 10,
      stock_minimo: 2,
      id_categoria: 1
    };

    const response = await authPost(request, adminToken, '/productos', payload);
    expect([200, 201]).toContain(response.status());

    const body = await response.json();
    createdProductId = body.id || body.id_producto || (body.producto && (body.producto.id || body.producto.id_producto));
    expect(createdProductId).toBeTruthy();
  });

  test('Obtener producto creado', async ({ request }) => {
    expect(createdProductId).toBeDefined();

    const response = await authGet(request, adminToken, `/productos/${createdProductId}`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    const producto = body.producto || body;
    expect(producto).toHaveProperty('nombre');
    expect(producto.nombre).toContain('TestProduct_');
  });

  test('Obtener stock-detalle', async ({ request }) => {
    expect(createdProductId).toBeDefined();

    const response = await authGet(request, adminToken, `/productos/${createdProductId}/stock-detalle`);
    expect(response.status()).toBe(200);
  });

  test('Actualizar producto', async ({ request }) => {
    expect(createdProductId).toBeDefined();

    const updatedNombre = 'Updated_' + Date.now();
    const response = await authPatch(request, adminToken, `/productos/${createdProductId}`, {
      nombre: updatedNombre
    });
    expect(response.status()).toBe(200);
  });

  test('Crear producto sin nombre (error)', async ({ request }) => {
    const response = await authPost(request, adminToken, '/productos', {
      unidad_medida: 'kg'
    });
    expect(response.status()).toBe(400);
  });

  test('Crear producto sin datos (error)', async ({ request }) => {
    const response = await authPost(request, adminToken, '/productos', {});
    expect(response.status()).toBe(400);
  });

  test('Obtener producto inexistente', async ({ request }) => {
    const response = await authGet(request, adminToken, '/productos/999999');
    expect(response.status()).toBe(404);
  });

  test('Eliminar producto creado', async ({ request }) => {
    expect(createdProductId).toBeDefined();

    const response = await authDelete(request, adminToken, `/productos/${createdProductId}`);
    expect(response.status()).toBe(200);
  });
});
