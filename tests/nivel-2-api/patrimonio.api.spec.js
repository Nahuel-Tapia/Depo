const { test, expect } = require('@playwright/test');
const { getToken } = require('../../helpers/auth.helper');
const { authGet, authPatch } = require('../../helpers/api.helper');

test.describe('API Patrimonio Tests', () => {
  let adminToken;

  test.beforeAll(async ({ request }) => {
    adminToken = await getToken(request, 'admin');
  });

  test('Listar tickets de patrimonio', async ({ request }) => {
    const response = await authGet(request, adminToken, '/patrimonio/tickets');
    expect(response.status()).toBe(200);
  });

  test('Cambiar estado de ticket inexistente', async ({ request }) => {
    const response = await authPatch(request, adminToken, '/patrimonio/tickets/999999/estado', {
      estado: 'resuelto'
    });
    expect([400, 404]).toContain(response.status());
  });
});
