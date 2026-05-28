const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const dbConfig = require('../backend/src/config/database');
const pool = new Pool(dbConfig);

const SCREENSHOT_DIR = 'C:\\Users\\Docente\\.gemini\\antigravity\\brain\\88e59a9c-7099-40ad-8ec0-e608a0327db2';

test.setTimeout(180000); // 3 minutes timeout

test('E2E Escuela Sede Flow Simulation', async ({ page }) => {
  console.log('--- STARTING E2E BRWOSER SIMULATION FOR ESCUELA SEDE ---');

  let pedidoId = null;
  let solicitudId = null;
  let createdDepSedeId = null;
  let createdLoteId = null;
  let productoId = null;

  // 1. SETUP DATABASE DATA PROGRAMMATICALLY BEFORE SIMULATION
  console.log('[Setup] Preparing test database records...');
  
  // Get peripheral school (Sarmiento) and Sede (Cabecera)
  const sarmientoRes = await pool.query("SELECT id_institucion, nombre, departamento FROM institucion WHERE cue = '700000101'");
  const sarmiento = sarmientoRes.rows[0];
  if (!sarmiento) {
    throw new Error("Sarmiento school (CUE 700000101) not found in database. Please run test seeds first.");
  }
  const cabeceraRes = await pool.query("SELECT id_institucion, nombre, departamento FROM institucion WHERE cue = '700000107'");
  const cabecera = cabeceraRes.rows[0];
  if (!cabecera) {
    throw new Error("Cabecera school (CUE 700000107) not found in database. Please run test seeds first.");
  }

  // Get product
  const prodRes = await pool.query("SELECT id_producto, nombre FROM producto LIMIT 1");
  productoId = prodRes.rows[0].id_producto;
  const prodNombre = prodRes.rows[0].nombre;

  // Cleanup any lingering requests/orders/movements for Sarmiento to ensure clean slate
  console.log('[Setup] Deleting lingering Sarmiento records...');
  const oldSols = await pool.query("SELECT id FROM solicitud_retiro WHERE id_institucion = $1", [sarmiento.id_institucion]);
  const oldSolIds = oldSols.rows.map(r => r.id);
  if (oldSolIds.length > 0) {
    const movs1 = await pool.query("SELECT id_movimiento FROM solicitud_retiro_detalle WHERE id_solicitud_retiro = ANY($1) AND id_movimiento IS NOT NULL", [oldSolIds]);
    const movs2 = await pool.query("SELECT id_movimiento FROM pedido_entrega WHERE id_solicitud_retiro = ANY($1) AND id_movimiento IS NOT NULL", [oldSolIds]);
    const movIds = [...new Set([...movs1.rows.map(r => r.id_movimiento), ...movs2.rows.map(r => r.id_movimiento)])];
    
    await pool.query("DELETE FROM pedido_entrega WHERE id_solicitud_retiro = ANY($1)", [oldSolIds]);
    await pool.query("DELETE FROM solicitud_retiro_detalle WHERE id_solicitud_retiro = ANY($1)", [oldSolIds]);
    await pool.query("DELETE FROM solicitud_retiro WHERE id = ANY($1)", [oldSolIds]);
    if (movIds.length > 0) {
      await pool.query("DELETE FROM movimiento_stock WHERE id_movimiento = ANY($1)", [movIds]);
    }
  }

  const oldPeds = await pool.query("SELECT id_pedido FROM pedido WHERE id_institucion = $1", [sarmiento.id_institucion]);
  const oldPedIds = oldPeds.rows.map(r => r.id_pedido);
  if (oldPedIds.length > 0) {
    await pool.query("DELETE FROM detalle_pedido WHERE id_pedido = ANY($1)", [oldPedIds]);
    await pool.query("DELETE FROM pedido_entrega WHERE id_pedido = ANY($1)", [oldPedIds]);
    await pool.query("DELETE FROM pedido WHERE id_pedido = ANY($1)", [oldPedIds]);
  }

  await pool.query("DELETE FROM distribucion_lote_item WHERE id_institucion = $1", [sarmiento.id_institucion]);

  // Set stock in Central
  await pool.query(`
    INSERT INTO stock_deposito (id_deposito, id_producto, cantidad)
    VALUES (1, $1, 100)
    ON CONFLICT (id_deposito, id_producto) DO UPDATE SET cantidad = 100
  `, [productoId]);

  // Clean old virtual deposits/lotes
  const prevDeps = await pool.query("SELECT id_deposito FROM deposito WHERE id_institucion = $1 AND tipo_deposito = 'ESCUELA_SEDE'", [cabecera.id_institucion]);
  for (const row of prevDeps.rows) {
    await pool.query("DELETE FROM movimiento_stock WHERE id_deposito = $1", [row.id_deposito]);
    await pool.query("DELETE FROM stock_deposito WHERE id_deposito = $1", [row.id_deposito]);
    await pool.query("DELETE FROM distribucion_lote_item WHERE lote_id IN (SELECT id FROM distribucion_lote WHERE id_deposito = $1)", [row.id_deposito]);
    await pool.query("DELETE FROM distribucion_lote WHERE id_deposito = $1", [row.id_deposito]);
    await pool.query("DELETE FROM deposito WHERE id_deposito = $1", [row.id_deposito]);
  }

  // Create approved annual order for Sarmiento
  const pedRes = await pool.query(`
    INSERT INTO pedido (id_institucion, id_usuario_solicitante, estado, tipo, aprobado_director_area, fecha_creacion)
    VALUES ($1, 14, 'aprobado', 'anual', true, NOW())
    RETURNING id_pedido
  `, [sarmiento.id_institucion]);
  pedidoId = pedRes.rows[0].id_pedido;

  await pool.query(`
    INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad_solicitada)
    VALUES ($1, $2, 10)
  `, [pedidoId, productoId]);

  // Create pending request marked for shipping to CAPITAL
  const solRes = await pool.query(`
    INSERT INTO solicitud_retiro (id_pedido, id_institucion, id_usuario_solicitante, fecha_retiro, retira_tipo, estado, solicitar_envio, departamento_envio, created_at)
    VALUES ($1, $2, 14, CURRENT_DATE + 5, 'directivo', 'pendiente', true, $3, NOW())
    RETURNING id
  `, [pedidoId, sarmiento.id_institucion, sarmiento.departamento.toUpperCase()]);
  solicitudId = solRes.rows[0].id;

  await pool.query(`
    INSERT INTO solicitud_retiro_detalle (id_solicitud_retiro, id_producto, cantidad_solicitada, cantidad_entregada)
    VALUES ($1, $2, 5, 0)
  `, [solicitudId, productoId]);

  console.log(`[Setup] Setup complete. Solicitud ID: #${solicitudId}, Producto: "${prodNombre}"`);

  // Handle browser confirmation dialogs automatically
  page.on('dialog', async dialog => {
    console.log(`[Dialog] Message: ${dialog.message()}`);
    await dialog.accept();
  });

  // 2. NAVIGATE TO FRONTEND & LOGIN
  console.log('--- BROWSER: Navigating to login page ---');
  await page.goto('http://localhost:5173');
  await page.waitForSelector('input[type="text"]');
  
  await page.fill('input[type="text"]', 'operador@depo.local');
  await page.fill('input[type="password"]', '111111');
  await page.click('button[type="submit"]');

  // Wait for login dashboard to load
  await page.waitForSelector('button.dashboard-logout');
  console.log('Operator logged in.');

  // 3. GO TO DISTRIBUCION A ESCUELAS
  console.log('--- BROWSER: Navigating to Distribución a Escuelas ---');
  await page.click('button:has-text("Distribucion a Escuelas")');
  await page.waitForTimeout(2000);

  // Click Envíos por Departamento tab
  await page.click('button:has-text("Envíos por Departamento")');
  await page.waitForTimeout(2000);

  // Click "Ver Detalle y Armar Egreso" for CAPITAL department
  console.log('Clicking on CAPITAL department detail...');
  await page.click('tr:has-text("CAPITAL") button:has-text("Ver Detalle y Armar Egreso")');
  await page.waitForSelector('input[name="tipoEnvio"]');

  // Select "Agrupado en Escuela Sede"
  console.log('Selecting methodology: Agrupado en Escuela Sede...');
  await page.click('input[name="tipoEnvio"][value="escuela_sede"]');
  await page.waitForTimeout(1000);

  // Select Sede dropdown option (Escuela Integral Republica)
  console.log('Selecting Sede: Escuela Integral Republica...');
  await page.selectOption('select:has-text("Seleccionar Institución Sede")', { value: String(cabecera.id_institucion) });

  // Fill delivery quantity (5 units for our request)
  console.log(`Filling quantity for Solicitud #${solicitudId}...`);
  await page.fill(`input[placeholder="0-5"]`, '5');
  await page.waitForTimeout(1000);

  // Take screenshot of the filled Sede egreso form
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_egreso_sede_form.png'), fullPage: true });
  console.log('Screenshot 1 (Egreso Sede Form) saved.');

  // Click "Confirmar Egreso por Departamento"
  console.log('Submitting egreso to Sede...');
  await page.click('button:has-text("Confirmar Egreso por Departamento")');
  
  // Wait for success message to appear in UI
  await page.waitForSelector('div.msg-success');
  await page.waitForTimeout(2000);

  // Take screenshot of the success screen
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_egreso_sede_success.png'), fullPage: true });
  console.log('Screenshot 2 (Egreso Sede Success) saved.');

  // Get the created Sede deposit and lote for cleanup verification
  const loteRes = await pool.query("SELECT id, id_deposito FROM distribucion_lote ORDER BY id DESC LIMIT 1");
  createdLoteId = loteRes.rows[0].id;
  createdDepSedeId = loteRes.rows[0].id_deposito;

  // 4. VERIFY EN ENTREGAS DESDE SEDE
  console.log('--- BROWSER: Navigating to Entregas desde Sede ---');
  await page.click('button:has-text("Entregas desde Sede")');
  await page.waitForTimeout(2000);

  // Verify that the solicitud is in the list
  const rowLocator = page.locator(`tr:has-text("#${solicitudId}")`);
  await expect(rowLocator).toBeVisible();

  // Take screenshot of the list of items in Sede
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_entregas_desde_sede_list.png'), fullPage: true });
  console.log('Screenshot 3 (Entregas desde Sede List) saved.');

  // Click "Confirmar Entrega" (triggers the alert dialog, which is accepted automatically by page.on('dialog'))
  console.log('Confirming final delivery from Sede...');
  await page.click(`tr:has-text("#${solicitudId}") button:has-text("Confirmar Entrega")`);

  // Wait for success status update
  await page.waitForSelector('div.msg-success');
  await page.waitForTimeout(2000);

  // Take final screenshot showing successful delivery
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_entrega_final_success.png'), fullPage: true });
  console.log('Screenshot 4 (Entrega Final Success) saved.');

  // Logout
  await page.click('button.dashboard-logout');
  console.log('--- E2E BROWSER SIMULATION COMPLETED SUCCESSFULLY ---');

  // 5. DATABASE CLEANUP
  console.log('[Cleanup] Removing test records...');
  if (solicitudId) {
    await pool.query("DELETE FROM solicitud_retiro_detalle WHERE id_solicitud_retiro = $1", [solicitudId]);
    await pool.query("DELETE FROM solicitud_retiro WHERE id = $1", [solicitudId]);
  }
  if (pedidoId) {
    await pool.query("DELETE FROM detalle_pedido WHERE id_pedido = $1", [pedidoId]);
    await pool.query("DELETE FROM pedido WHERE id_pedido = $1", [pedidoId]);
  }
  if (createdLoteId) {
    await pool.query("DELETE FROM distribucion_lote_item WHERE lote_id = $1", [createdLoteId]);
    await pool.query("DELETE FROM distribucion_lote WHERE id = $1", [createdLoteId]);
  }
  if (createdDepSedeId) {
    await pool.query("DELETE FROM movimiento_stock WHERE id_deposito = $1", [createdDepSedeId]);
    await pool.query("DELETE FROM stock_deposito WHERE id_deposito = $1", [createdDepSedeId]);
    await pool.query("DELETE FROM deposito WHERE id_deposito = $1", [createdDepSedeId]);
  }
  console.log('[Cleanup] Cleanup complete. Database restored.');
  
  await pool.end();
});
