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

async function main() {
  const email = "admin@depo.local";
  const password = "Admin123!";
  const hash = await bcrypt.hash(password, 10);

  const existing = await get("SELECT id FROM users WHERE email = ?", [email]);

  if (existing) {
    await run(
      "UPDATE users SET nombre = ?, password_hash = ?, role = 'admin', activo = 1 WHERE id = ?",
      ["Administrador Inicial", hash, existing.id]
    );
    console.log("Admin actualizado.");
  } else {
    await run(
      "INSERT INTO users (nombre, email, password_hash, role, activo) VALUES (?, ?, ?, 'admin', 1)",
      ["Administrador Inicial", email, hash]
    );
    console.log("Admin creado.");
  }

  console.log("Credenciales:");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

main()
  .catch((err) => {
    console.error("No se pudo resetear admin", err);
    process.exitCode = 1;
  })
  .finally(() => {
    db.close();
  });
