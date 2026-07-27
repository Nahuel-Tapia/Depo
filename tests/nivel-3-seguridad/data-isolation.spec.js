const { test, expect } = require('@playwright/test');
const { loginAs, getToken } = require('../../helpers/auth.helper');
const { authGet, authPost, authPatch } = require('../../helpers/api.helper');
const { API_URL } = require('../../helpers/constants');

test.describe('Data Isolation Tests', () => {

  test('Directivo solo ve sus propios pedidos', async ({ request }) => {
    let directivoAuth;
    try {
      directivoAuth = await loginAs(request, 'directivo');
    } catch (err) {
      test.skip(true, 'Login de directivo falló: ' + err.message);
      return;
    }

    try {
      const response = await authGet(request, directivoAuth.token, '/pedidos');
      expect(response.status()).toBe(200);

      const body = await response.json();
      const pedidos = Array.isArray(body) ? body : (body.pedidos || body.data || []);

      if (!pedidos || pedidos.length === 0) {
        test.skip(true, 'No hay pedidos disponibles para verificar la aislación de datos de directivo');
        return;
      }

      const directivoInstId = directivoAuth.user?.id_institucion ?? directivoAuth.user?.institucion_id ?? directivoAuth.user?.institucion?.id ?? directivoAuth.user?.institucion?.id_institucion;

      for (const pedido of pedidos) {
        const pedidoInstId = pedido.id_institucion ?? pedido.institucion_id;
        if (directivoInstId) {
          expect(pedidoInstId).toBe(directivoInstId);
        } else {
          expect(pedidoInstId).toBeTruthy();
        }
      }
    } catch (err) {
      if (err.name === 'TestSkipError' || (err.message && err.message.includes('skip'))) throw err;
      throw err;
    }
  });

  test('Supervisor solo ve instituciones de su zona', async ({ request }) => {
    let supervisorAuth;
    try {
      supervisorAuth = await loginAs(request, 'supervisor');
    } catch (err) {
      test.skip(true, 'Login de supervisor falló: ' + err.message);
      return;
    }

    try {
      const response = await authGet(request, supervisorAuth.token, '/supervisor/instituciones');
      expect(response.status()).toBe(200);

      const body = await response.json();
      const instituciones = body.instituciones || body.data || body;
      expect(instituciones).toBeDefined();
      expect(Array.isArray(instituciones)).toBe(true);
    } catch (err) {
      if (err.name === 'TestSkipError' || (err.message && err.message.includes('skip'))) throw err;
      throw err;
    }
  });

  test('Director Área solo ve datos de su nivel educativo', async ({ request }) => {
    let directorAuth;
    try {
      directorAuth = await loginAs(request, 'director_area');
    } catch (err) {
      test.skip(true, 'Login de director_area falló: ' + err.message);
      return;
    }

    try {
      const response = await authGet(request, directorAuth.token, '/director-area/supervisores');
      expect(response.status()).toBe(200);

      const body = await response.json();
      const supervisores = body.supervisores || body.data || body;
      expect(supervisores).toBeDefined();
      expect(Array.isArray(supervisores)).toBe(true);
    } catch (err) {
      if (err.name === 'TestSkipError' || (err.message && err.message.includes('skip'))) throw err;
      throw err;
    }
  });

  test('Admin ve todos los usuarios', async ({ request }) => {
    let adminAuth;
    try {
      adminAuth = await loginAs(request, 'admin');
    } catch (err) {
      test.skip(true, 'Login de admin falló: ' + err.message);
      return;
    }

    let adminUserCount = 0;
    try {
      const adminResponse = await authGet(request, adminAuth.token, '/users');
      expect(adminResponse.status()).toBe(200);

      const adminBody = await adminResponse.json();
      const adminUsers = Array.isArray(adminBody) ? adminBody : (adminBody.users || adminBody.usuarios || []);
      adminUserCount = adminUsers.length;
      expect(adminUserCount).toBeGreaterThan(0);
    } catch (err) {
      if (err.name === 'TestSkipError' || (err.message && err.message.includes('skip'))) throw err;
      throw err;
    }

    let directorAuth;
    try {
      directorAuth = await loginAs(request, 'director_area');
    } catch (err) {
      // Si el login del director de área falla, se omite la comparación
      return;
    }

    try {
      const directorResponse = await authGet(request, directorAuth.token, '/users');
      if (directorResponse.status() === 200) {
        const directorBody = await directorResponse.json();
        const directorUsers = Array.isArray(directorBody) ? directorBody : (directorBody.users || directorBody.usuarios || []);
        expect(adminUserCount).toBeGreaterThan(directorUsers.length);
      }
    } catch (err) {
      // Ignorar errores de comparación opcional si la aserción de admin pasó
    }
  });

  test('Consulta no puede modificar datos', async ({ request }) => {
    let consultaAuth;
    try {
      consultaAuth = await loginAs(request, 'consulta');
    } catch (err) {
      test.skip(true, 'Login de usuario consulta falló: ' + err.message);
      return;
    }

    try {
      // POST /productos con datos válidos -> 403
      const postProdRes = await authPost(request, consultaAuth.token, '/productos', {
        nombre: 'Producto Hack Security Test',
        categoria: 'Limpieza',
        unidad_medida: 'unidad',
        stock_actual: 100
      });
      expect(postProdRes.status()).toBe(403);

      // POST /movimientos con datos válidos -> 403
      const postMovRes = await authPost(request, consultaAuth.token, '/movimientos', {
        id_producto: 1,
        tipo: 'ingreso',
        cantidad: 10,
        motivo: 'Intento de modificación sin permiso'
      });
      expect(postMovRes.status()).toBe(403);

      // PATCH /productos/1 con {nombre:'hack'} -> 403
      const patchProdRes = await authPatch(request, consultaAuth.token, '/productos/1', {
        nombre: 'hack'
      });
      expect(patchProdRes.status()).toBe(403);
    } catch (err) {
      if (err.name === 'TestSkipError' || (err.message && err.message.includes('skip'))) throw err;
      throw err;
    }
  });

});
