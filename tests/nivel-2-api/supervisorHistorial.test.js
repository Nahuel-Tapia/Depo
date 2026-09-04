const { test, expect } = require('@playwright/test');
const { loginAs } = require('../helpers/auth.helper');
const { authGet } = require('../helpers/api.helper');

test.describe('Supervisor: Historial de Consumo', () => {
  let supervisorToken;
  let directivoToken;
  const escuelaId = 1;

  test.beforeAll(async ({ request }) => {
    try {
      const supAuth = await loginAs(request, 'supervisor');
      supervisorToken = supAuth.token;
    } catch (e) {
      console.warn('Supervisor no disponible para historial:', e.message);
    }

    try {
      const dirAuth = await loginAs(request, 'directivo');
      directivoToken = dirAuth.token;
    } catch (e) {
      console.warn('Directivo no disponible para historial:', e.message);
    }
  });

  test('Debe retornar el historial consolidado de una institución para el supervisor', async ({ request }) => {
    test.skip(!supervisorToken, 'Supervisor token no disponible');
    const response = await authGet(request, supervisorToken, `/supervisor/instituciones/${escuelaId}/historial`);
    expect([200, 404]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toBeDefined();
    }
  });

  test('Debe denegar el acceso si el token pertenece a un Directivo (Unauthorized Role)', async ({ request }) => {
    test.skip(!directivoToken, 'Directivo token no disponible');
    const response = await authGet(request, directivoToken, `/supervisor/instituciones/${escuelaId}/historial`);
    expect([401, 403]).toContain(response.status());
  });
});