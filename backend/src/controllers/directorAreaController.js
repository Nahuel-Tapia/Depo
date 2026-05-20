const directorAreaService = require("../services/directorAreaService");

async function getCatalogo(req, res) {
  try {
    const result = await directorAreaService.getCatalogo(req.user, req.directorAreaActingId);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al cargar catalogo de Direccion de Area:", err);
    return res.status(500).json({ error: "No se pudo cargar catalogo" });
  }
}

async function getAsignaciones(req, res) {
  try {
    const result = await directorAreaService.getAsignaciones(req.directorAreaActingId);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al cargar asignaciones:", err);
    return res.status(500).json({ error: "No se pudieron cargar las asignaciones" });
  }
}

async function deleteAsignacion(req, res) {
  try {
    const result = await directorAreaService.deleteAsignacion(req.params.id, req.directorAreaActingId);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al eliminar asignacion:", err);
    return res.status(500).json({ error: "No se pudo eliminar la asignacion" });
  }
}

async function asignar(req, res) {
  try {
    const { supervisorId, institucionId } = req.body;
    const result = await directorAreaService.asignar(req.user, req.directorAreaActingId, supervisorId, institucionId);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al asignar:", err);
    return res.status(500).json({ error: "No se pudo realizar la asignacion" });
  }
}

async function desasignar(req, res) {
  try {
    const { supervisorId, institucionId } = req.body;
    const result = await directorAreaService.desasignar(supervisorId, institucionId, req.directorAreaActingId);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al desasignar:", err);
    return res.status(500).json({ error: "No se pudo eliminar la asignacion" });
  }
}

async function getSupervisores(req, res) {
  try {
    const result = await directorAreaService.getSupervisores(req.user, req.directorAreaActingId);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al cargar supervisores:", err);
    return res.status(500).json({ error: "No se pudieron cargar los supervisores" });
  }
}

async function createSupervisor(req, res) {
  try {
    const context = {
      user: req.user,
      directorAreaActingId: req.directorAreaActingId,
      directorAreaActingJurisdiccion: req.directorAreaActingJurisdiccion
    };
    const result = await directorAreaService.createSupervisor(context, req.body);
    return res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al crear supervisor:", err);
    return res.status(500).json({ error: "No se pudo crear el supervisor" });
  }
}

async function getEdificios(req, res) {
  try {
    const result = await directorAreaService.getEdificios(req.directorAreaActingId);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al cargar edificios:", err);
    return res.status(500).json({ error: "No se pudieron cargar los edificios" });
  }
}

async function getInstitucionesDelEdificio(req, res) {
  try {
    const result = await directorAreaService.getInstitucionesDelEdificio(req.directorAreaActingId, req.params.edificioId);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al cargar instituciones del edificio:", err);
    return res.status(500).json({ error: "No se pudieron cargar las instituciones" });
  }
}

async function getZonasEdificio(req, res) {
  try {
    const result = await directorAreaService.getZonasEdificio(req.user, req.directorAreaActingId);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al cargar zonas por edificio:", err);
    return res.status(500).json({ error: "No se pudieron cargar las zonas" });
  }
}

async function getInformes(req, res) {
  try {
    const result = await directorAreaService.getInformes();
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al cargar informes:", err);
    return res.status(500).json({ error: "No se pudieron cargar los informes" });
  }
}

async function getSolicitudes(req, res) {
  try {
    const result = await directorAreaService.getSolicitudes(req.directorAreaActingId);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al cargar solicitudes:", err);
    return res.status(500).json({ error: "No se pudieron cargar las solicitudes" });
  }
}

async function createZona(req, res) {
  try {
    const result = await directorAreaService.createZona(req.user, req.directorAreaActingId, req.body);
    return res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al crear zona:", err);
    return res.status(500).json({ error: "Error al crear zona" });
  }
}

async function updateZona(req, res) {
  try {
    const result = await directorAreaService.updateZona(req.user, req.directorAreaActingId, req.params.zonaId, req.body);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al editar zona:", err);
    return res.status(500).json({ error: "Error al editar zona" });
  }
}

async function deleteZona(req, res) {
  try {
    const result = await directorAreaService.deleteZona(req.directorAreaActingId, req.params.zonaId);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al eliminar zona:", err);
    return res.status(500).json({ error: "Error al eliminar zona" });
  }
}

async function assignSupervisoresZona(req, res) {
  try {
    const result = await directorAreaService.assignSupervisoresZona(req.directorAreaActingId, req.params.zonaId, req.body);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al asignar supervisores:", err);
    return res.status(500).json({ error: "Error al asignar supervisores" });
  }
}

module.exports = {
  getCatalogo,
  getAsignaciones,
  deleteAsignacion,
  asignar,
  desasignar,
  getSupervisores,
  createSupervisor,
  getEdificios,
  getInstitucionesDelEdificio,
  getZonasEdificio,
  getInformes,
  getSolicitudes,
  createZona,
  updateZona,
  deleteZona,
  assignSupervisoresZona
};
