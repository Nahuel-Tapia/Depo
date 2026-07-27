const { test, expect } = require('@playwright/test');
const { loginAs, getToken } = require('../helpers/auth.helper');
const { authGet, authPost, authPatch, authPut, authDelete } = require('../helpers/api.helper');

test.describe.serial('API Pedidos Tests', () => {
  let adminToken;
  let directivoToken;
  let directivoUser;
  let testKitId;
  let testPedidoId;

  test.beforeAll(async ({ request }) => {
    adminToken = await getToken(request, 'admin');

    try {
      const result = await loginAs(request, 'directivo');
      directivoToken = result.token;
      directivoUser = result.user;
    } catch (err) {
      console.warn('No se pudo autenticar como directivo:', err.message);
      directivoToken = null;
      directivoUser = null;
    }
  });

  // ----------------------------------------------------
  // Kits section
  // ----------------------------------------------------

  test('Listar kits', async ({ request }) => {
    const response = await authGet(request, adminToken, '/pedidos/kits');
    expect(response.status()).toBe(200);

    const body = await response.json();
    const kits = Array.isArray(body) ? body : (body.kits || []);
    expect(Array.isArray(kits)).toBe(true);
  });

  test('Crear kit', async ({ request }) => {
    // Obtener un producto existente para asociar al kit
    const prodRes = await authGet(request, adminToken, '/productos');
    expect(prodRes.status()).toBe(200);
    const prodBody = await prodRes.json();
    const productos = Array.isArray(prodBody) ? prodBody : (prodBody.productos || []);
    expect(productos.length).toBeGreaterThan(0);
    const firstProduct = productos[0];
    const productId = firstProduct.id || firstProduct.id_producto;

    const payload = {
      nombre: 'Kit Test ' + Date.now(),
      descripcion: 'Kit para testing',
      cantidad_alumnos: 30,
      items: [
        { producto_id: productId, cantidad: 5 }
      ]
    };

    const response = await authPost(request, adminToken, '/pedidos/kits', payload);
    expect([200, 201]).toContain(response.status());

    const body = await response.json();
    const kitObj = body.kit || body;
    testKitId = kitObj.id || kitObj.id_kit || (body.kit && (body.kit.id || body.kit.id_kit));
    expect(testKitId).toBeTruthy();
  });

  test('Actualizar kit', async ({ request }) => {
    if (!testKitId) {
      test.skip(true, 'No se creó kit de prueba');
      return;
    }

    const prodRes = await authGet(request, adminToken, '/productos');
    expect(prodRes.status()).toBe(200);
    const prodBody = await prodRes.json();
    const productos = Array.isArray(prodBody) ? prodBody : (prodBody.productos || []);
    expect(productos.length).toBeGreaterThan(0);
    const firstProduct = productos[0];
    const productId = firstProduct.id || firstProduct.id_producto;

    const payload = {
      nombre: 'Kit Updated',
      descripcion: 'Kit para testing actualizado',
      items: [
        { producto_id: productId, cantidad: 8 }
      ]
    };

    const response = await authPut(request, adminToken, `/pedidos/kits/${testKitId}`, payload);
    expect(response.status()).toBe(200);
  });

  test('Eliminar kit', async ({ request }) => {
    if (!testKitId) {
      test.skip(true, 'No se creó kit de prueba');
      return;
    }

    const response = await authDelete(request, adminToken, `/pedidos/kits/${testKitId}`);
    expect(response.status()).toBe(200);
  });

  // ----------------------------------------------------
  // Pedidos section
  // ----------------------------------------------------

  test('Listar pedidos (admin)', async ({ request }) => {
    const response = await authGet(request, adminToken, '/pedidos');
    expect(response.status()).toBe(200);

    const body = await response.json();
    const pedidos = Array.isArray(body) ? body : (body.pedidos || []);
    expect(Array.isArray(pedidos)).toBe(true);
  });

  test('Obtener cupos anuales', async ({ request }) => {
    const token = directivoToken || adminToken;
    const params = directivoToken ? {} : { institucion_id: 1 };
    const response = await authGet(request, token, '/pedidos/cupos-anuales', params);
    expect([200, 400, 404]).toContain(response.status());
  });

  test('Obtener detalle de pedido existente', async ({ request }) => {
    const listRes = await authGet(request, adminToken, '/pedidos');
    expect(listRes.status()).toBe(200);

    const body = await listRes.json();
    const pedidos = Array.isArray(body) ? body : (body.pedidos || []);

    if (!pedidos || pedidos.length === 0) {
      test.skip(true, 'No hay pedidos existentes para obtener detalle');
      return;
    }

    const firstPedido = pedidos[0];
    testPedidoId = firstPedido.id || firstPedido.id_pedido;

    const response = await authGet(request, adminToken, `/pedidos/${testPedidoId}`);
    expect(response.status()).toBe(200);

    const detailBody = await response.json();
    const pedido = detailBody.pedido || detailBody;
    expect(pedido).toBeDefined();
  });

  test('Obtener pedido inexistente', async ({ request }) => {
    const response = await authGet(request, adminToken, '/pedidos/999999');
    expect(response.status()).toBe(404);
  });

  // ----------------------------------------------------
  // Estados section
  // ----------------------------------------------------

  test('Actualizar estado de pedido pendiente', async ({ request }) => {
    const listRes = await authGet(request, adminToken, '/pedidos');
    expect(listRes.status()).toBe(200);

    const body = await listRes.json();
    const pedidos = Array.isArray(body) ? body : (body.pedidos || []);

    const pendiente = pedidos.find(p => p.estado === 'pendiente' || p.estado === 'pendiente_director');

    if (!pendiente) {
      test.skip(true, 'No se encontró ningún pedido en estado pendiente');
      return;
    }

    const targetId = pendiente.id || pendiente.id_pedido;
    const response = await authPatch(request, adminToken, `/pedidos/${targetId}/estado`, {
      estado: 'aprobado',
      motivo: 'Aprobación de test'
    });
    expect([200, 400, 403]).toContain(response.status());
  });

  test('Cancelar pedido inexistente', async ({ request }) => {
    const response = await authPatch(request, adminToken, '/pedidos/999999/cancelar');
    expect(response.status()).toBe(404);
  });

  // ----------------------------------------------------
  // Directivo section
  // ----------------------------------------------------

  test('Listar pedidos como directivo', async ({ request }) => {
    if (!directivoToken) {
      test.skip(true, 'Login de directivo no disponible');
      return;
    }

    const response = await authGet(request, directivoToken, '/pedidos');
    expect(response.status()).toBe(200);

    const body = await response.json();
    const pedidos = Array.isArray(body) ? body : (body.pedidos || []);
    expect(Array.isArray(pedidos)).toBe(true);
  });

  test('Pedidos por institución como directivo', async ({ request }) => {
    if (!directivoToken || !directivoUser || !directivoUser.id_institucion) {
      test.skip(true, 'Directivo sin token o sin id_institucion asignada');
      return;
    }

    const instId = directivoUser.id_institucion;
    const response = await authGet(request, directivoToken, `/pedidos/institucion/${instId}`);
    expect([200, 403]).toContain(response.status());
  });
});
