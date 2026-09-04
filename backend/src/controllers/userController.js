const userService = require("../services/userService");

async function getMe(req, res) {
  try {
    const userId = userService.getAuthUserId(req);
    const userProfile = await userService.getMe(userId);
    return res.json({ user: userProfile });
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo obtener el perfil" });
  }
}

async function updateMe(req, res) {
  try {
    const userId = userService.getAuthUserId(req);
    const updatedUser = await userService.updateMe(userId, req.body || {});
    return res.json({
      ok: true,
      user: updatedUser
    });
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo actualizar el perfil" });
  }
}

async function updatePassword(req, res) {
  try {
    const userId = userService.getAuthUserId(req);
    const { currentPassword, newPassword } = req.body || {};
    await userService.updateMyPassword(userId, currentPassword, newPassword);
    return res.json({ ok: true });
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo cambiar la contraseña" });
  }
}

async function listUsers(req, res) {
  try {
    const authUserId = userService.getAuthUserId(req);
    const authUserRole = req?.user?.role;
    const users = await userService.listUsers(authUserId, authUserRole);
    return res.json({ users });
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo listar usuarios" });
  }
}

async function createUser(req, res) {
  try {
    const authUserId = userService.getAuthUserId(req);
    const authUserRole = req?.user?.role;
    const newId = await userService.createUser(authUserId, authUserRole, req.body || {});
    return res.status(201).json({ id: newId });
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Error creando usuario:", err);
    return res.status(500).json({ 
      error: "No se pudo crear el usuario", 
      details: err.message || String(err),
      stack: err.stack
    });
  }
}

async function updateUserRole(req, res) {
  try {
    const authUserId = userService.getAuthUserId(req);
    const authUserRole = req?.user?.role;
    const targetUserId = req.params.id;
    await userService.updateUserRole(authUserId, authUserRole, targetUserId, req.body || {});
    return res.json({ ok: true });
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo actualizar el rol" });
  }
}

async function updateUser(req, res) {
  try {
    const authUserId = userService.getAuthUserId(req);
    const authUserRole = req?.user?.role;
    const targetUserId = Number.parseInt(req.params.id, 10);
    await userService.updateUser(authUserId, authUserRole, targetUserId, req.body || {});
    return res.json({ ok: true });
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Error actualizando usuario:", err);
    return res.status(500).json({ error: "No se pudo actualizar el usuario" });
  }
}

async function updateUserActive(req, res) {
  try {
    const authUserId = userService.getAuthUserId(req);
    const authUserRole = req?.user?.role;
    const targetUserId = Number.parseInt(req.params.id, 10);
    const { activo } = req.body || {};
    await userService.updateUserActive(authUserId, authUserRole, targetUserId, activo);
    return res.json({ ok: true });
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo actualizar estado" });
  }
}

async function deleteUser(req, res) {
  try {
    const authUserId = Number(req.user?.sub ?? req.user?.id);
    const targetUserId = Number(req.params.id);
    await userService.deleteUser(authUserId, targetUserId);
    return res.json({ ok: true });
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo eliminar usuario" });
  }
}

module.exports = {
  getMe,
  updateMe,
  updatePassword,
  listUsers,
  createUser,
  updateUserRole,
  updateUser,
  updateUserActive,
  deleteUser
};
