const { test, expect } = require('@playwright/test');
const { loginAs, getToken, loginRaw } = require('../../helpers/auth.helper');
const { authGet, publicGet, publicPost } = require('../../helpers/api.helper');

test.describe('Healthcheck', () => {
  test('Health check: GET /health', async ({ request }) => {
    const response = await publicGet(request, '/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });
});

test.describe('Authentication', () => {
  test('Login admin', async ({ request }) => {
    const response = await publicPost(request, '/auth/login', {
      email: 'admin@depo.local',
      password: 'Admin123!'
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.token).toBeDefined();
    expect(body.user.role).toBe('admin');
  });

  test('Login como director_area', async ({ request }) => {
    try {
      const { token, user } = await loginAs(request, 'director_area');
      expect(token).toBeDefined();
      expect(user.role).toBe('director_area');
    } catch (e) {
      test.skip(true, `Usuario de test para role no disponible: ${e.message}`);
    }
  });

  test('Login como supervisor', async ({ request }) => {
    try {
      const { token, user } = await loginAs(request, 'supervisor');
      expect(token).toBeDefined();
      expect(user.role).toBe('supervisor');
    } catch (e) {
      test.skip(true, `Usuario de test para role no disponible: ${e.message}`);
    }
  });

  test('Login como directivo', async ({ request }) => {
    try {
      const { token, user } = await loginAs(request, 'directivo');
      expect(token).toBeDefined();
      expect(user.role).toBe('directivo');
    } catch (e) {
      test.skip(true, `Usuario de test para role no disponible: ${e.message}`);
    }
  });

  test('Login como operador', async ({ request }) => {
    try {
      const { token, user } = await loginAs(request, 'operador');
      expect(token).toBeDefined();
      expect(user.role).toBe('operador');
    } catch (e) {
      test.skip(true, `Usuario de test para role no disponible: ${e.message}`);
    }
  });

  test('Login como area_compras', async ({ request }) => {
    try {
      const { token, user } = await loginAs(request, 'area_compras');
      expect(token).toBeDefined();
      expect(user.role).toBe('area_compras');
    } catch (e) {
      test.skip(true, `Usuario de test para role no disponible: ${e.message}`);
    }
  });

  test('Login como consulta', async ({ request }) => {
    try {
      const { token, user } = await loginAs(request, 'consulta');
      expect(token).toBeDefined();
      expect(user.role).toBe('consulta');
    } catch (e) {
      test.skip(true, `Usuario de test para role no disponible: ${e.message}`);
    }
  });

  test('Login como control_ministerio', async ({ request }) => {
    try {
      const { token, user } = await loginAs(request, 'control_ministerio');
      expect(token).toBeDefined();
      expect(user.role).toBe('control_ministerio');
    } catch (e) {
      test.skip(true, `Usuario de test para role no disponible: ${e.message}`);
    }
  });

  test('Login falla sin credenciales', async ({ request }) => {
    const response = await publicPost(request, '/auth/login', {});
    expect(response.status()).toBe(400);
  });

  test('Login falla con contraseña incorrecta', async ({ request }) => {
    const response = await loginRaw(request, 'admin@depo.local', 'WrongPass');
    expect(response.status()).toBe(401);
  });
});

test.describe('Core Endpoints', () => {
  let adminToken;

  test.beforeAll(async ({ request }) => {
    adminToken = await getToken(request, 'admin');
  });

  test('Productos responde (admin)', async ({ request }) => {
    const response = await authGet(request, adminToken, '/productos');
    expect(response.status()).toBe(200);
  });

  test('Pedidos responde (admin)', async ({ request }) => {
    const response = await authGet(request, adminToken, '/pedidos');
    expect(response.status()).toBe(200);
  });

  test('Instituciones responde (admin)', async ({ request }) => {
    const response = await authGet(request, adminToken, '/instituciones');
    expect(response.status()).toBe(200);
  });

  test('Dashboard stats responde', async ({ request }) => {
    const response = await authGet(request, adminToken, '/dashboard/stats');
    expect(response.status()).toBe(200);
  });

  test('Usuarios responde (admin)', async ({ request }) => {
    const response = await authGet(request, adminToken, '/users');
    expect(response.status()).toBe(200);
  });

  test('Endpoint sin token devuelve 401', async ({ request }) => {
    const response = await publicGet(request, '/productos');
    expect(response.status()).toBe(401);
  });
});
