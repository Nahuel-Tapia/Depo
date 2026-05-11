const { pool, get, all, run } = require('../backend/src/db.pg');

(async () => {
  try {
    // Check which tables exist
    const tables = await all(
      "SELECT table_name FROM information_schema.tables WHERE table_name IN ('solicitud_retiro','solicitud_retiro_detalle','pedido_entrega') AND table_schema = 'public'"
    );
    console.log('Tables present:', tables.map(r => r.table_name));

    // Try ensureEntregasSchema manually
    await run(`
      CREATE TABLE IF NOT EXISTS pedido_entrega (
        id SERIAL PRIMARY KEY,
        id_pedido INT NOT NULL REFERENCES pedido(id_pedido) ON DELETE CASCADE,
        id_movimiento INT REFERENCES movimiento_stock(id_movimiento) ON DELETE SET NULL,
        id_producto INT NOT NULL REFERENCES producto(id_producto),
        cantidad_entregada INT NOT NULL,
        fecha_entrega TIMESTAMP DEFAULT NOW(),
        id_usuario INT REFERENCES usuario(id_usuario),
        observaciones TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('pedido_entrega OK');

    await run(`ALTER TABLE pedido_entrega ADD COLUMN IF NOT EXISTS id_solicitud_retiro INT`);
    console.log('alter pedido_entrega OK');

    await run(`
      CREATE TABLE IF NOT EXISTS solicitud_retiro (
        id SERIAL PRIMARY KEY,
        id_pedido INT NOT NULL REFERENCES pedido(id_pedido) ON DELETE CASCADE,
        id_institucion INT NOT NULL REFERENCES institucion(id_institucion),
        id_usuario_solicitante INT NOT NULL REFERENCES usuario(id_usuario),
        fecha_retiro DATE NOT NULL,
        retira_tipo VARCHAR(20) NOT NULL,
        retira_nombre VARCHAR(180),
        retira_dni VARCHAR(30),
        estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        id_usuario_acepta INT REFERENCES usuario(id_usuario),
        fecha_aceptacion TIMESTAMP,
        id_usuario_entrega INT REFERENCES usuario(id_usuario),
        fecha_entrega TIMESTAMP,
        observaciones TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('solicitud_retiro OK');

    await run(`
      CREATE TABLE IF NOT EXISTS solicitud_retiro_detalle (
        id SERIAL PRIMARY KEY,
        id_solicitud_retiro INT NOT NULL REFERENCES solicitud_retiro(id) ON DELETE CASCADE,
        id_producto INT NOT NULL REFERENCES producto(id_producto),
        cantidad_solicitada INT NOT NULL,
        cantidad_entregada INT,
        id_movimiento INT REFERENCES movimiento_stock(id_movimiento) ON DELETE SET NULL,
        UNIQUE (id_solicitud_retiro, id_producto)
      )
    `);
    console.log('solicitud_retiro_detalle OK');

    // Test insert into solicitud_retiro
    const u = await get('SELECT id_usuario, id_institucion FROM usuario WHERE role = $1 AND id_institucion IS NOT NULL LIMIT 1', ['directivo']);
    console.log('Test directivo user:', u);

    if (u) {
      const p = await get(`SELECT id_pedido, id_institucion FROM pedido WHERE estado = 'aprobado' AND aprobado_director_area = TRUE AND id_institucion = $1 LIMIT 1`, [u.id_institucion]);
      console.log('Test approved pedido:', p);
    }

  } catch (e) {
    console.error('ERROR:', e.message);
    console.error(e.stack);
  } finally {
    await pool.end();
  }
})();
