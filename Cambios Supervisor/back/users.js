const express = require("express");
const bcrypt = require("bcryptjs");
const { all, get, run } = require("../db.pg");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();
const VALID_ROLES = ["admin", "directivo", "operador", "consulta", "supervisor"];

function normalizeDni(dni) {
  if (!dni) return null;
  const value = String(dni).replace(/\D/g, "");
  return value || null;
}

router.use(authenticate);

router.get("/me", (req, res) => {
  return res.json({ user: req.user });
});

router.get("/", authorizePermissions(PERMISSIONS.USERS_READ), async (req, res) => {
  try {
    const users = await all(
      "SELECT id_usuario as id, nombre, apellido, email, dni, role, activo, created_at FROM usuario ORDER BY id_usuario DESC"
    );
    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ error: "No se pudo listar usuarios" });
  }
});

router.post("/", authorizePermissions(PERMISSIONS.USERS_CREATE), async (req, res) => {
  try {
    const { nombre, apellido, email, dni, password, role, telefono, institucion } = req.body;
    const dniNormalized = normalizeDni(dni);
    
    // Validar que institucion sea un número válido o null
    const institucionId = institucion && !isNaN(parseInt(institucion)) ? parseInt(institucion) : null;
    
    if (!nombre || !email || !password || !role) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: "Rol inválido" });
    }

    if (role === "directivo" && !institucionId) {
      return res.status(400).json({ error: "La institución es obligatoria para rol directivo" });
    }

    const existing = await get("SELECT id_usuario FROM usuario WHERE email = ?", [email]);
    if (existing) {
      return res.status(409).json({ error: "El email ya existe" });
    }

    if (dniNormalized) {
      const existingDni = await get("SELECT id_usuario FROM usuario WHERE dni = ?", [dniNormalized]);
      if (existingDni) {
        return res.status(409).json({ error: "El DNI ya existe" });
      }
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await run(
      "INSERT INTO usuario (nombre, apellido, email, dni, password, telefono, id_institucion, role, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)",
      [nombre, apellido || null, email, dniNormalized, hash, telefono || null, institucionId, role]
    );

    return res.status(201).json({ id: result.lastID });
  } catch (err) {
    console.error("Error creando usuario:", err);
    return res.status(500).json({ error: "No se pudo crear el usuario" });
  }
});

router.patch(
  "/:id/role",
  authorizePermissions(PERMISSIONS.USERS_ROLE_UPDATE),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { role, institucion } = req.body;

      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: "Rol inválido" });
      }

      const user = await get("SELECT id_usuario, id_institucion FROM usuario WHERE id_usuario = ?", [id]);
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      const finalInstitucion = institucion || user.id_institucion || null;

      if (role === "directivo" && !finalInstitucion) {
        return res.status(400).json({ error: "La institución es obligatoria para rol directivo" });
      }

      await run("UPDATE usuario SET role = ?, id_institucion = ? WHERE id_usuario = ?", [role, finalInstitucion, id]);
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

      await run("UPDATE usuario SET activo = ? WHERE id_usuario = ?", [activo ? true : false, id]);
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

    const existing = await get("SELECT id_usuario, role FROM usuario WHERE id_usuario = ?", [userId]);
    if (!existing) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Verificar si tiene registros asociados en otras tablas
    // Por ahora permitimos eliminar

    await run("DELETE FROM usuario WHERE id_usuario = ?", [userId]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "No se pudo eliminar usuario" });
  }
});

module.exports = router;
