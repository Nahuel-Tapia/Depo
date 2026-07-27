const { test, expect } = require('@playwright/test');
const { getToken } = require('../helpers/auth.helper');
const { authGet, authPost, authPatch, authDelete, publicGet } = require('../helpers/api.helper');

test.describe.serial('API Instituciones Tests', () => {
  let adminToken;
  let createdInstId;
  let existingInstId;

  test.beforeAll(async ({ request }) => {
    adminToken = await getToken(request, 'admin');

    const response = await authGet(request, adminToken, '/instituciones');
    if (response.ok()) {
      const body = await response.json();
      const list = Array.isArray(body) ? body : (body.instituciones || []);
      if (list.length > 0) {
        existingInstId = list[0].id || list[0].id_institucion;
      }
    }
  });

  test('Listar instituciones públicas', async ({ request }) => {
    const response = await publicGet(request, '/instituciones/public/list');
    expect(response.status()).toBe(200);

    const body = await response.json();
    const instituciones = Array.isArray(body) ? body : body.instituciones;
    expect(Array.isArray(instituciones)).toBe(true);
  });

  test('Buscar por CUE público', async ({ request }) => {
    const response = await publicGet(request, '/instituciones/public/cue/700030100');
    expect([200, 404]).toContain(response.status());
  });

  test('CUE inexistente público', async ({ request }) => {
    const response = await publicGet(request, '/instituciones/public/cue/000000000');
    expect(response.status()).toBe(404);
  });

  test('Listar instituciones', async ({ request }) => {
    const response = await authGet(request, adminToken, '/instituciones');
    expect(response.status()).toBe(200);

    const body = await response.json();
    const instituciones = Array.isArray(body) ? body : body.instituciones;
    expect(Array.isArray(instituciones)).toBe(true);
  });

  test('Obtener detalle de institución', async ({ request }) => {
    if (!existingInstId) {
      test.skip();
    }
    const response = await authGet(request, adminToken, `/instituciones/${existingInstId}`);
    expect(response.status()).toBe(200);
  });

  test('Historial global', async ({ request }) => {
    const response = await authGet(request, adminToken, '/instituciones/historial');
    expect(response.status()).toBe(200);
  });

  test('Buscar por CUE autenticado', async ({ request }) => {
    const response = await authGet(request, adminToken, '/instituciones/cue/700030100');
    expect([200, 404]).toContain(response.status());
  });

  test('Crear institución', async ({ request }) => {
    const timestamp = Date.now();
    const cue = '999' + String(timestamp).slice(-6);
    const payload = {
      nombre: 'Institución Test ' + timestamp,
      cue: cue,
      departamento: 'CAPITAL',
      direccion: 'Test 123',
      telefono: '2640000000',
      email: 'inst_test@test.com'
    };

    const response = await authPost(request, adminToken, '/instituciones', payload);
    expect([200, 201]).toContain(response.status());

    const body = await response.json();
    createdInstId = body.id || body.id_institucion || (body.institucion && (body.institucion.id || body.institucion.id_institucion));
    expect(createdInstId).toBeTruthy();
  });

  test('Actualizar institución', async ({ request }) => {
    if (!createdInstId) {
      test.skip();
    }
    const response = await authPatch(request, adminToken, `/instituciones/${createdInstId}`, {
      nombre: 'Inst Updated'
    });
    expect(response.status()).toBe(200);
  });

  test('Historial por institución', async ({ request }) => {
    const instId = existingInstId || createdInstId;
    if (!instId) {
      test.skip();
    }
    const response = await authGet(request, adminToken, `/instituciones/${instId}/historial`);
    expect(response.status()).toBe(200);
  });

  test('Asignaciones por período', async ({ request }) => {
    const instId = existingInstId || createdInstId;
    if (!instId) {
      test.skip();
    }
    const response = await authGet(request, adminToken, `/instituciones/${instId}/asignaciones`);
    expect(response.status()).toBe(200);
  });

  test('Resumen por período', async ({ request }) => {
    const response = await authGet(request, adminToken, '/instituciones/resumen/2026');
    expect(response.status()).toBe(200);
  });

  test('Eliminar institución creada', async ({ request }) => {
    if (!createdInstId) {
      test.skip();
    }
    const response = await authDelete(request, adminToken, `/instituciones/${createdInstId}`);
    expect(response.status()).toBe(200);
  });

  test('Eliminar institución inexistente', async ({ request }) => {
    const response = await authDelete(request, adminToken, '/instituciones/999999');
    expect(response.status()).toBe(404);
  });
});
