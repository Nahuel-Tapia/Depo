const { test, expect } = require('@playwright/test');
const { API_URL } = require('../../helpers/constants');
const { getToken } = require('../../helpers/auth.helper');
const { authGet, authPost, authPatch, authDelete } = require('../../helpers/api.helper');

test.describe.serial('API Proveedores Tests', () => {
  let adminToken;
  let createdProvId;

  test.beforeAll(async ({ request }) => {
    adminToken = await getToken(request, 'admin');
  });

  test('Listar proveedores', async ({ request }) => {
    const response = await authGet(request, adminToken, '/proveedores');
    expect(response.status()).toBe(200);

    const body = await response.json();
    const proveedores = Array.isArray(body) ? body : body.proveedores;
    expect(Array.isArray(proveedores)).toBe(true);
  });

  test('Crear proveedor nuevo', async ({ request }) => {
    const timestamp = Date.now();
    const cuit = '20-' + Math.floor(Math.random() * 90000000 + 10000000) + '-9';
    const payload = {
      nombre: 'Proveedor Test ' + timestamp,
      cuit,
      razon_social: 'Proveedor Test ' + timestamp,
      contacto_nombre: 'Juan Test',
      telefono: '2640000000',
      email: 'prov_' + timestamp + '@test.com',
      direccion: 'Calle Test 123'
    };

    const response = await authPost(request, adminToken, '/proveedores', payload);
    expect([200, 201]).toContain(response.status());

    const body = await response.json();
    createdProvId = body.id || body.id_proveedor || (body.proveedor && (body.proveedor.id || body.proveedor.id_proveedor));
    expect(createdProvId).toBeTruthy();
  });

  test('Actualizar proveedor existente', async ({ request }) => {
    expect(createdProvId).toBeDefined();

    const response = await authPatch(request, adminToken, `/proveedores/${createdProvId}`, {
      contacto_nombre: 'Updated',
      contacto: 'Updated'
    });
    expect(response.status()).toBe(200);
  });

  test('Eliminar proveedor creado', async ({ request }) => {
    expect(createdProvId).toBeDefined();

    const response = await authDelete(request, adminToken, `/proveedores/${createdProvId}`);
    expect(response.status()).toBe(200);
  });
});
