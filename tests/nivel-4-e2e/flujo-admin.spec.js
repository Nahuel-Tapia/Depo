const { test, expect } = require('@playwright/test');
const { BASE_URL, TEST_USERS } = require('../../helpers/constants');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

test.describe.serial('E2E Flujo Admin', () => {
  let context;
  let page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    if (context) {
      await context.close();
    }
  });

  test('1. Login como admin y ver Dashboard', async () => {
    try {
      await page.goto(`${FRONTEND_URL}/login`, { timeout: 10000 });
    } catch {
      await page.goto(`${BASE_URL}/login`, { timeout: 10000 });
    }
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByPlaceholder(/admin@depo.local/i)
      .or(page.getByLabel(/CUE o Correo/i))
      .or(page.locator('input[type="text"]'))
      .first();
    await emailInput.fill(TEST_USERS.admin.email);

    const passwordInput = page.getByPlaceholder(/●●●●●●●●/i)
      .or(page.getByLabel(/Contraseña/i))
      .or(page.locator('input[type="password"]'))
      .first();
    await passwordInput.fill(TEST_USERS.admin.password);

    const loginButton = page.getByRole('button', { name: /Iniciar sesión/i }).first();
    await loginButton.click();

    await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    const dashboardElement = page.getByText(/Panel administrativo|Bienvenido|Resumen operativo/i).first();
    await expect(dashboardElement).toBeVisible({ timeout: 15000 });
  });

  test('2. Navegar a Productos', async () => {
    const productosNav = page.locator('.dashboard-nav-item', { hasText: /Productos/i })
      .or(page.getByRole('button', { name: /Productos/i }))
      .first();
    await productosNav.click();
    await page.waitForLoadState('networkidle');

    const productosTitle = page.getByText(/Gestión de Productos|Inventario de Productos/i).first();
    await expect(productosTitle).toBeVisible({ timeout: 15000 });

    const firstRow = page.locator('table.productos-table tbody tr, table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 15000 });
  });

  test('3. Navegar a Usuarios', async () => {
    const usuariosNav = page.locator('.dashboard-nav-item', { hasText: /Usuarios/i })
      .or(page.getByRole('button', { name: /Usuarios/i }))
      .first();
    await usuariosNav.click();
    await page.waitForLoadState('networkidle');

    const usuariosTitle = page.getByText(/Gestion de Usuarios|Usuarios Registrados/i).first();
    await expect(usuariosTitle).toBeVisible({ timeout: 15000 });

    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 15000 });
  });

  test('4. Navegar a Proveedores', async () => {
    const proveedoresNav = page.locator('.dashboard-nav-item', { hasText: /Proveedores/i })
      .or(page.getByRole('button', { name: /Proveedores/i }))
      .first();
    await proveedoresNav.click();
    await page.waitForLoadState('networkidle');

    const proveedoresTitle = page.getByText(/Proveedores|Listado de Proveedores/i).first();
    await expect(proveedoresTitle).toBeVisible({ timeout: 15000 });

    const tableOrList = page.locator('table').first();
    await expect(tableOrList).toBeVisible({ timeout: 15000 });
  });

  test('5. Navegar a Instituciones', async () => {
    const institucionesNav = page.locator('.dashboard-nav-item', { hasText: /Instituciones/i })
      .or(page.getByRole('button', { name: /Instituciones/i }))
      .first();
    await institucionesNav.click();
    await page.waitForLoadState('networkidle');

    const institucionesTitle = page.getByText(/Mapa de Instituciones|Instituciones cargadas/i).first();
    await expect(institucionesTitle).toBeVisible({ timeout: 15000 });
  });

  test('6. Navegar a Movimientos', async () => {
    const movimientosNav = page.locator('.dashboard-nav-item', { hasText: /Movimientos/i })
      .or(page.getByRole('button', { name: /Movimientos/i }))
      .first();
    await movimientosNav.click();
    await page.waitForLoadState('networkidle');

    const movimientosTitle = page.getByText(/Registro de Movimientos|Historial de Movimientos/i).first();
    await expect(movimientosTitle).toBeVisible({ timeout: 15000 });
  });

  test('7. Navegar a Mi Cuenta', async () => {
    const miCuentaNav = page.locator('.dashboard-nav-item', { hasText: /Mi cuenta/i })
      .or(page.getByRole('button', { name: /Mi cuenta/i }))
      .first();
    await miCuentaNav.click();
    await page.waitForLoadState('networkidle');

    const miCuentaTitle = page.getByText(/Mi cuenta|Mis datos/i).first();
    await expect(miCuentaTitle).toBeVisible({ timeout: 15000 });
  });

  test('8. Logout funciona', async () => {
    const logoutBtn = page.locator('.dashboard-logout')
      .or(page.getByRole('button', { name: /Salir/i }))
      .first();
    await logoutBtn.click();
    await page.waitForLoadState('networkidle');

    // Al hacer logout puede redirigir a /login o a la raíz /
    await expect(page).toHaveURL(/.*(login|\/$)/, { timeout: 15000 });
  });
});
