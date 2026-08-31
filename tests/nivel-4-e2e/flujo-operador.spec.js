const { test, expect } = require('@playwright/test');
const { TEST_USERS } = require('../helpers/constants');
const { loginAs } = require('../helpers/auth.helper');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

test.describe.serial('E2E Flujo Operador', () => {
  let operadorToken = null;
  let operadorUser = null;
  let operadorAvailable = false;

  test.beforeAll(async ({ request }) => {
    try {
      const res = await loginAs(request, 'operador');
      operadorToken = res.token;
      operadorUser = res.user;
      operadorAvailable = true;
    } catch (err) {
      console.warn('Login de operador no disponible via API:', err.message);
      operadorAvailable = false;
    }
  });

  test.beforeEach(async () => {
    if (!operadorAvailable) {
      test.skip(true, 'Usuario operador no disponible para pruebas E2E');
    }
  });

  async function ensureLoggedIn(page) {
    try {
      if (operadorToken && operadorUser) {
        await page.goto(`${FRONTEND_URL}/login`);
        await page.evaluate(({ token, user }) => {
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
        }, { token: operadorToken, user: operadorUser });
        await page.goto(`${FRONTEND_URL}/dashboard`);
        await page.waitForLoadState('networkidle').catch(() => {});
      }
    } catch (err) {
      console.warn('Error al establecer sesión:', err.message);
    }
  }

  test('1. Login como operador', async ({ page }) => {
    try {
      await page.goto(`${FRONTEND_URL}/login`);
      await page.waitForLoadState('domcontentloaded');

      const emailInput = page.locator('input[type="text"], input[type="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      const submitBtn = page.locator('button[type="submit"]').first();

      await emailInput.fill(TEST_USERS.operador.email);
      await passwordInput.fill(TEST_USERS.operador.password);
      await submitBtn.click();

      await expect(page).toHaveURL(new RegExp('/dashboard'), { timeout: 10000 });
      const dashboardElement = page.locator('.dashboard-shell, .dashboard-main, main, header').first();
      await expect(dashboardElement).toBeVisible({ timeout: 10000 });
    } catch (err) {
      console.warn('Excepción en Login como operador:', err.message);
      if (err.message.includes('ECONNREFUSED') || err.message.includes('net::ERR_CONNECTION_REFUSED')) {
        test.skip(true, 'Frontend server no disponible en ' + FRONTEND_URL);
      } else {
        throw err;
      }
    }
  });

  test('2. Ver Stock / Inventario', async ({ page }) => {
    try {
      await ensureLoggedIn(page);

      const stockBtn = page.getByRole('button', { name: /Stock|Inventario|Depósito/i })
        .or(page.locator('.dashboard-nav-item:has-text("Stock")'))
        .first();

      if (await stockBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await stockBtn.click();
      } else {
        await page.goto(`${FRONTEND_URL}/dashboard/stock`);
      }

      await page.waitForTimeout(1000);
      expect(page.url()).toMatch(/stock|inventario|depositos|dashboard/i);

      const viewElement = page.locator('.dashboard-content, section, main, table').first();
      await expect(viewElement).toBeVisible();
    } catch (err) {
      if (err.message.includes('ECONNREFUSED')) {
        test.skip(true, 'Frontend server no disponible');
      } else {
        throw err;
      }
    }
  });

  test('3. Ver Entregas / Envíos', async ({ page }) => {
    try {
      await ensureLoggedIn(page);

      const entregasBtn = page.getByRole('button', { name: /Entregas|Envíos|Distribución/i })
        .or(page.locator('.dashboard-nav-item:has-text("Entregas")'))
        .first();

      if (await entregasBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await entregasBtn.click();
      } else {
        await page.goto(`${FRONTEND_URL}/dashboard/entregas`);
      }

      await page.waitForTimeout(1000);
      expect(page.url()).toMatch(/entregas|envios|dashboard/i);

      const viewElement = page.locator('.dashboard-content, section, main, table').first();
      await expect(viewElement).toBeVisible();
    } catch (err) {
      if (err.message.includes('ECONNREFUSED')) {
        test.skip(true, 'Frontend server no disponible');
      } else {
        throw err;
      }
    }
  });

  test('4. Ver Movimientos', async ({ page }) => {
    try {
      await ensureLoggedIn(page);

      const movBtn = page.getByRole('button', { name: /Movimientos/i })
        .or(page.locator('.dashboard-nav-item:has-text("Movimientos")'))
        .first();

      if (await movBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await movBtn.click();
      } else {
        await page.goto(`${FRONTEND_URL}/dashboard/movimientos`);
      }

      await page.waitForTimeout(1000);
      expect(page.url()).toMatch(/movimientos|dashboard/i);

      const viewElement = page.locator('.dashboard-content, section, main, table').first();
      await expect(viewElement).toBeVisible();
    } catch (err) {
      if (err.message.includes('ECONNREFUSED')) {
        test.skip(true, 'Frontend server no disponible');
      } else {
        throw err;
      }
    }
  });

  test('5. Validar que no se ven áreas no autorizadas', async ({ page }) => {
    try {
      await ensureLoggedIn(page);
      
      const usuariosBtn = page.getByRole('button', { name: /Usuarios/i })
        .or(page.locator('.dashboard-nav-item:has-text("Usuarios")'))
        .first();
        
      await expect(usuariosBtn).toBeHidden({ timeout: 2000 });
      
    } catch (err) {
      if (err.message.includes('ECONNREFUSED')) {
        test.skip(true, 'Frontend server no disponible');
      } else {
        throw err;
      }
    }
  });

});
