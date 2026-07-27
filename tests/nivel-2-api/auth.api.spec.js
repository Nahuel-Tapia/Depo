const { test, expect } = require('@playwright/test');
const { TEST_USERS, API_URL } = require('../../helpers/constants');
const { loginAs, loginRaw, loginByCue, loginByDni } = require('../../helpers/auth.helper');
const { authGet, publicGet, publicPost } = require('../../helpers/api.helper');

test.describe('API Auth Tests', () => {

  test('Login con email+password (admin)', async ({ request }) => {
    const response = await loginRaw(request, TEST_USERS.admin.email, TEST_USERS.admin.password);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(typeof body.token).toBe('string');
    expect(body.user).toBeDefined();
    expect(body.user.role).toBe('admin');
    expect(body.user.email).toBeTruthy();
  });

  test('Login con DNI+password', async ({ request }) => {
    const response = await loginByDni(request, '00000000', 'Admin123!');
    expect([200, 401]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.token).toBeTruthy();
    }
  });

  test('Login con campo numérico puro (interpretado como DNI/CUE)', async ({ request }) => {
    const response = await loginRaw(request, '00000000', 'Admin123!');
    expect([200, 401]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.token).toBeTruthy();
    }
  });

  test('Login falla sin credenciales', async ({ request }) => {
    const response = await publicPost(request, '/auth/login', {});
    expect(response.status()).toBe(400);
  });

  test('Login falla con contraseña incorrecta', async ({ request }) => {
    const response = await loginRaw(request, 'admin@depo.local', 'Wrong123');
    expect(response.status()).toBe(401);
  });

  test('Login falla con email inexistente', async ({ request }) => {
    const response = await loginRaw(request, 'noexiste@test.com', 'Test123!');
    expect(response.status()).toBe(401);
  });

  test('Registro de directivo con datos inválidos (sin CUE)', async ({ request }) => {
    const response = await publicPost(request, '/auth/register', {
      nombre: 'Test',
      email: 'test@t.com',
      password: 'Test123!'
    });
    expect(response.status()).toBe(400);
  });

  test('Registro con CUE inválido (<9 dígitos)', async ({ request }) => {
    const response = await publicPost(request, '/auth/register', {
      nombre: 'Test Directivo',
      email: 'testdirectivo@t.com',
      cue: '123',
      nivel_educativo: 'primario',
      password: 'Test123!'
    });
    expect(response.status()).toBe(400);
  });

  test('Registro con email inválido', async ({ request }) => {
    const response = await publicPost(request, '/auth/register', {
      nombre: 'Test Directivo',
      email: 'notanemail',
      cue: '123456789',
      nivel_educativo: 'primario',
      password: 'Test123!'
    });
    expect(response.status()).toBe(400);
  });

  test('Token permite acceder a /users/me', async ({ request }) => {
    const { token } = await loginAs(request, 'admin');
    const response = await authGet(request, token, '/users/me');
    expect(response.status()).toBe(200);

    const body = await response.json();
    const user = body.user || body;
    expect(user).toBeTruthy();
    expect(user).toHaveProperty('email');
  });

  test('Sin token no accede a /users/me', async ({ request }) => {
    const response = await publicGet(request, '/users/me');
    expect(response.status()).toBe(401);
  });

  test('Token malformado rechazado', async ({ request }) => {
    const response = await request.get(`${API_URL}/users/me`, {
      headers: {
        'Authorization': 'Bearer invalid.token.here'
      }
    });
    expect(response.status()).toBe(401);
  });

});
