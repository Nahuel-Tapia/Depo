const { all } = require("./src/db.pg");

async function check() {
  try {
    const pedidos = await all("SELECT id_pedido, estado, tipo, kit_id, id_institucion FROM pedido LIMIT 10");
    console.log("PEDIDOS:", JSON.stringify(pedidos, null, 2));

    const detalles = await all("SELECT id_pedido, id_producto, cantidad_solicitada FROM detalle_pedido LIMIT 10");
    console.log("DETALLES:", JSON.stringify(detalles, null, 2));
  } catch (err) {
    console.error(err);
  }
}

check();
