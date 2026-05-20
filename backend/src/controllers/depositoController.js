const depositoService = require("../services/depositoService");

async function listDepositos(req, res) {
  try {
    const depositos = await depositoService.listDepositos(req.user);
    return res.json({ depositos });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error listando depósitos:", err);
    return res.status(500).json({ error: "No se pudo listar depósitos" });
  }
}

async function getProductosByDeposito(req, res) {
  try {
    const { id } = req.params;
    const productos = await depositoService.getProductosByDeposito(id);
    return res.json({ productos });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error listando productos en deposito:", err);
    return res.status(500).json({ error: "No se pudo listar productos en el deposito" });
  }
}

async function getStockPorProducto(req, res) {
  try {
    const productos = await depositoService.getStockPorProducto(req.user);
    return res.json({ productos });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error listando stock:", err);
    return res.status(500).json({ error: "No se pudo listar stock", details: err.message });
  }
}

async function getStockByDeposito(req, res) {
  try {
    const { id } = req.params;
    const result = await depositoService.getStockByDeposito(id, req.user);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error obteniendo stock:", err);
    return res.status(500).json({ error: "No se pudo obtener stock" });
  }
}

async function moverStock(req, res) {
  try {
    const { id_producto, cantidad, origen_id, destino_id, motivo } = req.body;
    if (!id_producto || !cantidad || !origen_id || !destino_id) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }
    const result = await depositoService.moverStock({
      id_producto,
      cantidad,
      origen_id,
      destino_id,
      motivo,
      user: req.user
    });
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error moviendo entre depósitos:", err);
    return res.status(500).json({ error: "Error moviendo entre depósitos" });
  }
}

async function getTraslados(req, res) {
  try {
    const traslados = await depositoService.getTraslados();
    return res.json({ traslados });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error obteniendo traslados:", err);
    return res.status(500).json({ error: "No se pudo obtener el historial de traslados" });
  }
}

async function registrarIngreso(req, res) {
  try {
    const { id } = req.params;
    const { id_producto, cantidad, id_proveedor, motivo, fecha_vencimiento } = req.body;

    if (!id_producto || !cantidad) {
      return res.status(400).json({ error: "Producto y cantidad requeridos" });
    }

    const result = await depositoService.registrarIngreso({
      id,
      id_producto,
      cantidad,
      id_proveedor,
      motivo,
      fecha_vencimiento,
      user: req.user
    });
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error en ingreso:", err);
    return res.status(500).json({ error: "No se pudo registrar ingreso", details: err.message });
  }
}

async function registrarEgreso(req, res) {
  try {
    const { id } = req.params;
    const { id_producto, cantidad, id_institucion, motivo } = req.body;

    if (!id_producto || !cantidad) {
      return res.status(400).json({ error: "Producto y cantidad requeridos" });
    }

    const result = await depositoService.registrarEgreso({
      id,
      id_producto,
      cantidad,
      id_institucion,
      motivo,
      user: req.user
    });
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error en egreso:", err);
    return res.status(500).json({ error: "No se pudo registrar egreso" });
  }
}

async function getRecepcionesLicitacion(req, res) {
  try {
    const licitaciones = await depositoService.getRecepcionesLicitacion();
    return res.json({ licitaciones });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al obtener recepciones:", err);
    return res.status(500).json({ error: "Error al obtener recepciones" });
  }
}

async function getDetalleRecepcion(req, res) {
  try {
    const { id } = req.params;
    const result = await depositoService.getDetalleRecepcion(id);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al obtener detalle recepcion:", err);
    return res.status(500).json({ error: "Error al obtener detalle" });
  }
}

async function registrarIngresoLicitacion(req, res) {
  try {
    const { licitacion_id, ingresos, id_deposito, observaciones } = req.body;
    const result = await depositoService.registrarIngresoLicitacion({
      licitacion_id,
      ingresos,
      id_deposito,
      observaciones,
      user: req.user
    });
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al registrar ingreso licitación:", err);
    return res.status(500).json({ error: "Error al procesar el ingreso" });
  }
}

async function cerrarLicitacion(req, res) {
  try {
    const { id } = req.params;
    const result = await depositoService.cerrarLicitacion(id);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error cerrando licitación:", err);
    return res.status(500).json({ error: "No se pudo cerrar la licitación" });
  }
}

async function registrarDanioImagen(req, res) {
  try {
    const { remito_id, producto_id, nombre, mime_type, datos } = req.body;
    const result = await depositoService.registrarDanioImagen({
      remito_id,
      producto_id,
      nombre,
      mime_type,
      datos
    });
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error guardando imagen de daño:", err);
    return res.status(500).json({ error: "No se pudo guardar la imagen de daño" });
  }
}

async function getRemitosByLicitacion(req, res) {
  try {
    const { id } = req.params;
    const result = await depositoService.getRemitosByLicitacion(id);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error obteniendo remitos:", err);
    return res.status(500).json({ error: "No se pudo obtener el historial de remitos" });
  }
}

async function getRemitoGeneralLicitacion(req, res) {
  try {
    const { id } = req.params;
    const result = await depositoService.getRemitoGeneralLicitacion(id);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error generando remito general:", err);
    return res.status(500).json({ error: "No se pudo generar el remito general" });
  }
}

async function getVencimientosProximos(req, res) {
  try {
    const dias = Number(req.query.dias || 60);
    const alertas = await depositoService.getVencimientosProximos(dias);
    return res.json({ alertas });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("[vencimientos-proximos] Error detallado:", err.message);
    return res.status(500).json({ error: "Error al obtener alertas de vencimiento", details: err.message });
  }
}

async function getDistribucionZonasPendientes(req, res) {
  try {
    const anio = Number(req.query.anio || new Date().getFullYear());
    const zonas = await depositoService.getDistribucionZonasPendientes(anio);
    return res.json({ zonas, anio });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al obtener zonas pendientes:", err);
    return res.status(500).json({ error: "Error al obtener zonas pendientes" });
  }
}

async function getDistribucionZonaDetalle(req, res) {
  try {
    const anio = Number(req.query.anio || new Date().getFullYear());
    const zonaId = Number(req.params.id);
    const result = await depositoService.getDistribucionZonaDetalle(zonaId, anio);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al obtener detalle zonal:", err);
    return res.status(500).json({ error: "Error al obtener detalle de zona" });
  }
}

async function registrarEgresoMultipleZona(req, res) {
  try {
    const { zona_id, anio, id_deposito, observaciones, entregas } = req.body;
    const result = await depositoService.registrarEgresoMultipleZona({
      zona_id,
      anio,
      id_deposito,
      observaciones,
      entregas,
      user: req.user
    });
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error en egreso múltiple zonal:", err);
    return res.status(500).json({ error: err.message || "No se pudo registrar el egreso múltiple" });
  }
}

async function getPendientesDistribucion(req, res) {
  try {
    const anio = Number(req.query.anio || new Date().getFullYear());
    const pendientes = await depositoService.getPendientesDistribucion(anio);
    return res.json({ pendientes });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al obtener pendientes de distribución:", err);
    return res.status(500).json({ error: "Error al obtener pendientes de distribución" });
  }
}

async function getDetalleDistribucionEscuela(req, res) {
  try {
    const { id } = req.params;
    const anio = Number(req.query.anio || new Date().getFullYear());
    const items = await depositoService.getDetalleDistribucionEscuela(id, anio);
    return res.json({ items });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al obtener detalle de escuela:", err);
    return res.status(500).json({ error: "Error al obtener detalle de escuela" });
  }
}

async function registrarSalidaDistribucion(req, res) {
  try {
    const { id_institucion, anio, entregas, id_deposito, observaciones } = req.body;
    const result = await depositoService.registrarSalidaDistribucion({
      id_institucion,
      anio,
      entregas,
      id_deposito,
      observaciones,
      user: req.user
    });
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al registrar salida distribución:", err);
    return res.status(500).json({ error: err.message || "Error al procesar la salida" });
  }
}

module.exports = {
  listDepositos,
  getProductosByDeposito,
  getStockPorProducto,
  getStockByDeposito,
  moverStock,
  getTraslados,
  registrarIngreso,
  registrarEgreso,
  getRecepcionesLicitacion,
  getDetalleRecepcion,
  registrarIngresoLicitacion,
  cerrarLicitacion,
  registrarDanioImagen,
  getRemitosByLicitacion,
  getRemitoGeneralLicitacion,
  getVencimientosProximos,
  getDistribucionZonasPendientes,
  getDistribucionZonaDetalle,
  registrarEgresoMultipleZona,
  getPendientesDistribucion,
  getDetalleDistribucionEscuela,
  registrarSalidaDistribucion
};
