const productoService = require("../services/productoService");

async function listarProductos(req, res) {
  try {
    const productos = await productoService.getProductos(req.user);
    return res.json({ productos });
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || "No se pudo listar productos" });
  }
}

async function listarCategorias(req, res) {
  try {
    const categorias = await productoService.getCategorias();
    return res.json({ categorias });
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || "No se pudo listar categorías" });
  }
}

async function obtenerProducto(req, res) {
  try {
    const { id } = req.params;
    const producto = await productoService.getProductoById(id, req.user);
    return res.json({ producto });
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || "No se pudo obtener el producto" });
  }
}

async function obtenerProductoStockDetalle(req, res) {
  try {
    const { id } = req.params;
    const result = await productoService.getProductoStockDetalle(id, req.user);
    return res.json(result);
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || "No se pudo obtener el detalle de stock" });
  }
}

async function crearProducto(req, res) {
  try {
    const newId = await productoService.createProducto(req.user, req.body);
    return res.status(201).json({ id: newId });
  } catch (err) {
    console.error("[crear-producto] Error:", err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || "No se pudo crear el producto", details: err.message });
  }
}

async function editarProducto(req, res) {
  try {
    const { id } = req.params;
    const result = await productoService.updateProducto(id, req.body);
    return res.json(result);
  } catch (err) {
    console.error("[editar-producto] Error:", err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || "No se pudo editar el producto", details: err.message });
  }
}

async function eliminarProducto(req, res) {
  try {
    const { id } = req.params;
    const result = await productoService.deleteProducto(id);
    return res.json(result);
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || "No se pudo eliminar el producto" });
  }
}

async function importarProductos(req, res) {
  try {
    const productosArray = req.body;
    const result = await productoService.importarProductosMasivo(req.user, productosArray);
    return res.status(201).json(result);
  } catch (err) {
    console.error("[importar-productos] Error:", err.message);
    const status = err.status || 500;
    return res.status(status).json({
      error: err.message || "Error al importar productos",
      errores: err.errores || []
    });
  }
}

module.exports = {
  listarProductos,
  listarCategorias,
  obtenerProducto,
  obtenerProductoStockDetalle,
  crearProducto,
  editarProducto,
  eliminarProducto,
  importarProductos
};
