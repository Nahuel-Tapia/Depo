const movimientoService = require("../services/movimientoService");

async function listarMovimientos(req, res) {
  try {
    const movimientos = await movimientoService.listarMovimientos(req.query);
    return res.json({ movimientos });
  } catch (err) {
    console.error("Error listando movimientos:", err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || "No se pudo listar movimientos" });
  }
}

async function obtenerMovimiento(req, res) {
  try {
    const { id } = req.params;
    const movimiento = await movimientoService.obtenerMovimiento(id);

    if (!movimiento) {
      return res.status(404).json({ error: "Movimiento no encontrado" });
    }
    return res.json({ movimiento });
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || "No se pudo obtener el movimiento" });
  }
}

async function crearMovimiento(req, res) {
  try {
    const lastID = await movimientoService.crearMovimiento(req.user, req.body);
    return res.status(201).json({ id: lastID });
  } catch (err) {
    console.error("Error creando movimiento:", err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || "No se pudo crear el movimiento" });
  }
}

async function crearLoteMovimientos(req, res) {
  try {
    const ids = await movimientoService.crearLoteMovimientos(req.user, req.body);
    return res.status(201).json({ ids });
  } catch (err) {
    console.error("Error creando lote de movimientos:", err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || "No se pudo crear el lote de movimientos" });
  }
}

async function crearMovimientoDirecto(req, res) {
  try {
    const ids = await movimientoService.crearMovimientoDirecto(req.user, req.body);
    return res.status(201).json({ ids });
  } catch (err) {
    console.error("Error creando movimiento directo:", err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || "No se pudo crear el movimiento directo" });
  }
}

async function obtenerStatsResumen(req, res) {
  try {
    const stats = await movimientoService.obtenerStatsResumen();
    return res.json({ stats });
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || "No se pudo obtener estadísticas" });
  }
}

async function registrarBaja(req, res) {
  try {
    const result = await movimientoService.registrarBaja(req.user, req.body, req.file);
    return res.status(201).json(result);
  } catch (err) {
    console.error('Error registrando baja:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'No se pudo registrar la baja' });
  }
}

async function listarBajas(req, res) {
  try {
    const bajas = await movimientoService.listarBajas(req.query);
    return res.json({ bajas });
  } catch (err) {
    console.error("Error listando bajas:", err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || "No se pudo listar bajas" });
  }
}

module.exports = {
  listarMovimientos,
  obtenerMovimiento,
  crearMovimiento,
  crearLoteMovimientos,
  crearMovimientoDirecto,
  obtenerStatsResumen,
  registrarBaja,
  listarBajas
};
