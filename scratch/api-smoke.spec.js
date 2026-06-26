const { test, expect } = require('@playwright/test');

test.describe('API Smoke Tests', () => {
  let token = '';

  test('should login successfully as admin', async ({ request }) => {
    const response = await request.post('http://localhost:4000/api/auth/login', {
      data: {
        email: 'admin@depo.local',
        password: 'Admin123!'
      }
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.token).toBeDefined();
    expect(body.user.role).toBe('admin');
    token = body.token;
  });

  test('should fail login with invalid credentials', async ({ request }) => {
    const response = await request.post('http://localhost:4000/api/auth/login', {
      data: {
        email: 'admin@depo.local',
        password: 'WrongPassword'
      }
    });
    expect(response.status()).toBe(401);
  });

  test('should fetch products successfully', async ({ request }) => {
    const loginResponse = await request.post('http://localhost:4000/api/auth/login', {
      data: {
        email: 'admin@depo.local',
        password: 'Admin123!'
      }
    });
    const loginBody = await loginResponse.json();
    const activeToken = loginBody.token;

    const response = await request.get('http://localhost:4000/api/productos', {
      headers: {
        'Authorization': `Bearer ${activeToken}`
      }
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(Array.isArray(body.productos || body)).toBeTruthy();
  });

  test('should fetch pedidos successfully', async ({ request }) => {
    const loginResponse = await request.post('http://localhost:4000/api/auth/login', {
      data: {
        email: 'admin@depo.local',
        password: 'Admin123!'
      }
    });
    const loginBody = await loginResponse.json();
    const activeToken = loginBody.token;

    const response = await request.get('http://localhost:4000/api/pedidos', {
      headers: {
        'Authorization': `Bearer ${activeToken}`
      }
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.pedidos || Array.isArray(body)).toBeDefined();
  });
});
