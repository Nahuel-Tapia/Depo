const entregaService = require("../services/entregaService");

async function listarPedidosDisponibles(req, res) {
  try {
    const pedidos = await entregaService.listarPedidosDisponibles();
    return res.json({ pedidos });
  } catch (err) {
    console.error("Error al obtener pedidos disponibles:", err);
    return res.status(500).json({ error: "No se pudieron obtener los pedidos disponibles" });
  }
}

async function getProductosDisponiblesRetiro(req, res) {
  try {
    if (req.user.role !== "directivo") {
      return res.status(403).json({ error: "Solo el rol directivo puede crear solicitudes de retiro" });
    }
    const pedidos = await entregaService.getProductosDisponiblesRetiro(req.user.sub);
    return res.json({ pedidos: pedidos });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al obtener productos para solicitud de retiro:", err);
    return res.status(500).json({ error: "No se pudieron obtener productos disponibles para retiro" });
  }
}

async function listarMisSolicitudesRetiro(req, res) {
  try {
    if (req.user.role !== "directivo") {
      return res.status(403).json({ error: "Solo el rol directivo puede consultar sus solicitudes de retiro" });
    }
    const solicitudes = await entregaService.getMisSolicitudesRetiro(req.user.sub);
    return res.json({ solicitudes });
  } catch (err) {
    console.error("Error al listar solicitudes propias de retiro:", err);
    return res.status(500).json({ error: "No se pudieron obtener las solicitudes de retiro" });
  }
}

async function createSolicitudRetiro(req, res) {
  try {
    const solicitud = await entregaService.createSolicitudRetiro(req.user.sub, req.user.role, req.body);
    return res.status(201).json({ ok: true, solicitud });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al crear solicitud de retiro:", err);
    return res.status(500).json({ error: "No se pudo crear la solicitud de retiro" });
  }
}

async function listarSolicitudesEnvioDepartamentos(req, res) {
  try {
    const result = await entregaService.getSolicitudesEnvioDepartamentos(req.query.anio);
    return res.json(result);
  } catch (err) {
    console.error("Error al listar solicitudes con envio por departamento:", err);
    return res.status(500).json({ error: "No se pudieron obtener solicitudes con envio por departamento" });
  }
}

async function getDetalleSolicitudesEnvioDepartamento(req, res) {
  try {
    const result = await entregaService.getDetalleSolicitudesEnvioDepartamento(req.params.departamento, req.query.anio);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al obtener detalle de solicitudes con envio:", err);
    return res.status(500).json({ error: "No se pudo obtener el detalle de solicitudes con envio" });
  }
}

async function registrarEgresoMultipleEnvio(req, res) {
  try {
    const result = await entregaService.registrarEgresoMultipleEnvio(req.user.sub, req.body);
    return res.json({
      ok: true,
      ...result,
      message: "Egreso múltiple por departamento registrado con éxito",
    });
  } catch (err) {
    console.error("Error al registrar egreso múltiple por departamento:", err);
    const status = Number(err?.status || 500);
    return res.status(status).json({ error: err.message || "No se pudo registrar el egreso por departamento" });
  }
}

async function listarSeguimientoEnvios(req, res) {
  try {
    const result = await entregaService.getSeguimientoEnvios(req.query);
    return res.json(result);
  } catch (err) {
    console.error("Error al obtener seguimiento de envíos por departamento:", err);
    return res.status(500).json({ error: "No se pudo obtener el seguimiento de envíos" });
  }
}

async function getDetalleSeguimientoLote(req, res) {
  try {
    const result = await entregaService.getDetalleSeguimientoLote(req.params.loteId);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al obtener detalle de seguimiento del lote:", err);
    return res.status(500).json({ error: "No se pudo obtener el detalle del lote" });
  }
}

async function aceptarSolicitudRetiro(req, res) {
  try {
    const updated = await entregaService.aceptarSolicitudRetiro(req.params.id, req.user.sub);
    return res.json({ ok: true, estado: 'aceptada', solicitud: updated });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('Error al aceptar solicitud de retiro:', err);
    return res.status(500).json({ error: 'No se pudo aceptar la solicitud' });
  }
}

async function listarSolicitudesPendientes(req, res) {
  try {
    const solicitudes = await entregaService.getSolicitudesPendientes();
    return res.json({ solicitudes });
  } catch (err) {
    console.error("Error al listar solicitudes pendientes:", err);
    return res.status(500).json({ error: "No se pudieron obtener las solicitudes pendientes" });
  }
}

async function listarSolicitudesEntregadas(req, res) {
  try {
    const solicitudes = await entregaService.getSolicitudesEntregadas(req.user);
    return res.json({ solicitudes });
  } catch (err) {
    console.error("Error al obtener historial de solicitudes entregadas:", err);
    return res.status(500).json({ error: "No se pudo obtener el historial" });
  }
}

async function getComprobanteRetiro(req, res) {
  try {
    const solicitud = await entregaService.getComprobanteRetiro(req.params.id, req.user);
    return res.json({ solicitud });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al obtener comprobante de retiro:", err);
    return res.status(500).json({ error: "No se pudo obtener el comprobante" });
  }
}

async function entregarSolicitudRetiro(req, res) {
  try {
    const result = await entregaService.entregarSolicitudRetiro(req.params.id, req.user.sub);
    return res.json({
      ok: true,
      ...result
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al confirmar solicitud de retiro:", err);
    return res.status(500).json({ error: "No se pudo confirmar la entrega" });
  }
}

async function retirarPedido(req, res) {
  try {
    const result = await entregaService.retirarPedido(req.user.sub, req.body);
    return res.status(201).json({
      ok: true,
      ...result,
      mensaje: result.pedido_completo 
        ? `Pedido #${req.body.id_pedido} completado y marcado como finalizado` 
        : `Entrega registrada para pedido #${req.body.id_pedido}`
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al registrar entrega:", err);
    return res.status(500).json({ error: "No se pudo registrar la entrega" });
  }
}

async function getHistorialEntregasPedido(req, res) {
  try {
    const entregas = await entregaService.getHistorialEntregasPedido(req.params.id_pedido, req.user);
    return res.json({ entregas });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al obtener historial de entregas:", err);
    return res.status(500).json({ error: "No se pudo obtener el historial de entregas" });
  }
}

async function listarEnSede(req, res) {
  try {
    const solicitudes = await entregaService.listarEnSede(req.user.sub, req.user.role);
    return res.json({ solicitudes });
  } catch (err) {
    console.error("Error al listar solicitudes en sede:", err);
    return res.status(500).json({ error: "No se pudieron obtener las solicitudes en sede" });
  }
}

async function entregarDesdeSede(req, res) {
  try {
    const result = await entregaService.entregarDesdeSede(req.user.sub, req.params.id);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al entregar desde sede:", err);
    return res.status(500).json({ error: "No se pudo entregar desde sede" });
  }
}

module.exports = {
  listarPedidosDisponibles,
  getProductosDisponiblesRetiro,
  listarMisSolicitudesRetiro,
  createSolicitudRetiro,
  listarSolicitudesEnvioDepartamentos,
  getDetalleSolicitudesEnvioDepartamento,
  registrarEgresoMultipleEnvio,
  listarSeguimientoEnvios,
  getDetalleSeguimientoLote,
  aceptarSolicitudRetiro,
  listarSolicitudesPendientes,
  listarSolicitudesEntregadas,
  getComprobanteRetiro,
  entregarSolicitudRetiro,
  retirarPedido,
  getHistorialEntregasPedido,
  listarEnSede,
  entregarDesdeSede
};
