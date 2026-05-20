const proveedorService = require("../services/proveedorService");

async function listProveedores(req, res) {
  try {
    const proveedores = await proveedorService.getProveedores();
    return res.json({ proveedores });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo listar proveedores" });
  }
}

async function createProveedor(req, res) {
  try {
    const result = await proveedorService.createProveedor(req.body || {});
    return res.status(201).json({ id: result.id, message: "Proveedor creado correctamente" });
  } catch (err) {
    console.error("[crear-proveedor] Error:", err.message || err);
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo crear el proveedor", details: err.message || err });
  }
}

async function updateProveedor(req, res) {
  try {
    const { id } = req.params;
    const result = await proveedorService.updateProveedor(id, req.body || {});
    return res.json(result);
  } catch (err) {
    console.error("[actualizar-proveedor] Error:", err.message || err);
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo actualizar el proveedor", details: err.message || err });
  }
}

async function deleteProveedor(req, res) {
  try {
    const { id } = req.params;
    const result = await proveedorService.deleteProveedor(id);
    return res.json(result);
  } catch (err) {
    console.error("[eliminar-proveedor] Error:", err.message || err);
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo eliminar el proveedor", details: err.message || err });
  }
}

module.exports = {
  listProveedores,
  createProveedor,
  updateProveedor,
  deleteProveedor
};
