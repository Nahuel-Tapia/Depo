const express = require("express");
const bcrypt = require("bcryptjs");
const { all, get, run } = require("../db.pg");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");
const { roleExists, normalizeRoleName } = require("../services/roles");

const router = express.Router();

let schemaReady = false;
let schemaPromise = null;

async function ensureUsersSchema() {
  if (schemaReady) return;
  if (schemaPromise) {
    await schemaPromise;
    return;
  }

  schemaPromise = (async () => {
    await run(`
      ALTER TABLE usuario
      ADD COLUMN IF NOT EXISTS nivel_educativo VARCHAR(120)
    `);
    await run(`
      ALTER TABLE usuario
      ADD COLUMN IF NOT EXISTS director_area_id INT REFERENCES usuario(id_usuario)
    `);
    await run(`
      ALTER TABLE usuario
      ADD COLUMN IF NOT EXISTS jurisdiccion VARCHAR(120)
    `);
    schemaReady = true;
  })();

  try {
    await schemaPromise;
  } finally {
    schemaPromise = null;
  }
}

function getAuthUserId(req) {
  const raw = req?.user?.sub ?? req?.user?.id;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function normalizeDni(dni) {
  if (!dni) return null;
  const value = String(dni).replace(/\D/g, "");
  return value || null;
}

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function parseOptionalId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function validationError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function validateRoleAssignment({
  normalizedRole,
  institucion,
  nivel,
  director_area_id,
  jurisdiccion,
  fallbackInstitucion = null
}) {
  const institucionId = parseOptionalId(institucion);
  const nivelEducativo = normalizeText(nivel);
  const directorAreaId = parseOptionalId(director_area_id);
  const jurisdiccionValue = normalizeText(jurisdiccion);

  const finalInstitucion = normalizedRole === "directivo"
    ? (institucionId || fallbackInstitucion || null)
    : null;

  if (normalizedRole === "directivo" && !finalInstitucion) {
    throw validationError("La institucion es obligatoria para rol directivo");
  }

  if (normalizedRole === "director_area" && !nivelEducativo) {
    throw validationError("El nivel educativo es obligatorio para Director de Area");
  }

  if (normalizedRole === "supervisor") {
    if (!nivelEducativo) {
      throw validationError("El nivel educativo es obligatorio para Supervisor");
    }
    if (!directorAreaId) {
      throw validationError("El Area de Direccion es obligatoria para Supervisor");
    }
    if (!jurisdiccionValue) {
      throw validationError("La jurisdiccion es obligatoria para Supervisor");
    }

    const directorArea = await get(
      `SELECT id_usuario, NULLIF(BTRIM(nivel_educativo), '') AS nivel_educativo
       FROM usuario
       WHERE id_usuario = ? AND role = 'director_area' AND activo = TRUE`,
      [directorAreaId]
    );

    if (!directorArea) {
      throw validationError("El Area seleccionada no corresponde a una Direccion de Area activa");
    }

    if ((directorArea.nivel_educativo || "").toLowerCase() !== nivelEducativo.toLowerCase()) {
      throw validationError("El nivel del supervisor debe coincidir con el nivel de la Direccion de Area seleccionada");
    }
  }

  return {
    institucionId: finalInstitucion,
    nivelEducativo: ["director_area", "supervisor"].includes(normalizedRole) ? nivelEducativo : null,
    directorAreaId: normalizedRole === "supervisor" ? directorAreaId : null,
    jurisdiccionValue: normalizedRole === "supervisor" ? jurisdiccionValue : null
  };
}

router.use(authenticate);

router.get("/me", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: "No autenticado" });

    const user = await get(
      "SELECT id_usuario as id, nombre, apellido, email, dni, role, telefono, id_institucion, nivel_educativo, director_area_id, jurisdiccion FROM usuario WHERE id_usuario = ?",
      [userId]
    );
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    let institucion = null;
    if (String(user.role || "").toLowerCase() === "directivo" && user.id_institucion) {
      const row = await get(
        "SELECT id_institucion as id, nombre, cue FROM institucion WHERE id_institucion = ?",
        [user.id_institucion]
      );
      if (row) institucion = row;
    }

    return res.json({
      user: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        dni: user.dni,
        role: user.role,
        telefono: user.telefono,
        institucion,
        nivel_educativo: user.nivel_educativo || null,
        director_area_id: user.director_area_id || null,
        jurisdiccion: user.jurisdiccion || null
      }
    });
  } catch (err) {
    return res.status(500).json({ error: "No se pudo obtener el perfil" });
  }
});

router.patch("/me", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: "No autenticado" });

    const { nombre, apellido, email, telefono } = req.body;

    const existing = await get(
      "SELECT id_usuario as id, email, role, id_institucion FROM usuario WHERE id_usuario = ?",
      [userId]
    );
    if (!existing) return res.status(404).json({ error: "Usuario no encontrado" });

    const finalNombre = typeof nombre === "string" ? nombre.trim() : null;
    const finalApellido = typeof apellido === "string" ? apellido.trim() : null;
    const finalTelefono = typeof telefono === "string" ? telefono.trim() : null;
    const finalEmail = typeof email === "string" ? email.trim().toLowerCase() : null;

    if (finalEmail && !finalEmail.includes("@")) {
      return res.status(400).json({ error: "El email no es válido" });
    }

    if (finalEmail && finalEmail !== String(existing.email || "").toLowerCase()) {
      const other = await get(
        "SELECT id_usuario FROM usuario WHERE LOWER(email) = ? AND id_usuario <> ?",
        [finalEmail, userId]
      );
      if (other) return res.status(409).json({ error: "Ya existe un usuario con ese email" });
    }

    await run(
      "UPDATE usuario SET nombre = COALESCE(?, nombre), apellido = COALESCE(?, apellido), email = COALESCE(?, email), telefono = COALESCE(?, telefono) WHERE id_usuario = ?",
      [finalNombre || null, finalApellido || null, finalEmail || null, finalTelefono || null, userId]
    );

    const updated = await get(
      "SELECT id_usuario as id, nombre, apellido, email, dni, role, telefono, id_institucion, nivel_educativo, director_area_id, jurisdiccion FROM usuario WHERE id_usuario = ?",
      [userId]
    );

    let institucion = null;
    if (String(updated.role || "").toLowerCase() === "directivo" && updated.id_institucion) {
      const row = await get(
        "SELECT id_institucion as id, nombre, cue FROM institucion WHERE id_institucion = ?",
        [updated.id_institucion]
      );
      if (row) institucion = row;
    }

    return res.json({
      ok: true,
      user: {
        id: updated.id,
        nombre: updated.nombre,
        apellido: updated.apellido,
        email: updated.email,
        dni: updated.dni,
        role: updated.role,
        telefono: updated.telefono,
        institucion,
        nivel_educativo: updated.nivel_educativo || null,
        director_area_id: updated.director_area_id || null,
        jurisdiccion: updated.jurisdiccion || null
      }
    });
  } catch (err) {
    return res.status(500).json({ error: "No se pudo actualizar el perfil" });
  }
});

router.patch("/me/password", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: "No autenticado" });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Debe ingresar contraseña actual y nueva" });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }

    const user = await get("SELECT password FROM usuario WHERE id_usuario = ?", [userId]);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const ok = await bcrypt.compare(String(currentPassword), user.password);
    if (!ok) return res.status(401).json({ error: "La contraseña actual es incorrecta" });

    const hash = await bcrypt.hash(String(newPassword), 10);
    await run("UPDATE usuario SET password = ? WHERE id_usuario = ?", [hash, userId]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "No se pudo cambiar la contraseña" });
  }
});

router.get("/", authorizePermissions(PERMISSIONS.USERS_READ), async (req, res) => {
  try {
    await ensureUsersSchema();
    const users = await all(
      `SELECT u.id_usuario as id,
              u.nombre,
              u.apellido,
              u.email,
              u.dni,
              u.role,
              u.activo,
              u.created_at,
              u.nivel_educativo,
              u.director_area_id,
              u.jurisdiccion,
              da.nombre AS director_area_nombre,
              da.apellido AS director_area_apellido
       FROM usuario u
       LEFT JOIN usuario da ON da.id_usuario = u.director_area_id
       ORDER BY u.id_usuario DESC`
    );
    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ error: "No se pudo listar usuarios" });
  }
});

router.post("/", authorizePermissions(PERMISSIONS.USERS_CREATE), async (req, res) => {
  try {
    await ensureUsersSchema();

    const { nombre, apellido, email, dni, password, role, telefono, institucion, nivel, director_area_id, jurisdiccion } = req.body;
    const normalizedRole = normalizeRoleName(role);
    const dniNormalized = normalizeDni(dni);
    const emailNormalized = normalizeText(email)?.toLowerCase() || "";

    if (!nombre || !email || !password || !role) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    if (!(await roleExists(normalizedRole))) {
      return res.status(400).json({ error: "Rol invalido" });
    }

    const assignment = await validateRoleAssignment({
      normalizedRole,
      institucion,
      nivel,
      director_area_id,
      jurisdiccion
    });

    const existing = await get("SELECT id_usuario FROM usuario WHERE LOWER(email) = ?", [emailNormalized]);
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
      "INSERT INTO usuario (nombre, apellido, email, dni, password, telefono, id_institucion, role, activo, nivel_educativo, director_area_id, jurisdiccion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?, ?)",
      [
        nombre,
        apellido || null,
        emailNormalized,
        dniNormalized,
        hash,
        telefono || null,
        assignment.institucionId,
        normalizedRole,
        assignment.nivelEducativo,
        assignment.directorAreaId,
        assignment.jurisdiccionValue
      ]
    );

    return res.status(201).json({ id: result.lastID });
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Error creando usuario:", err);
    return res.status(500).json({ error: "No se pudo crear el usuario" });
  }
});

router.patch(
  "/:id/role",
  authorizePermissions(PERMISSIONS.USERS_ROLE_UPDATE),
  async (req, res) => {
    try {
      await ensureUsersSchema();

      const { id } = req.params;
      const { role, institucion, nivel, director_area_id, jurisdiccion } = req.body;
      const normalizedRole = normalizeRoleName(role);

      if (!(await roleExists(normalizedRole))) {
        return res.status(400).json({ error: "Rol invalido" });
      }

      const user = await get("SELECT id_usuario, id_institucion FROM usuario WHERE id_usuario = ?", [id]);
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      const assignment = await validateRoleAssignment({
        normalizedRole,
        institucion,
        nivel,
        director_area_id,
        jurisdiccion,
        fallbackInstitucion: user.id_institucion || null
      });

      await run(
        "UPDATE usuario SET role = ?, id_institucion = ?, nivel_educativo = ?, director_area_id = ?, jurisdiccion = ? WHERE id_usuario = ?",
        [
          normalizedRole,
          assignment.institucionId,
          assignment.nivelEducativo,
          assignment.directorAreaId,
          assignment.jurisdiccionValue,
          id
        ]
      );
      return res.json({ ok: true });
    } catch (err) {
      if (err?.status) {
        return res.status(err.status).json({ error: err.message });
      }
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
      return res.status(400).json({ error: "ID invalido" });
    }

    if (req.user && Number(req.user.id) === userId) {
      return res.status(400).json({ error: "No podes eliminar tu propio usuario" });
    }

    const existing = await get("SELECT id_usuario, role FROM usuario WHERE id_usuario = ?", [userId]);
    if (!existing) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const pedidosAsociados = await get(
      "SELECT COUNT(*)::int AS total FROM pedido WHERE id_usuario_solicitante = ?",
      [userId]
    );
    if ((pedidosAsociados?.total || 0) > 0) {
      return res.status(409).json({
        error: "No se puede eliminar el usuario porque tiene pedidos asociados. Desactivalo en lugar de eliminarlo."
      });
    }

    await run("DELETE FROM usuario WHERE id_usuario = ?", [userId]);
    return res.json({ ok: true });
  } catch (err) {
    if (err && String(err.code) === "23503") {
      return res.status(409).json({
        error: "No se puede eliminar el usuario porque tiene registros relacionados en el sistema."
      });
    }
    return res.status(500).json({ error: "No se pudo eliminar usuario" });
  }
});

module.exports = router;
