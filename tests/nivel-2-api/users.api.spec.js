const { test, expect } = require('@playwright/test');
const { getToken } = require('../helpers/auth.helper');
const { authGet, authPost, authPatch, authDelete } = require('../helpers/api.helper');

test.describe.serial('API Users Tests', () => {
  let adminToken;
  let createdUserId;
  let createdUserEmail;

  test.beforeAll(async ({ request }) => {
    adminToken = await getToken(request, 'admin');
  });

  test('Obtener perfil propio', async ({ request }) => {
    const response = await authGet(request, adminToken, '/users/me');
    expect(response.status()).toBe(200);

    const body = await response.json();
    const user = body.user || body.usuario || body;
    expect(user.id || user.id_usuario).toBeDefined();
    expect(user.nombre).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.role || user.rol).toBeDefined();
  });

  test('Listar usuarios', async ({ request }) => {
    const response = await authGet(request, adminToken, '/users');
    expect(response.status()).toBe(200);

    const body = await response.json();
    const users = Array.isArray(body) ? body : (body.users || body.usuarios);
    expect(Array.isArray(users)).toBe(true);
  });

  test('Crear usuario consulta', async ({ request }) => {
    createdUserEmail = 'autotest_' + Date.now() + '@test.local';
    const payload = {
      nombre: 'Test User',
      apellido: 'AutoTest',
      email: createdUserEmail,
      password: 'Test123!',
      role: 'consulta',
      dni: String(Math.floor(Math.random() * 90000000) + 10000000)
    };

    const response = await authPost(request, adminToken, '/users', payload);
    expect([200, 201]).toContain(response.status());

    const body = await response.json();
    createdUserId = body.id || body.id_usuario || (body.user && (body.user.id || body.user.id_usuario)) || (body.usuario && (body.usuario.id || body.usuario.id_usuario));
    expect(createdUserId).toBeTruthy();
  });

  test('Editar usuario creado', async ({ request }) => {
    expect(createdUserId).toBeDefined();

    const response = await authPatch(request, adminToken, `/users/${createdUserId}`, {
      nombre: 'Updated User',
      email: createdUserEmail
    });
    expect(response.status()).toBe(200);
  });

  test('Cambiar rol de usuario', async ({ request }) => {
    expect(createdUserId).toBeDefined();

    const response = await authPatch(request, adminToken, `/users/${createdUserId}/role`, {
      role: 'consulta'
    });
    expect(response.status()).toBe(200);
  });

  test('Desactivar usuario', async ({ request }) => {
    expect(createdUserId).toBeDefined();

    const response = await authPatch(request, adminToken, `/users/${createdUserId}/active`, {
      activo: false
    });
    expect(response.status()).toBe(200);
  });

  test('Reactivar usuario', async ({ request }) => {
    expect(createdUserId).toBeDefined();

    const response = await authPatch(request, adminToken, `/users/${createdUserId}/active`, {
      activo: true
    });
    expect(response.status()).toBe(200);
  });

  test('Actualizar perfil propio', async ({ request }) => {
    const response = await authPatch(request, adminToken, '/users/me', {
      nombre: 'Admin Test'
    });
    expect(response.status()).toBe(200);

    // Restaurar nombre original de administrador
    await authPatch(request, adminToken, '/users/me', {
      nombre: 'Administrador'
    });
  });

  test('Cambiar contraseña - password actual incorrecto', async ({ request }) => {
    const response = await authPatch(request, adminToken, '/users/me/password', {
      currentPassword: 'Wrong',
      newPassword: 'New123!'
    });
    expect([400, 401]).toContain(response.status());
  });

  test('Crear usuario sin email (error)', async ({ request }) => {
    const response = await authPost(request, adminToken, '/users', {
      nombre: 'NoEmail',
      password: 'Test123!',
      role: 'consulta'
    });
    expect(response.status()).toBe(400);
  });

  test('Crear usuario sin password (error)', async ({ request }) => {
    const response = await authPost(request, adminToken, '/users', {
      nombre: 'NoPass',
      email: 'nopass@test.com',
      role: 'consulta'
    });
    expect(response.status()).toBe(400);
  });

  test('Eliminar usuario creado', async ({ request }) => {
    expect(createdUserId).toBeDefined();

    const response = await authDelete(request, adminToken, `/users/${createdUserId}`);
    expect(response.status()).toBe(200);
  });

  test('Eliminar usuario inexistente', async ({ request }) => {
    const response = await authDelete(request, adminToken, '/users/999999');
    expect(response.status()).toBe(404);
  });
});
