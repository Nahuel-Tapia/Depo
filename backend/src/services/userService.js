const { all, get, run } = require("../db.pg");
const bcrypt = require("bcryptjs");
const { roleExists, normalizeRoleName } = require("./roles");
const { isAdminLikeRole } = require("../middleware/auth");

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

function normalizeLevel(value) {
  return normalizeText(value)?.toLowerCase() || null;
}

async function getDirectorAreaCreatorContext(authUserId, authUserRole) {
  if (!authUserId || String(authUserRole || "").toLowerCase() !== "director_area") {
    return null;
  }

  const creator = await get(
    `SELECT id_usuario, role, activo, NULLIF(BTRIM(nivel_educativo), '') AS nivel_educativo
     FROM usuario
     WHERE id_usuario = ?`,
    [authUserId]
  );

  if (!creator || creator.role !== "director_area" || creator.activo !== true) {
    throw validationError("El Director de Area creador no es valido o no esta activo", 403);
  }

  return {
    id: authUserId,
    nivelEducativo: normalizeText(creator.nivel_educativo)
  };
}

async function getManagedSupervisorForDirector(authUserId, authUserRole, targetUserId) {
  const directorContext = await getDirectorAreaCreatorContext(authUserId, authUserRole);
  if (!directorContext) return null;

  return get(
    `SELECT id_usuario, role, nivel_educativo, director_area_id, activo
     FROM usuario
     WHERE id_usuario = ?
       AND role = 'supervisor'
       AND director_area_id = ?
       AND LOWER(COALESCE(nivel_educativo, '')) = LOWER(COALESCE(?, ''))`,
    [targetUserId, directorContext.id, directorContext.nivelEducativo]
  );
}

async function ensureUserAccessForUpdate(authUserId, authUserRole, targetUserId) {
  const authRole = String(authUserRole || "").toLowerCase();

  if (isAdminLikeRole(authRole)) {
    const existing = await get(
      "SELECT id_usuario, role, id_institucion, nivel_educativo, director_area_id, jurisdiccion FROM usuario WHERE id_usuario = ?",
      [targetUserId]
    );
    if (!existing) {
      throw validationError("Usuario no encontrado", 404);
    }
    return existing;
  }

  if (authRole === "director_area") {
    const managedSupervisor = await getManagedSupervisorForDirector(authUserId, authUserRole, targetUserId);
    if (!managedSupervisor) {
      const existing = await get("SELECT id_usuario FROM usuario WHERE id_usuario = ?", [targetUserId]);
      throw validationError(existing ? "No autorizado para editar este usuario" : "Usuario no encontrado", existing ? 403 : 404);
    }

    return {
      id_usuario: managedSupervisor.id_usuario,
      role: managedSupervisor.role,
      id_institucion: null,
      nivel_educativo: managedSupervisor.nivel_educativo,
      director_area_id: managedSupervisor.director_area_id,
      jurisdiccion: null
    };
  }

  throw validationError("No autorizado para editar usuarios", 403);
}

async function validateRoleAssignment({
  normalizedRole,
  institucion,
  nivel,
  director_area_id,
  fallbackInstitucion = null
}) {
  const institucionId = parseOptionalId(institucion);
  const nivelEducativo = normalizeText(nivel);
  const directorAreaId = parseOptionalId(director_area_id);

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
    directorAreaId: normalizedRole === "supervisor" ? directorAreaId : null
  };
}

async function getMe(userId) {
  if (!userId) {
    throw validationError("No autenticado", 401);
  }

  const user = await get(
    "SELECT id_usuario as id, nombre, apellido, email, dni, role, telefono, id_institucion, nivel_educativo, director_area_id FROM usuario WHERE id_usuario = ?",
    [userId]
  );
  if (!user) {
    throw validationError("Usuario no encontrado", 404);
  }

  let institucion = null;
  if (String(user.role || "").toLowerCase() === "directivo" && user.id_institucion) {
    const row = await get(
      "SELECT id_institucion as id, nombre, cue FROM institucion WHERE id_institucion = ?",
      [user.id_institucion]
    );
    if (row) institucion = row;
  }

  return {
    id: user.id,
    nombre: user.nombre,
    apellido: user.apellido,
    email: user.email,
    dni: user.dni,
    role: user.role,
    telefono: user.telefono,
    institucion,
    nivel_educativo: user.nivel_educativo || null,
    director_area_id: user.director_area_id || null
  };
}

async function updateMe(userId, { nombre, apellido, email, dni, telefono }) {
  if (!userId) {
    throw validationError("No autenticado", 401);
  }

  const current = await get("SELECT id_usuario, nombre, apellido, email, dni, telefono FROM usuario WHERE id_usuario = ?", [userId]);
  if (!current) {
    throw validationError("Usuario no encontrado", 404);
  }

  const finalNombre = normalizeText(nombre) || current.nombre;
  const finalApellido = normalizeText(apellido) || current.apellido;
  const finalEmail = email ? String(email).trim().toLowerCase() : current.email;
  const finalDni = normalizeDni(dni) || current.dni;
  const finalTelefono = normalizeText(telefono) || current.telefono;

  if (finalEmail && !finalEmail.includes("@")) {
    throw validationError("El email no es válido", 400);
  }

  if (finalEmail && finalEmail !== String(current.email || "").toLowerCase()) {
    const other = await get(
      "SELECT id_usuario FROM usuario WHERE LOWER(email) = ? AND id_usuario <> ?",
      [finalEmail, userId]
    );
    if (other) {
      throw validationError("Ya existe un usuario con ese email", 409);
    }
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

  return {
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
  };
}

async function updateMyPassword(userId, currentPassword, newPassword) {
  if (!userId) {
    throw validationError("No autenticado", 401);
  }
  if (!currentPassword || !newPassword) {
    throw validationError("Debe ingresar contraseña actual y nueva", 400);
  }
  if (String(newPassword).length < 6) {
    throw validationError("La contraseña debe tener al menos 6 caracteres", 400);
  }

  const user = await get("SELECT password FROM usuario WHERE id_usuario = ?", [userId]);
  if (!user) {
    throw validationError("Usuario no encontrado", 404);
  }

  const ok = await bcrypt.compare(String(currentPassword), user.password);
  if (!ok) {
    throw validationError("La contraseña actual es incorrecta", 401);
  }

  const hash = await bcrypt.hash(String(newPassword), 10);
  await run("UPDATE usuario SET password = ? WHERE id_usuario = ?", [hash, userId]);
  return true;
}

async function listUsers(authUserId, authUserRole) {
  const authRole = String(authUserRole || "").toLowerCase();
  let users = [];

  if (authRole === "director_area") {
    const directorContext = await getDirectorAreaCreatorContext(authUserId, authUserRole);
    if (!directorContext?.nivelEducativo) {
      return [];
    }

    users = await all(
      `SELECT u.id_usuario as id,
              u.nombre,
              u.apellido,
              u.email,
              u.dni,
              u.telefono,
              u.role,
              u.activo,
              u.created_at,
              u.nivel_educativo,
              u.director_area_id,
              da.nombre AS director_area_nombre,
              da.apellido AS director_area_apellido
       FROM usuario u
       LEFT JOIN usuario da ON da.id_usuario = u.director_area_id
       WHERE u.role = 'supervisor'
         AND u.director_area_id = ?
         AND LOWER(COALESCE(u.nivel_educativo, '')) = LOWER(COALESCE(?, ''))
       ORDER BY u.id_usuario DESC`,
      [directorContext.id, directorContext.nivelEducativo]
    );
  } else {
    users = await all(
      `SELECT u.id_usuario as id,
              u.nombre,
              u.apellido,
              u.email,
              u.dni,
              u.telefono,
              u.role,
              u.activo,
              u.created_at,
              u.nivel_educativo,
              u.director_area_id,
              da.nombre AS director_area_nombre,
              da.apellido AS director_area_apellido
       FROM usuario u
       LEFT JOIN usuario da ON da.id_usuario = u.director_area_id
       ORDER BY u.id_usuario DESC`
    );
  }

  return users;
}

async function createUser(authUserId, authUserRole, {
  nombre,
  apellido,
  email,
  dni,
  password,
  role,
  telefono,
  institucion,
  nivel,
  director_area_id
}) {
  const creatorContext = await getDirectorAreaCreatorContext(authUserId, authUserRole);
  const normalizedRole = normalizeRoleName(role);
  const dniNormalized = normalizeDni(dni);
  const emailNormalized = normalizeText(email)?.toLowerCase() || "";
  let finalNivel = nivel;
  let finalDirectorAreaId = director_area_id;

  if (!nombre || !email || !password || !role) {
    throw validationError("Faltan campos obligatorios", 400);
  }

  if (!(await roleExists(normalizedRole))) {
    throw validationError("Rol invalido", 400);
  }

  if (creatorContext) {
    if (normalizedRole !== "supervisor") {
      throw validationError("El Director de Area solo puede crear usuarios con rol Supervisor", 403);
    }
    if (!creatorContext.nivelEducativo) {
      throw validationError("El Director de Area no tiene nivel educativo configurado", 400);
    }
    if (normalizeLevel(nivel) && normalizeLevel(nivel) !== normalizeLevel(creatorContext.nivelEducativo)) {
      throw validationError("El nivel del supervisor debe coincidir con el nivel del Director de Area", 400);
    }
    if (parseOptionalId(director_area_id) && parseOptionalId(director_area_id) !== creatorContext.id) {
      throw validationError("El supervisor debe quedar vinculado al Director de Area que lo crea", 400);
    }

    finalNivel = creatorContext.nivelEducativo;
    finalDirectorAreaId = creatorContext.id;
  }

  const assignment = await validateRoleAssignment({
    normalizedRole,
    institucion,
    nivel: finalNivel,
    director_area_id: finalDirectorAreaId
  });

  const existing = await get("SELECT id_usuario FROM usuario WHERE LOWER(email) = ?", [emailNormalized]);
  if (existing) {
    throw validationError("El email ya existe", 409);
  }

  if (dniNormalized) {
    const existingDni = await get("SELECT id_usuario FROM usuario WHERE dni = ?", [dniNormalized]);
    if (existingDni) {
      throw validationError("El DNI ya existe", 409);
    }
  }

  const hash = await bcrypt.hash(password, 10);
  const result = await run(
    "INSERT INTO usuario (nombre, apellido, email, dni, password, telefono, id_institucion, role, activo, nivel_educativo, director_area_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)",
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
      assignment.directorAreaId
    ]
  );

  return result.lastID;
}

async function updateUserRole(authUserId, authUserRole, targetUserId, { role, institucion, nivel, director_area_id }) {
  if (String(authUserRole || "").toLowerCase() === "director_area") {
    throw validationError("El Director de Area no puede cambiar roles de usuarios", 403);
  }

  const normalizedRole = normalizeRoleName(role);

  if (!(await roleExists(normalizedRole))) {
    throw validationError("Rol invalido", 400);
  }

  const user = await get("SELECT id_usuario, id_institucion FROM usuario WHERE id_usuario = ?", [targetUserId]);
  if (!user) {
    throw validationError("Usuario no encontrado", 404);
  }

  const assignment = await validateRoleAssignment({
    normalizedRole,
    institucion,
    nivel,
    director_area_id,
    fallbackInstitucion: user.id_institucion || null
  });

  await run(
    "UPDATE usuario SET role = ?, id_institucion = ?, nivel_educativo = ?, director_area_id = ? WHERE id_usuario = ?",
    [
      normalizedRole,
      assignment.institucionId,
      assignment.nivelEducativo,
      assignment.directorAreaId,
      targetUserId
    ]
  );
  return true;
}

async function updateUser(authUserId, authUserRole, targetUserId, {
  nombre,
  apellido,
  email,
  dni,
  telefono,
  nivel,
  director_area_id,
  password
}) {
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    throw validationError("ID invalido", 400);
  }

  const accessibleUser = await ensureUserAccessForUpdate(authUserId, authUserRole, targetUserId);
  const authRole = String(authUserRole || "").toLowerCase();
  const directorContext = authRole === "director_area" ? await getDirectorAreaCreatorContext(authUserId, authUserRole) : null;

  const finalNombre = normalizeText(nombre);
  const finalApellido = normalizeText(apellido);
  const finalTelefono = normalizeText(telefono);
  const finalEmail = normalizeText(email)?.toLowerCase() || null;
  const finalDni = normalizeDni(dni);

  let finalNivel = nivel;
  let finalDirectorAreaId = director_area_id;

  if (!finalNombre || !finalEmail) {
    throw validationError("Nombre y email son obligatorios", 400);
  }
  if (!finalEmail.includes("@")) {
    throw validationError("El email no es valido", 400);
  }

  if (authRole === "director_area") {
    finalNivel = directorContext?.nivelEducativo || null;
    finalDirectorAreaId = directorContext?.id || null;
    if (!finalNivel) {
      throw validationError("El Director de Area no tiene nivel educativo configurado", 400);
    }
  }

  const finalPassword = normalizeText(password);
  if (finalPassword && finalPassword.length < 6) {
    throw validationError("La contrasena debe tener al menos 6 caracteres", 400);
  }

  const assignment = await validateRoleAssignment({
    normalizedRole: accessibleUser.role,
    institucion: accessibleUser.id_institucion || null,
    nivel: finalNivel,
    director_area_id: finalDirectorAreaId
  });

  const existingEmail = await get(
    "SELECT id_usuario FROM usuario WHERE LOWER(email) = ? AND id_usuario <> ?",
    [finalEmail, targetUserId]
  );
  if (existingEmail) {
    throw validationError("El email ya existe", 409);
  }

  if (finalDni) {
    const existingDni = await get(
      "SELECT id_usuario FROM usuario WHERE dni = ? AND id_usuario <> ?",
      [finalDni, targetUserId]
    );
    if (existingDni) {
      throw validationError("El DNI ya existe", 409);
    }
  }

  let passwordHash = null;
  if (finalPassword) {
    passwordHash = await bcrypt.hash(finalPassword, 10);
  }

  await run(
    `UPDATE usuario
     SET nombre = ?,
         apellido = ?,
         email = ?,
         dni = ?,
         telefono = ?,
         nivel_educativo = ?,
         director_area_id = ?,
         password = COALESCE(?, password)
     WHERE id_usuario = ?`,
    [
      finalNombre,
      finalApellido,
      finalEmail,
      finalDni,
      finalTelefono,
      assignment.nivelEducativo,
      assignment.directorAreaId,
      passwordHash,
      targetUserId
    ]
  );

  return true;
}

async function updateUserActive(authUserId, authUserRole, targetUserId, activo) {
  if (String(authUserRole || "").toLowerCase() === "director_area") {
    await ensureUserAccessForUpdate(authUserId, authUserRole, targetUserId);
  }

  await run("UPDATE usuario SET activo = ? WHERE id_usuario = ?", [activo ? true : false, targetUserId]);
  return true;
}

async function deleteUser(authUserId, targetUserId) {
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    throw validationError("ID invalido", 400);
  }

  if (authUserId === targetUserId) {
    throw validationError("No podes eliminar tu propio usuario", 400);
  }

  const existing = await get("SELECT id_usuario, role FROM usuario WHERE id_usuario = ?", [targetUserId]);
  if (!existing) {
    throw validationError("Usuario no encontrado", 404);
  }

  const pedidosAsociados = await get(
    "SELECT COUNT(*)::int AS total FROM pedido WHERE id_usuario_solicitante = ?",
    [targetUserId]
  );
  if ((pedidosAsociados?.total || 0) > 0) {
    throw validationError(
      "No se puede eliminar el usuario porque tiene pedidos asociados. Desactivalo en lugar de eliminarlo.",
      409
    );
  }

  try {
    await run("DELETE FROM usuario WHERE id_usuario = ?", [targetUserId]);
  } catch (err) {
    if (err && String(err.code) === "23503") {
      throw validationError(
        "No se puede eliminar el usuario porque tiene registros relacionados en el sistema.",
        409
      );
    }
    throw err;
  }
  return true;
}

module.exports = {
  getAuthUserId,
  normalizeDni,
  normalizeText,
  parseOptionalId,
  validationError,
  normalizeLevel,
  getDirectorAreaCreatorContext,
  getManagedSupervisorForDirector,
  ensureUserAccessForUpdate,
  validateRoleAssignment,
  getMe,
  updateMe,
  updateMyPassword,
  listUsers,
  createUser,
  updateUserRole,
  updateUser,
  updateUserActive,
  deleteUser
};
