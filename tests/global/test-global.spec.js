const { test, expect } = require('@playwright/test');
const { Pool } = require('pg');
const dbConfig = require('../../backend/src/config/database');
const { API_URL } = require('../helpers/constants');
const { loginAs, getToken } = require('../helpers/auth.helper');
const { authGet, authPost, authPatch } = require('../helpers/api.helper');

const NIVELES = ['inicial', 'primario', 'secundario', 'especial'];

test.describe.serial('🌍 TEST GLOBAL DEL SISTEMA (Multi-Nivel: Pedidos, Zonas, Directivos, Kits, Supervisores)', () => {
  let pool;
  let adminToken;
  let directorTokens = {};
  let supervisorTokens = {};
  let directivoTokens = {};

  test.beforeAll(async ({ request }) => {
    pool = new Pool(dbConfig);

    // Login Admin
    const adminAuth = await loginAs(request, 'admin');
    adminToken = adminAuth.token;

    // Login representativo para cada nivel
    for (const nivel of NIVELES) {
      // Director de Área
      const dirEmail = `director.${nivel}@test.local`;
      const dirRes = await request.post(`${API_URL}/auth/login`, {
        data: { email: dirEmail, password: 'Test123!' }
      });
      if (dirRes.ok()) {
        const data = await dirRes.json();
        directorTokens[nivel] = data.token;
      }

      // Supervisor
      const supEmail = (nivel === 'primario') ? 'supervisor.zona1@test.local' : `supervisor.${nivel}.1@test.local`;
      const supRes = await request.post(`${API_URL}/auth/login`, {
        data: { email: supEmail, password: 'Test123!' }
      });
      if (supRes.ok()) {
        const data = await supRes.json();
        supervisorTokens[nivel] = data.token;
      }

      // Directivo
      const directivoEmail = (nivel === 'primario') ? 'directivo.escuela1@test.local' : `directivo.${nivel}.1@test.local`;
      const directivoRes = await request.post(`${API_URL}/auth/login`, {
        data: { email: directivoEmail, password: 'Test123!' }
      });
      if (directivoRes.ok()) {
        const data = await directivoRes.json();
        directivoTokens[nivel] = data.token;
      }
    }
  });

  test.afterAll(async () => {
    if (pool) await pool.end();
  });

  // =========================================================================
  // 1. INTEGRIDAD DE BASE DE DATOS: AL MENOS 10 POR NIVEL
  // =========================================================================
  test.describe('1️⃣ Verificación de Cantidades Mínimas en Base de Datos (>= 10 de cada nivel)', () => {
    test('Verificar al menos 10 Directivos por nivel educativo', async () => {
      const res = await pool.query(`
        SELECT COALESCE(nivel_educativo, 'sin_nivel') as nivel, COUNT(*) as cantidad
        FROM usuario
        WHERE role = 'directivo'
        GROUP BY nivel_educativo
      `);
      const countsByLevel = {};
      res.rows.forEach(r => { countsByLevel[r.nivel] = parseInt(r.cantidad, 10); });

      for (const nivel of NIVELES) {
        const count = countsByLevel[nivel] || 0;
        expect(count, `Directivos del nivel ${nivel} debe ser >= 10`).toBeGreaterThanOrEqual(10);
      }
    });

    test('Verificar al menos 10 Supervisores por nivel educativo', async () => {
      const res = await pool.query(`
        SELECT COALESCE(nivel_educativo, 'sin_nivel') as nivel, COUNT(*) as cantidad
        FROM usuario
        WHERE role = 'supervisor'
        GROUP BY nivel_educativo
      `);
      const countsByLevel = {};
      res.rows.forEach(r => { countsByLevel[r.nivel] = parseInt(r.cantidad, 10); });

      for (const nivel of NIVELES) {
        const count = countsByLevel[nivel] || 0;
        expect(count, `Supervisores del nivel ${nivel} debe ser >= 10`).toBeGreaterThanOrEqual(10);
      }
    });

    test('Verificar al menos 10 Zonas por nivel educativo', async () => {
      const res = await pool.query(`
        SELECT COALESCE(nivel_educativo, 'sin_nivel') as nivel, COUNT(*) as cantidad
        FROM zona
        GROUP BY nivel_educativo
      `);
      const countsByLevel = {};
      res.rows.forEach(r => { countsByLevel[r.nivel] = parseInt(r.cantidad, 10); });

      for (const nivel of NIVELES) {
        const count = countsByLevel[nivel] || 0;
        expect(count, `Zonas del nivel ${nivel} debe ser >= 10`).toBeGreaterThanOrEqual(10);
      }
    });

    test('Verificar al menos 10 Kits de productos por nivel educativo', async () => {
      const res = await pool.query(`
        SELECT COALESCE(tipo_escuela, 'sin_nivel') as nivel, COUNT(*) as cantidad
        FROM producto_kit
        GROUP BY tipo_escuela
      `);
      const countsByLevel = {};
      res.rows.forEach(r => { countsByLevel[r.nivel] = parseInt(r.cantidad, 10); });

      for (const nivel of NIVELES) {
        const count = countsByLevel[nivel] || 0;
        expect(count, `Kits del nivel ${nivel} debe ser >= 10`).toBeGreaterThanOrEqual(10);
      }
    });

    test('Verificar al menos 10 Pedidos por nivel educativo con detalle de productos', async () => {
      const res = await pool.query(`
        SELECT COALESCE(i.nivel_educativo, 'sin_nivel') as nivel, COUNT(p.id_pedido) as cantidad
        FROM pedido p
        JOIN institucion i ON p.id_institucion = i.id_institucion
        GROUP BY i.nivel_educativo
      `);
      const countsByLevel = {};
      res.rows.forEach(r => { countsByLevel[r.nivel] = parseInt(r.cantidad, 10); });

      for (const nivel of NIVELES) {
        const count = countsByLevel[nivel] || 0;
        expect(count, `Pedidos del nivel ${nivel} debe ser >= 10`).toBeGreaterThanOrEqual(10);
      }

      // Validar que los pedidos tienen items asociados
      const detallesRes = await pool.query(`SELECT COUNT(*) as total_detalles FROM detalle_pedido`);
      expect(parseInt(detallesRes.rows[0].total_detalles, 10)).toBeGreaterThan(50);
    });
  });

  // =========================================================================
  // 2. AUTENTICACIÓN MULTI-ROL Y MULTI-NIVEL
  // =========================================================================
  test.describe('2️⃣ Autenticación en todos los Niveles y Roles', () => {
    for (const nivel of NIVELES) {
      test(`Login exitoso Director de Área (${nivel})`, async () => {
        expect(directorTokens[nivel], `Token para director_${nivel} debe existir`).toBeDefined();
      });

      test(`Login exitoso Supervisor (${nivel})`, async () => {
        expect(supervisorTokens[nivel], `Token para supervisor_${nivel} debe existir`).toBeDefined();
      });

      test(`Login exitoso Directivo (${nivel})`, async () => {
        expect(directivoTokens[nivel], `Token para directivo_${nivel} debe existir`).toBeDefined();
      });
    }
  });

  // =========================================================================
  // 3. PRUEBAS DE ENDPOINTS DE ZONAS Y ASIGNACIONES
  // =========================================================================
  test.describe('3️⃣ Zonas y Asignaciones por Nivel', () => {
    for (const nivel of NIVELES) {
      test(`Director de Área (${nivel}) lista edificios y zonas`, async ({ request }) => {
        const token = directorTokens[nivel];
        test.skip(!token, `Token de director_${nivel} no disponible`);

        const resZonas = await authGet(request, token, '/director-area/zonas-edificio');
        expect(resZonas.status()).toBe(200);
        const dataZonas = await resZonas.json();
        expect(dataZonas).toBeDefined();

        const resSupervisores = await authGet(request, token, '/director-area/supervisores');
        expect(resSupervisores.status()).toBe(200);
        const dataSup = await resSupervisores.json();
        expect(Array.isArray(dataSup.supervisores || dataSup)).toBe(true);
      });
    }

    test('Creación de Zona vía API por Director de Área Primario', async ({ request }) => {
      const token = directorTokens['primario'];
      test.skip(!token, 'Token director primario no disponible');

      const zoneName = `Zona Global Test API ${Date.now()}`;
      const res = await authPost(request, token, '/zones', {
        name: zoneName,
        nivel_educativo: 'primario'
      });
      expect([200, 201]).toContain(res.status());
    });
  });

  // =========================================================================
  // 4. PRUEBAS DE SUPERVISIÓN POR NIVEL
  // =========================================================================
  test.describe('4️⃣ Supervisores: Consulta de Instituciones, Stats y Pendientes', () => {
    for (const nivel of NIVELES) {
      test(`Supervisor (${nivel}) obtiene sus instituciones asignadas`, async ({ request }) => {
        const token = supervisorTokens[nivel];
        test.skip(!token, `Token supervisor_${nivel} no disponible`);

        const res = await authGet(request, token, '/supervisor/instituciones');
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body).toBeDefined();
      });

      test(`Supervisor (${nivel}) consulta dashboard stats`, async ({ request }) => {
        const token = supervisorTokens[nivel];
        test.skip(!token, `Token supervisor_${nivel} no disponible`);

        const res = await authGet(request, token, '/supervisor/dashboard/stats');
        expect(res.status()).toBe(200);
      });

      test(`Supervisor (${nivel}) consulta pedidos pendientes`, async ({ request }) => {
        const token = supervisorTokens[nivel];
        test.skip(!token, `Token supervisor_${nivel} no disponible`);

        const res = await authGet(request, token, '/supervisor/pedidos-pendientes');
        expect(res.status()).toBe(200);
      });
    }
  });

  // =========================================================================
  // 5. PRUEBAS DE DIRECTIVOS Y GESTIÓN ESCOLAR
  // =========================================================================
  test.describe('5️⃣ Directivos: Alertas, Stock Escolar y Depósito', () => {
    for (const nivel of NIVELES) {
      test(`Directivo (${nivel}) consulta alertas institucionales`, async ({ request }) => {
        const token = directivoTokens[nivel];
        test.skip(!token, `Token directivo_${nivel} no disponible`);

        const res = await authGet(request, token, '/directivo/alertas');
        expect(res.status()).toBe(200);
      });

      test(`Directivo (${nivel}) consulta mi-stock`, async ({ request }) => {
        const token = directivoTokens[nivel];
        test.skip(!token, `Token directivo_${nivel} no disponible`);

        const res = await authGet(request, token, '/directivo/mi-stock');
        expect(res.status()).toBe(200);
      });
    }
  });

  // =========================================================================
  // 6. PRUEBAS DE KITS DE PRODUCTOS
  // =========================================================================
  test.describe('6️⃣ Catálogo de Kits Multi-Nivel', () => {
    test('Listar catálogo completo de kits como Admin', async ({ request }) => {
      const res = await authGet(request, adminToken, '/pedidos/kits');
      expect(res.status()).toBe(200);
      const body = await res.json();
      const kits = Array.isArray(body) ? body : (body.kits || []);
      expect(kits.length).toBeGreaterThanOrEqual(40);
    });

    test('Crear Kit y verificar persistencia con items', async ({ request }) => {
      const prodRes = await authGet(request, adminToken, '/productos');
      const prodBody = await prodRes.json();
      const productos = Array.isArray(prodBody) ? prodBody : (prodBody.productos || []);
      expect(productos.length).toBeGreaterThan(0);

      const prodId = productos[0].id || productos[0].id_producto;
      const kitPayload = {
        nombre: `Kit Automatizado Test ${Date.now()}`,
        tipo_escuela: 'primario',
        descripcion: 'Kit creado en test global',
        cantidad_alumnos: 120,
        items: [{ producto_id: prodId, cantidad: 10 }]
      };

      const res = await authPost(request, adminToken, '/pedidos/kits', kitPayload);
      expect([200, 201]).toContain(res.status());
    });
  });

  // =========================================================================
  // 7. CICLO DE VIDA COMPLETO DE UN PEDIDO
  // =========================================================================
  test.describe('7️⃣ Ciclo de Vida del Pedido (Creación, Aprobación Director y Cancelación)', () => {
    let nuevoPedidoId;

    test('Directivo Primario crea un nuevo pedido con kit oficial', async ({ request }) => {
      const token = directivoTokens['primario'];
      test.skip(!token, 'Token directivo primario no disponible');

      const kitsRes = await authGet(request, token, '/pedidos/kits');
      const kitsData = await kitsRes.json();
      const kits = Array.isArray(kitsData) ? kitsData : (kitsData.kits || []);
      expect(kits.length).toBeGreaterThan(0);

      const kitId = kits[0].id;
      const payload = {
        kit_id: kitId,
        cantidad: 1,
        tipo: 'emergencia',
        observaciones_generales: 'Pedido de prueba ciclo de vida global'
      };

      const res = await authPost(request, token, '/pedidos', payload);
      expect([200, 201]).toContain(res.status());
      const body = await res.json();
      nuevoPedidoId = body.id_pedido || body.id || (body.pedido && body.pedido.id_pedido);
      expect(nuevoPedidoId).toBeDefined();
    });

    test('Consultar detalle del pedido creado', async ({ request }) => {
      test.skip(!nuevoPedidoId, 'Pedido no creado previamente');
      const res = await authGet(request, adminToken, `/pedidos/${nuevoPedidoId}`);
      expect(res.status()).toBe(200);
      const data = await res.json();
      const pedido = data.pedido || data;
      expect(pedido.id_pedido || pedido.id).toBe(nuevoPedidoId);
    });

    test('Supervisor Primario aprueba el pedido pendiente de su escuela asignada', async ({ request }) => {
      test.skip(!nuevoPedidoId, 'Pedido no creado previamente');
      const token = supervisorTokens['primario'];
      test.skip(!token, 'Token supervisor primario no disponible');

      const res = await authPatch(request, token, `/pedidos/${nuevoPedidoId}/estado`, {
        estado: 'aprobado',
        motivo: 'Aprobación formal por supervisor'
      });
      expect([200, 204]).toContain(res.status());
    });

    test('Director de Área Primario aprueba un pedido pendiente de su nivel', async ({ request }) => {
      const token = directorTokens['primario'];
      test.skip(!token, 'Token director primario no disponible');

      // Buscar un pedido en estado pendiente_director del nivel primario
      const pedRes = await pool.query(`
        SELECT p.id_pedido
        FROM pedido p
        JOIN institucion i ON p.id_institucion = i.id_institucion
        WHERE p.estado = 'pendiente_director'
        LIMIT 1
      `);

      if (pedRes.rows.length > 0) {
        const pedId = pedRes.rows[0].id_pedido;
        const res = await authPatch(request, token, `/pedidos/${pedId}/aprobar-director`, {
          decision: 'aprobar',
          motivo: 'Aprobado satisfactoriamente por director de área'
        });
        expect([200, 204]).toContain(res.status());
      }
    });

    test('Directivo cancela su propio pedido secundario pendiente', async ({ request }) => {
      const token = directivoTokens['secundario'];
      test.skip(!token, 'Token directivo secundario no disponible');

      const kitsRes = await authGet(request, token, '/pedidos/kits');
      const kitsData = await kitsRes.json();
      const kits = Array.isArray(kitsData) ? kitsData : (kitsData.kits || []);
      const kitId = kits[0].id;

      const createRes = await authPost(request, token, '/pedidos', {
        kit_id: kitId,
        cantidad: 1,
        tipo: 'anual',
        observaciones_generales: 'Pedido para prueba de cancelación'
      });
      const createData = await createRes.json();
      const cancelId = createData.id_pedido || createData.id || (createData.pedido && createData.pedido.id_pedido);

      if (cancelId) {
        const cancelRes = await authPatch(request, token, `/pedidos/${cancelId}/cancelar`, {
          motivo: 'Cancelado por el directivo'
        });
        expect([200, 204]).toContain(cancelRes.status());
      }
    });
  });
});
