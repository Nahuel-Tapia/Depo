const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");

const dbPath = path.join(__dirname, "..", "depo.sqlite");
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      cue TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'operador', 'consulta', 'directivo')),
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const usersSchema = await get(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'"
  );
  const usersSql = (usersSchema && usersSchema.sql) || "";

  if (usersSql && !usersSql.includes("'directivo'")) {
    await run("PRAGMA foreign_keys = OFF");
    await run("BEGIN TRANSACTION");
    try {
      await run(`
        CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin', 'operador', 'consulta', 'directivo')),
          activo INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await run(`
        INSERT INTO users_new (id, nombre, email, password_hash, role, activo, created_at)
        SELECT id, nombre, email, password_hash, role, activo, created_at FROM users
      `);

      await run("DROP TABLE users");
      await run("ALTER TABLE users_new RENAME TO users");
      await run("COMMIT");
    } catch (err) {
      await run("ROLLBACK").catch(() => {});
      await run("PRAGMA foreign_keys = ON");
      throw err;
    }
    await run("PRAGMA foreign_keys = ON");
  }

  await run("ALTER TABLE users ADD COLUMN cue TEXT;").catch(() => {});
  await run("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cue_unique ON users(cue) WHERE cue IS NOT NULL;").catch(() => {});
  await run("ALTER TABLE users ADD COLUMN institucion TEXT;").catch(() => {});

  await run(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'Insumos',
      descripcion TEXT,
      precio REAL NOT NULL DEFAULT 0,
      stock_actual INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add new columns if not exist
  await run("ALTER TABLE productos ADD COLUMN proveedor TEXT;").catch(() => {});
  await run("ALTER TABLE productos ADD COLUMN tipo TEXT NOT NULL DEFAULT 'Insumos';").catch(() => {});

  await run(`
    CREATE TABLE IF NOT EXISTS movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'salida')),
      cantidad INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      motivo TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (producto_id) REFERENCES productos(id),
      FOREIGN KEY (usuario_id) REFERENCES users(id)
    )
  `);

  // Add new columns if not exist
  await run("ALTER TABLE movimientos ADD COLUMN proveedor TEXT;").catch(() => {});
  await run("ALTER TABLE movimientos ADD COLUMN cue TEXT;").catch(() => {});
  await run("ALTER TABLE movimientos ADD COLUMN pedido_id INTEGER;").catch(() => {});
  await run("CREATE UNIQUE INDEX IF NOT EXISTS idx_movimientos_pedido_unique ON movimientos(pedido_id) WHERE pedido_id IS NOT NULL;").catch(() => {});

  await run(`
    CREATE TABLE IF NOT EXISTS ajustes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      cantidad_anterior INTEGER NOT NULL,
      cantidad_nueva INTEGER NOT NULL,
      motivo TEXT NOT NULL,
      usuario_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (producto_id) REFERENCES productos(id),
      FOREIGN KEY (usuario_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      entidad TEXT NOT NULL,
      accion TEXT NOT NULL,
      id_registro INTEGER,
      cambios TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      producto_id INTEGER NOT NULL,
      cantidad INTEGER NOT NULL,
      institucion TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'aprobado', 'rechazado', 'entregado')),
      notas TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES users(id),
      FOREIGN KEY (producto_id) REFERENCES productos(id)
    )
  `);

  // Tabla de instituciones/escuelas
  await run(`
    CREATE TABLE IF NOT EXISTS instituciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cue TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      direccion TEXT,
      localidad TEXT,
      departamento TEXT,
      telefono TEXT,
      email TEXT,
      nivel TEXT CHECK(nivel IN ('inicial', 'primario', 'secundario', 'superior', 'especial', 'adultos', 'otro')),
      tipo TEXT CHECK(tipo IN ('publica', 'privada', 'municipal')) DEFAULT 'publica',
      matriculados INTEGER NOT NULL DEFAULT 0,
      factor_asignacion REAL NOT NULL DEFAULT 1.0,
      activo INTEGER NOT NULL DEFAULT 1,
      notas TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de asignaciones de stock por institución
  await run(`
    CREATE TABLE IF NOT EXISTS asignaciones_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institucion_id INTEGER NOT NULL,
      producto_id INTEGER NOT NULL,
      cantidad_asignada INTEGER NOT NULL DEFAULT 0,
      cantidad_entregada INTEGER NOT NULL DEFAULT 0,
      periodo TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (institucion_id) REFERENCES instituciones(id),
      FOREIGN KEY (producto_id) REFERENCES productos(id),
      UNIQUE(institucion_id, producto_id, periodo)
    )
  `);

  const admin = await get("SELECT id FROM users WHERE email = ?", ["admin@depo.local"]);
  if (!admin) {
    const hash = bcrypt.hashSync("Admin123!", 10);
    await run(
      "INSERT OR IGNORE INTO users (nombre, email, password_hash, role, activo) VALUES (?, ?, ?, ?, 1)",
      ["Administrador Inicial", "admin@depo.local", hash, "admin"]
    );
  }
}

module.exports = {
  db,
  run,
  get,
  all,
  initDb
};
