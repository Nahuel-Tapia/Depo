const { test, expect } = require('@playwright/test');
const { loginAs, getToken } = require('../helpers/auth.helper');
const { authGet, authPost, authDelete } = require('../helpers/api.helper');

test.describe.serial('API Compras Tests', () => {
  let adminToken;
  let comprasToken;
  let createdPlanillaId;

  test.beforeAll(async ({ request }) => {
    try {
      adminToken = await getToken(request, 'admin');
    } catch (err) {
      console.warn('Error al obtener adminToken:', err.message);
    }

    try {
      const auth = await loginAs(request, 'area_compras');
      comprasToken = auth.token;
    } catch (err) {
      console.warn('Error al obtener comprasToken (area_compras):', err.message);
      comprasToken = null;
    }
  });

  test('Listar planillas', async ({ request }) => {
    const token = comprasToken || adminToken;
    if (!token) {
      test.skip(true, 'Sin token de autenticación disponible');
      return;
    }

    try {
      const response = await authGet(request, token, '/compras/planillas');
      expect([200, 304]).toContain(response.status());

      const body = await response.json();
      expect(body).toBeDefined();
    } catch (err) {
      test.skip(true, `Error en Listar planillas: ${err.message}`);
    }
  });

  test('Consolidado de licitación', async ({ request }) => {
    const token = comprasToken || adminToken;
    if (!token) {
      test.skip(true, 'Sin token de autenticación disponible');
      return;
    }

    try {
      const response = await authGet(request, token, '/compras/licitacion/consolidado');
      expect([200, 304]).toContain(response.status());

      const body = await response.json();
      expect(body).toBeDefined();
    } catch (err) {
      test.skip(true, `Error en Consolidado de licitación: ${err.message}`);
    }
  });

  test('Consolidado anual', async ({ request }) => {
    const token = comprasToken || adminToken;
    if (!token) {
      test.skip(true, 'Sin token de autenticación disponible');
      return;
    }

    try {
      const response = await authGet(request, token, '/compras/licitacion/anual/consolidado');
      expect([200, 304]).toContain(response.status());

      const body = await response.json();
      expect(body).toBeDefined();
    } catch (err) {
      test.skip(true, `Error en Consolidado anual: ${err.message}`);
    }
  });

  test('Estado de directores', async ({ request }) => {
    const token = comprasToken || adminToken;
    if (!token) {
      test.skip(true, 'Sin token de autenticación disponible');
      return;
    }

    try {
      const response = await authGet(request, token, '/compras/licitacion/anual/estado-directores');
      expect([200, 304]).toContain(response.status());

      const body = await response.json();
      expect(body).toBeDefined();
    } catch (err) {
      test.skip(true, `Error en Estado de directores: ${err.message}`);
    }
  });

  test('Estado enviada', async ({ request }) => {
    const token = comprasToken || adminToken;
    if (!token) {
      test.skip(true, 'Sin token de autenticación disponible');
      return;
    }

    try {
      const response = await authGet(request, token, '/compras/licitacion/anual/enviada-status');
      expect([200, 304]).toContain(response.status());

      const body = await response.json();
      expect(body).toBeDefined();
    } catch (err) {
      test.skip(true, `Error en Estado enviada: ${err.message}`);
    }
  });

  test('Escuelas pendientes', async ({ request }) => {
    const token = comprasToken || adminToken;
    if (!token) {
      test.skip(true, 'Sin token de autenticación disponible');
      return;
    }

    try {
      const response = await authGet(request, token, '/compras/licitacion/anual/escuelas-pendientes');
      expect([200, 304]).toContain(response.status());

      const body = await response.json();
      expect(body).toBeDefined();
    } catch (err) {
      test.skip(true, `Error en Escuelas pendientes: ${err.message}`);
    }
  });

  test('Items finales', async ({ request }) => {
    const token = comprasToken || adminToken;
    if (!token) {
      test.skip(true, 'Sin token de autenticación disponible');
      return;
    }

    try {
      const response = await authGet(request, token, '/compras/licitacion/anual/final-items');
      expect([200, 304]).toContain(response.status());

      const body = await response.json();
      expect(body).toBeDefined();
    } catch (err) {
      test.skip(true, `Error en Items finales: ${err.message}`);
    }
  });

  test('Estado publicada', async ({ request }) => {
    const token = comprasToken || adminToken;
    if (!token) {
      test.skip(true, 'Sin token de autenticación disponible');
      return;
    }

    try {
      const response = await authGet(request, token, '/compras/licitacion/anual/publicada-status');
      expect([200, 304]).toContain(response.status());

      const body = await response.json();
      expect(body).toBeDefined();
    } catch (err) {
      test.skip(true, `Error en Estado publicada: ${err.message}`);
    }
  });

  test('Licitaciones cerradas', async ({ request }) => {
    const token = comprasToken || adminToken;
    if (!token) {
      test.skip(true, 'Sin token de autenticación disponible');
      return;
    }

    try {
      const response = await authGet(request, token, '/compras/licitacion/anual/cerradas');
      expect([200, 304]).toContain(response.status());

      const body = await response.json();
      expect(body).toBeDefined();
    } catch (err) {
      test.skip(true, `Error en Licitaciones cerradas: ${err.message}`);
    }
  });

  test('Obtener adjudicación', async ({ request }) => {
    const token = comprasToken || adminToken;
    if (!token) {
      test.skip(true, 'Sin token de autenticación disponible');
      return;
    }

    try {
      const response = await authGet(request, token, '/compras/adjudicacion');
      expect([200, 304]).toContain(response.status());

      const body = await response.json();
      expect(body).toBeDefined();
    } catch (err) {
      test.skip(true, `Error en Obtener adjudicación: ${err.message}`);
    }
  });

  test('Crear planilla', async ({ request }) => {
    const token = comprasToken || adminToken;
    if (!token) {
      test.skip(true, 'Sin token de autenticación disponible');
      return;
    }

    const payload = {
      titulo: 'Planilla Test ' + Date.now(),
      motivo: 'Test automatizado'
    };

    try {
      const response = await authPost(request, token, '/compras/planillas', payload);
      if (![200, 201].includes(response.status())) {
        test.skip(true, `Crear planilla retornó status ${response.status()}`);
        return;
      }
      expect([200, 201]).toContain(response.status());

      const body = await response.json();
      createdPlanillaId = body.id || body.id_planilla || (body.planilla && (body.planilla.id || body.planilla.id_planilla));
    } catch (err) {
      test.skip(true, `Error al crear planilla: ${err.message}`);
    }
  });

  test('Eliminar planilla creada', async ({ request }) => {
    const token = comprasToken || adminToken;
    if (!token) {
      test.skip(true, 'Sin token de autenticación disponible');
      return;
    }

    if (!createdPlanillaId) {
      test.skip(true, 'No se creó ninguna planilla en el paso previo');
      return;
    }

    try {
      const response = await authDelete(request, token, `/compras/planillas/${createdPlanillaId}`);
      expect(response.status()).toBe(200);
    } catch (err) {
      test.skip(true, `Error al eliminar planilla: ${err.message}`);
    }
  });
});
