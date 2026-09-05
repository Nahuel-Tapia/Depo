require('dotenv').config();
const { get, run } = require('../backend/src/db.pg');
const pedidoService = require('../backend/src/services/pedidoService');
const entregaService = require('../backend/src/services/entregaService');

async function testFlow() {
  try {
    const directivo = await get("SELECT id_usuario, id_institucion FROM usuario WHERE role = 'directivo' LIMIT 1");
    const directivoUserId = directivo ? directivo.id_usuario : 2;

    // Reset pedido 6 to pendiente for clean test
    await run("UPDATE pedido SET estado = 'pendiente', aprobado_director_area = FALSE WHERE id_pedido = 6");
    console.log('Reset pedido 6 to pendiente');

    let supervisor = await get("SELECT id_usuario FROM usuario WHERE role = 'supervisor' LIMIT 1");
    if (!supervisor) {
      const supRes = await run("INSERT INTO usuario (nombre, email, password, role, activo) VALUES ('Supervisor Test', 'supervisor_test@depo.local', 'hash', 'supervisor', TRUE)");
      supervisor = { id_usuario: supRes.lastID };
    }

    await run("INSERT INTO supervisor_escuela_asignacion (supervisor_id, institucion_id) VALUES (?, 1) ON CONFLICT DO NOTHING", [supervisor.id_usuario]);

    const userSupervisor = { sub: supervisor.id_usuario, role: 'supervisor' };
    const userDirector = { sub: 1, role: 'director_area' };
    const userAdmin = { sub: 1, role: 'master' };

    console.log('\n--- 1. Check availability when state is pendiente ---');
    let disp1 = await entregaService.getProductosDisponiblesRetiro(directivoUserId);
    console.log('Available pedidos (expected 0):', disp1.map(p => p.id));

    console.log('\n--- 2. Supervisor approves Anual Pedido ---');
    await pedidoService.updateEstadoPedido(6, { estado: 'aprobado' }, userSupervisor);
    let dbAfterSup = await get("SELECT id_pedido, estado, aprobado_director_area FROM pedido WHERE id_pedido = 6");
    console.log('State after supervisor approval:', dbAfterSup);

    console.log('\n--- 3. Check availability after supervisor approval (expected 0, since pending director) ---');
    let disp2 = await entregaService.getProductosDisponiblesRetiro(directivoUserId);
    console.log('Available pedidos (expected 0):', disp2.map(p => p.id));

    console.log('\n--- 4. Director de Área approves Anual Pedido ---');
    await pedidoService.aprobarDirector(6, { decision: 'aceptar' }, userDirector);
    let dbAfterDir = await get("SELECT id_pedido, estado, aprobado_director_area FROM pedido WHERE id_pedido = 6");
    console.log('State after director approval:', dbAfterDir);

    console.log('\n--- 5. Check availability after director approval (expected [6]) ---');
    let disp3 = await entregaService.getProductosDisponiblesRetiro(directivoUserId);
    console.log('Available pedidos (expected [6]):', disp3.map(p => p.id));

    console.log('\n--- 6. Test Admin Direct Approval ---');
    await run("UPDATE pedido SET estado = 'pendiente', aprobado_director_area = FALSE WHERE id_pedido = 6");
    await pedidoService.updateEstadoPedido(6, { estado: 'aprobado' }, userAdmin);
    let dbAfterAdmin = await get("SELECT id_pedido, estado, aprobado_director_area FROM pedido WHERE id_pedido = 6");
    console.log('State after admin direct approval:', dbAfterAdmin);

    let disp4 = await entregaService.getProductosDisponiblesRetiro(directivoUserId);
    console.log('Available pedidos after admin direct approval (expected [6]):', disp4.map(p => p.id));

  } catch (err) {
    console.error('Error in testFlow:', err);
  }
}

testFlow();
