const express = require("express");
const bcrypt = require("bcryptjs");
const { all, get, run } = require("../db");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();
const VALID_ROLES = ["admin", "directivo", "operador", "consulta"];

function normalizeCue(cue) {
  if (!cue) return null;
  const value = String(cue).replace(/\D/g, "");
  return value || null;
}

router.use(authenticate);

router.get("/me", (req, res) => {
  return res.json({ user: req.user });
});

router.get("/", authorizePermissions(PERMISSIONS.USERS_READ), async (req, res) => {
  try {
    const users = await all(
      "SELECT id, nombre, email, cue, role, activo, created_at FROM users ORDER BY id DESC"
    );
    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ error: "No se pudo listar usuarios" });
  }
});

router.post("/", authorizePermissions(PERMISSIONS.USERS_CREATE), async (req, res) => {
  try {
    const { nombre, email, cue, password, role } = req.body;
    const cueNormalized = normalizeCue(cue);
    if (!nombre || !email || !password || !role) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: "Rol inválido" });
    }

    const existing = await get("SELECT id FROM users WHERE email = ?", [email]);
    if (existing) {
      return res.status(409).json({ error: "El email ya existe" });
    }

    if (cueNormalized) {
      const existingCue = await get("SELECT id FROM users WHERE cue = ?", [cueNormalized]);
      if (existingCue) {
        return res.status(409).json({ error: "El CUE ya existe" });
      }
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await run(
      "INSERT INTO users (nombre, email, cue, password_hash, role, activo) VALUES (?, ?, ?, ?, ?, 1)",
      [nombre, email, cueNormalized, hash, role]
    );

    return res.status(201).json({ id: result.lastID });
  } catch (err) {
    return res.status(500).json({ error: "No se pudo crear el usuario" });
  }
});

router.patch(
  "/:id/role",
  authorizePermissions(PERMISSIONS.USERS_ROLE_UPDATE),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: "Rol inválido" });
      }

      await run("UPDATE users SET role = ? WHERE id = ?", [role, id]);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: "No se pudo actualizar el rol" });
    }
  }
);

router.patch(
  "/:id/active",
  authorizePermissions(PERMISSIONS.USERS_STATUS_UPDATE),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { activo } = req.body;

      await run("UPDATE users SET activo = ? WHERE id = ?", [activo ? 1 : 0, id]);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: "No se pudo actualizar estado" });
    }
  }
);

router.delete("/:id", authorizePermissions(PERMISSIONS.USERS_DELETE), async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }

    if (req.user && Number(req.user.id) === userId) {
      return res.status(400).json({ error: "No podés eliminar tu propio usuario" });
    }

    const existing = await get("SELECT id, role FROM users WHERE id = ?", [userId]);
    if (!existing) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const hasMovimientos = await get("SELECT id FROM movimientos WHERE usuario_id = ? LIMIT 1", [userId]);
    const hasAjustes = await get("SELECT id FROM ajustes WHERE usuario_id = ? LIMIT 1", [userId]);
    const hasAuditoria = await get("SELECT id FROM auditoria WHERE usuario_id = ? LIMIT 1", [userId]);

    if (hasMovimientos || hasAjustes || hasAuditoria) {
      return res.status(409).json({
        error: "No se puede eliminar: el usuario tiene historial asociado"
      });
    }

    await run("DELETE FROM users WHERE id = ?", [userId]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "No se pudo eliminar usuario" });
  }
});

module.exports = router;
