require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const { initDb } = require("./db.pg");
const { getDbConfigForLogs } = require("./config/database");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const permissionsRoutes = require("./routes/permissions");
const productosRoutes = require("./routes/productos");
const movimientosRoutes = require("./routes/movimientos");
const ajustesRoutes = require("./routes/ajustes");
const auditoriaRoutes = require("./routes/auditoria");
const pedidosRoutes = require("./routes/pedidos");
const institucionesRoutes = require("./routes/instituciones");
const proveedoresRoutes = require("./routes/proveedores");
const dashboardRoutes = require("./routes/dashboard");
const supervisorRoutes = require("./routes/supervisor");
const directorAreaRoutes = require("./routes/directorArea");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Servir el build de React (frontend/dist)
const frontendDistPath = path.join(__dirname, "..", "..", "frontend", "dist");
const frontendPublicPath = path.join(__dirname, "..", "..", "frontend", "public");
const fs = require("fs");
const staticPath = fs.existsSync(frontendDistPath) ? frontendDistPath : frontendPublicPath;
app.use(express.static(staticPath));

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
app.use("/api/pedidos", pedidosRoutes);
app.use("/api/instituciones", institucionesRoutes);
app.use("/api/proveedores", proveedoresRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/supervisor", supervisorRoutes);
app.use("/api/director-area", directorAreaRoutes);

// Si una ruta /api no existe, devolver JSON en lugar de index.html
app.use("/api", (req, res) => {
  return res.status(404).json({ error: "Ruta API no encontrada" });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(staticPath, "index.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(staticPath, "index.html"));
});

initDb()
  .then(() => {
    console.log("Database initialized");
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    if (err && err.code === "28P01") {
      const cfg = getDbConfigForLogs();
      console.error("No se pudo conectar a PostgreSQL por credenciales inválidas (código 28P01).");
      console.error(
        `Conexión usada: host=${cfg.host} port=${cfg.port} db=${cfg.database} user=${cfg.user} password=${cfg.hasPassword ? "[definida]" : "[vacía]"}`
      );
      console.error("Definí DB_PASSWORD (o PGPASSWORD) en el archivo .env de la raíz del proyecto.");
    }
    console.error("Error inicializando base de datos", err);
    process.exit(1);
  });
