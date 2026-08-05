const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

// Permite iniciar el backend tanto desde la raiz del repo como desde /backend.
const envCandidates = [
  path.resolve(__dirname, "..", "..", ".env"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "..", ".env"),
];
const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "depo_stock_jwt_secret_key_2026";
}

const express = require("express");
const cors = require("cors");
const { initDb } = require("./db.pg");
const { getDbConfigForLogs } = require("./config/database");
const { ensureRbacSchemaAndSeed } = require("./services/rbac");
const errorHandler = require("./middleware/errorHandler");
const { authLimiter, apiLimiter } = require("./middleware/rateLimiter");
const { initDatabaseSchema } = require("./services/schemaManager");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const roleRoutes = require("./routes/roles");
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
const comprasRoutes = require("./routes/compras");
const directivoRoutes = require("./routes/directivo");
const depositosRoutes = require("./routes/depositos");
const patrimonioRoutes = require("./routes/patrimonio");
const stockInstitucionRoutes = require("./routes/stockInstitucion");
let zonesRoutes = null;
let zoneSchoolsRoutes = null;
let zoneSupervisorsRoutes = null;

try {
  zonesRoutes = require("./routes/zones");
  zoneSchoolsRoutes = require("./routes/zoneSchools");
  zoneSupervisorsRoutes = require("./routes/zoneSupervisors");
} catch {
  zonesRoutes = null;
  zoneSchoolsRoutes = null;
  zoneSupervisorsRoutes = null;
}
const entregasRoutes = require("./routes/entregas");

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 4000;
const isVercel = !!process.env.VERCEL;

// --- 1. CORS ---
app.use(cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin origin (curl, mobile, server-to-server)
    if (!origin) return callback(null, true);
    // Si se definen orígenes específicos, validarlos
    if (process.env.CORS_ORIGINS) {
      const allowed = process.env.CORS_ORIGINS.split(',').map(s => s.trim());
      if (allowed.includes(origin)) return callback(null, true);
      return callback(new Error('No permitido por CORS'));
    }
    // Por defecto permitir todo (Vercel usa el mismo dominio)
    return callback(null, true);
  },
  credentials: true
}));

// --- 2. Body parsers ---
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// --- 2.1 URL Normalization for Vercel Serverless ---
app.use((req, res, next) => {
  const pathOnly = (req.url || '').split('?')[0];
  if (!pathOnly.startsWith('/api') && (
    pathOnly.startsWith('/auth') ||
    pathOnly.startsWith('/users') ||
    pathOnly.startsWith('/roles') ||
    pathOnly.startsWith('/permissions') ||
    pathOnly.startsWith('/productos') ||
    pathOnly.startsWith('/movimientos') ||
    pathOnly.startsWith('/ajustes') ||
    pathOnly.startsWith('/auditoria') ||
    pathOnly.startsWith('/pedidos') ||
    pathOnly.startsWith('/instituciones') ||
    pathOnly.startsWith('/proveedores') ||
    pathOnly.startsWith('/dashboard') ||
    pathOnly.startsWith('/supervisor') ||
    pathOnly.startsWith('/director-area') ||
    pathOnly.startsWith('/compras') ||
    pathOnly.startsWith('/directivo') ||
    pathOnly.startsWith('/patrimonio') ||
    pathOnly.startsWith('/zones') ||
    pathOnly.startsWith('/entregas') ||
    pathOnly.startsWith('/depositos') ||
    pathOnly.startsWith('/stock-institucion') ||
    pathOnly.startsWith('/health')
  )) {
    req.url = '/api' + req.url;
  }
  next();
});

// --- 3. Inicialización de BD (ANTES de las rutas — crítico para serverless) ---
let dbInitPromise = null;
async function ensureDbInitialized() {
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      await initDb();
      await ensureRbacSchemaAndSeed();
      await initDatabaseSchema();
      console.log("Database initialized");
    })();
  }
  return dbInitPromise;
}

app.use(async (req, res, next) => {
  try {
    await ensureDbInitialized();
    next();
  } catch (err) {
    // Permitir reintentar en la próxima petición
    dbInitPromise = null;
    if (err && err.code === "28P01") {
      const cfg = getDbConfigForLogs();
      console.error("No se pudo conectar a PostgreSQL por credenciales inválidas (código 28P01).");
      console.error(
        `Conexión usada: host=${cfg.host} port=${cfg.port} db=${cfg.database} user=${cfg.user} password=${cfg.hasPassword ? "[definida]" : "[vacía]"}`
      );
    }
    console.error("Error inicializando base de datos", err);
    return res.status(500).json({ error: "Error de conexión a la base de datos" });
  }
});

// --- 4. Archivos estáticos (solo en modo local, Vercel sirve estáticos por CDN) ---
const frontendDistPath = path.join(__dirname, "..", "..", "frontend", "dist");
const frontendPublicPath = path.join(__dirname, "..", "..", "frontend", "public");
const staticPath = fs.existsSync(frontendDistPath) ? frontendDistPath : frontendPublicPath;

if (!isVercel) {
  app.use(express.static(staticPath));

  // Servir fotos/evidencias subidas (uploads)
  const uploadsPath = path.join(__dirname, '..', '..', 'uploads');
  const legacyUploadsPath = path.join(__dirname, '..', 'uploads');
  for (const dir of [uploadsPath, legacyUploadsPath]) {
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* read-only fs */ }
    }
  }
  app.use('/uploads', express.static(uploadsPath, { fallthrough: true }));
  app.use('/uploads', express.static(legacyUploadsPath, { fallthrough: true }));
}
app.use('/uploads', (req, res) => {
  return res.status(404).json({ error: 'Archivo no encontrado' });
});

// --- 5. Rate limiting ---
app.use("/api", apiLimiter);

// --- 6. Health check ---
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// --- 7. API Routes ---
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
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
app.use("/api/compras", comprasRoutes);
app.use("/api/directivo", directivoRoutes);
app.use("/api/patrimonio", patrimonioRoutes);
if (zonesRoutes) app.use("/api/zones", zonesRoutes);
if (zoneSchoolsRoutes) app.use("/api/zones", zoneSchoolsRoutes);
if (zoneSupervisorsRoutes) app.use("/api/zones", zoneSupervisorsRoutes);
app.use("/api/entregas", entregasRoutes);
app.use("/api/depositos", depositosRoutes);
app.use("/api/stock-institucion", stockInstitucionRoutes);

// --- 8. API 404 ---
app.use("/api", (req, res) => {
  return res.status(404).json({ error: "Ruta API no encontrada" });
});

// --- 9. SPA catch-all (solo modo local, Vercel maneja esto por CDN) ---
if (!isVercel) {
  app.get("*", (req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });
}

// --- 10. Error handler ---
app.use(errorHandler);

// --- 11. Iniciar servidor (solo modo standalone) ---
if (require.main === module) {
  ensureDbInitialized()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error("Error inicializando servidor", err);
      process.exit(1);
    });
}

module.exports = app;
