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

  const admin = await get("SELECT id FROM users WHERE email = ?", ["admin@depo.local"]);
  if (!admin) {
    const hash = bcrypt.hashSync("Admin123!", 10);
    await run(
      "INSERT INTO users (nombre, email, password_hash, role, activo) VALUES (?, ?, ?, ?, 1)",
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
