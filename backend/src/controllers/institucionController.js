const institucionService = require("../services/institucionService");

async function getPublicByCue(req, res) {
  try {
    const { cue } = req.params;
    const result = await institucionService.getPublicByCue(cue);
    return res.json(result);
  } catch (err) {
    console.error(err);
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo buscar la institución" });
  }
}

async function listPublic(req, res) {
  try {
    const result = await institucionService.listPublicInstituciones();
    return res.json(result);
  } catch (err) {
    console.error(err);
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo listar instituciones" });
  }
}

async function list(req, res) {
  try {
    const result = await institucionService.listInstituciones();
    return res.json(result);
  } catch (err) {
    console.error('Error en consulta instituciones:', err.message);
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo listar instituciones" });
  }
}

async function getHistorialGlobal(req, res) {
  try {
    const { desde, hasta, tipo, subtipoPedido, institucionId } = req.query;
    const result = await institucionService.getHistorialGlobal({ desde, hasta, tipo, subtipoPedido, institucionId });
    return res.json(result);
  } catch (err) {
    console.error(err);
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo obtener el historial" });
  }
}

async function getById(req, res) {
  try {
    const { id } = req.params;
    const result = await institucionService.getInstitucionById(id);
    return res.json(result);
  } catch (err) {
    console.error(err);
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo obtener la institución" });
  }
}

async function getByCue(req, res) {
  try {
    const { cue } = req.params;
    const result = await institucionService.getInstitucionesByCue(cue);
    return res.json(result);
  } catch (err) {
    console.error(err);
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo buscar la institución" });
  }
}

async function create(req, res) {
  try {
    const authUserId = institucionService.getAuthUserId(req);
    const result = await institucionService.createInstitucion(authUserId, req.body || {});
    return res.status(201).json(result);
  } catch (err) {
    console.error(err);
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo crear la institución" });
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const authUserId = institucionService.getAuthUserId(req);
    const result = await institucionService.updateInstitucion(authUserId, id, req.body || {});
    return res.json(result);
  } catch (err) {
    console.error(err);
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo actualizar la institución" });
  }
}

async function deleteInstitucion(req, res) {
  try {
    const { id } = req.params;
    const authUserId = institucionService.getAuthUserId(req);
    const result = await institucionService.deleteInstitucion(authUserId, id);
    return res.json(result);
  } catch (err) {
    console.error(err);
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo eliminar la institución" });
  }
}

async function getAsignaciones(req, res) {
  try {
    const { id } = req.params;
    const result = await institucionService.getAsignacionesByInstitucion(id, req.query || {});
    return res.json(result);
  } catch (err) {
    console.error(err);
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo obtener asignaciones" });
  }
}

async function asignar(req, res) {
  try {
    const { id } = req.params;
    const result = await institucionService.assignStock(id, req.body || {});
    return res.json(result);
  } catch (err) {
    console.error(err);
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo asignar stock" });
  }
}

async function asignarMasivo(req, res) {
  try {
    const authUserId = institucionService.getAuthUserId(req);
    const result = await institucionService.massAssignStock(authUserId, req.body || {});
    return res.json(result);
  } catch (err) {
    console.error(err);
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo realizar asignación masiva" });
  }
}

async function entregar(req, res) {
  try {
    const { id } = req.params;
    const authUserId = institucionService.getAuthUserId(req);
    const result = await institucionService.deliverStock(authUserId, id, req.body || {});
    return res.json(result);
  } catch (err) {
    console.error(err);
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo registrar la entrega" });
  }
}

async function getResumenPeriodo(req, res) {
  try {
    const { periodo } = req.params;
    const result = await institucionService.getResumenPeriodo(periodo);
    return res.json(result);
  } catch (err) {
    console.error(err);
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo obtener resumen" });
  }
}

async function getHistorialInstitucion(req, res) {
  try {
    const { id } = req.params;
    const result = await institucionService.getHistorialInstitucion(id, req.query || {});
    return res.json(result);
  } catch (err) {
    console.error(err);
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo obtener el historial" });
  }
}

module.exports = {
  getPublicByCue,
  listPublic,
  list,
  getHistorialGlobal,
  getById,
  getByCue,
  create,
  update,
  deleteInstitucion,
  getAsignaciones,
  asignar,
  asignarMasivo,
  entregar,
  getResumenPeriodo,
  getHistorialInstitucion
};
