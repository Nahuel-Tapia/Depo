const { test, expect } = require('@playwright/test');
const { API_URL } = require('../../helpers/constants');
const { loginAs, getToken } = require('../../helpers/auth.helper');
const { authGet } = require('../../helpers/api.helper');

test.describe('Auth Security Tests', () => {

  test('Request sin header Authorization devuelve 401', async ({ request }) => {
    const response = await request.get(`${API_URL}/users/me`);
    expect(response.status()).toBe(401);
  });

  test('Token con formato inválido devuelve 401', async ({ request }) => {
    const response = await request.get(`${API_URL}/users/me`, {
      headers: {
        'Authorization': 'Bearer not-a-jwt'
      }
    });
    expect(response.status()).toBe(401);
  });

  test('Token con formato invalid.invalid.invalid (abc.def.ghi) devuelve 401', async ({ request }) => {
    const response = await request.get(`${API_URL}/users/me`, {
      headers: {
        'Authorization': 'Bearer abc.def.ghi'
      }
    });
    expect(response.status()).toBe(401);
  });

  test('Header Authorization sin prefijo Bearer devuelve 401', async ({ request }) => {
    const response = await request.get(`${API_URL}/users/me`, {
      headers: {
        'Authorization': 'token123'
      }
    });
    expect(response.status()).toBe(401);
  });

  test('Header Authorization vacío devuelve 401', async ({ request }) => {
    const response = await request.get(`${API_URL}/users/me`, {
      headers: {
        'Authorization': ''
      }
    });
    expect(response.status()).toBe(401);
  });

});
