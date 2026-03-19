require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const { initDb } = require("./db");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const permissionsRoutes = require("./routes/permissions");
const productosRoutes = require("./routes/productos");
const movimientosRoutes = require("./routes/movimientos");
const ajustesRoutes = require("./routes/ajustes");
const auditoriaRoutes = require("./routes/auditoria");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/permissions", permissionsRoutes);
app.use("/api/productos", productosRoutes);
app.use("/api/movimientos", movimientosRoutes);
app.use("/api/ajustes", ajustesRoutes);
app.use("/api/auditoria", auditoriaRoutes);

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Error inicializando base de datos", err);
    process.exit(1);
  });
