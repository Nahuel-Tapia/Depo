const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { get, run } = require("../db.pg");

const router = express.Router();

let authSchemaReady = false;

async function ensureAuthSchema() {
  if (authSchemaReady) return;
  await run(`ALTER TABLE usuario ADD COLUMN IF NOT EXISTS nivel_educativo VARCHAR(120)`);
  await run(`ALTER TABLE usuario ADD COLUMN IF NOT EXISTS director_area_id INT REFERENCES usuario(id_usuario)`);
  await run(`ALTER TABLE usuario ADD COLUMN IF NOT EXISTS jurisdiccion VARCHAR(120)`);
  authSchemaReady = true;
}

function normalizeDni(dni) {
  if (!dni) return "";
  return String(dni).replace(/\D/g, "");
}

function helpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function getInstitucionNivelColumn() {
  const row = await get(`
    SELECT CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'institucion' AND column_name = 'direccion_area'
      ) THEN 'direccion_area'
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'institucion' AND column_name = 'nivel_educativo'
      ) THEN 'nivel_educativo'
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'institucion' AND column_name = 'nivel'
      ) THEN 'nivel'
      ELSE NULL
    END AS col
  `);
  return row?.col || null;
}

router.post("/register", async (req, res) => {
  try {
    await ensureAuthSchema();
    const { nombre, email, cue, nivel_educativo, numero, password } = req.body;

    if (!nombre || !email || !cue || !nivel_educativo || !password) {
      return res.status(400).json({ error: "Nombre, email, CUE, nivel educativo y contraseña son obligatorios" });
    }

    const emailNormalized = String(email).trim().toLowerCase();
    if (!emailNormalized.includes("@")) {
      return res.status(400).json({ error: "El email no es válido" });
    }

    const cueNormalized = String(cue).replace(/\D/g, "");
    if (cueNormalized.length !== 9) {
      return res.status(400).json({ error: "El CUE debe tener exactamente 9 dígitos" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }

    // Verificar que la institución existe con ese CUE y nivel educativo
    const nivelColumn = await getInstitucionNivelColumn();
    if (!nivelColumn) {
      return res.status(500).json({ error: "Configuración inválida: falta columna de nivel en institucion" });
    }

    const institucion = await get(
      `SELECT id_institucion FROM institucion WHERE cue = ? AND LOWER(${nivelColumn}) = LOWER(?)`,
      [cueNormalized, nivel_educativo]
    );
    if (!institucion) {
      return res.status(404).json({ error: "No se encontró una institución con ese CUE y nivel educativo" });
    }

    // Verificar que no exista ya un usuario para esa institución+nivel
    const existing = await get(
      "SELECT id_usuario FROM usuario WHERE id_institucion = ? AND role = 'directivo' AND LOWER(COALESCE(nivel_educativo, '')) = LOWER(COALESCE(?, ''))",
      [institucion.id_institucion, nivel_educativo]
    );
    if (existing) {
      const code = helpCode();
      return res.status(409).json({
        ok: false,
        error: "Ya existe un usuario registrado para esa institución y nivel educativo",
        helpCode: code,
        message: `Ya existe un usuario registrado para esa institución y nivel educativo. Número de ayuda: ${code}`
      });
    }

    const existingEmail = await get("SELECT id_usuario FROM usuario WHERE LOWER(email) = ?", [emailNormalized]);
    if (existingEmail) {
      return res.status(409).json({ error: "Ya existe un usuario registrado con ese email" });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await run(
      "INSERT INTO usuario (nombre, email, dni, password, telefono, id_institucion, role, activo, nivel_educativo) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?)",
      [nombre.trim(), emailNormalized, cueNormalized, hash, numero || null, institucion.id_institucion, "directivo", nivel_educativo]
    );

    return res.status(201).json({
      ok: true,
      id: result.lastID,
      message: "Usuario creado correctamente. Ya puede iniciar sesión con su email"
    });
  } catch (err) {
    console.error("Error en registro:", err);
    const errMsg = String(err.message || "").toUpperCase();
    if (errMsg.includes("UNIQUE") || errMsg.includes("DUPLICATE")) {
      const code = helpCode();
      return res.status(409).json({
        ok: false,
        error: "Ya existe un usuario registrado con esos datos (Email o CUE)",
        helpCode: code,
        message: `Ya existe un usuario registrado con ese email o CUE. Número de ayuda: ${code}`
      });
    }
    return res.status(500).json({ ok: false, error: "Error al registrar usuario", details: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    await ensureAuthSchema();
    const { email, dni, cue, password } = req.body;
    // Acepta dni, cue, o un email que sea puramente numérico como identificador por DNI
    const rawNumeric = dni || cue || (/^\d+$/.test(String(email || "").trim()) ? String(email).trim() : "");
    const dniNormalized = normalizeDni(rawNumeric);
    const identifier = dniNormalized || (email ? String(email).trim().toLowerCase() : "");

    if (!identifier || !password) {
      return res.status(400).json({ error: "DNI/Email y contraseña son obligatorios" });
    }

    const user = dniNormalized
      ? await get("SELECT * FROM usuario WHERE dni = ?", [dniNormalized])
      : await get("SELECT * FROM usuario WHERE email = ?", [String(email).trim().toLowerCase()]);
    if (!user || !user.activo) {
      return res.status(401).json({
        code: "INVALID_CREDENTIALS",
        error: "No pudimos iniciar sesion con los datos ingresados. Verifique e intente nuevamente."
      });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({
        code: "INVALID_PASSWORD",
        error: "La contrasena ingresada es incorrecta. Revise la contrasena e intente nuevamente."
      });
    }

    // Obtener información de la institución si el usuario es directivo
    let institucionInfo = null;
    if (user.role === 'directivo' && user.id_institucion) {
      const institucion = await get(
        'SELECT id_institucion, nombre, cue FROM institucion WHERE id_institucion = ?',
        [user.id_institucion]
      );
      if (institucion) {
        institucionInfo = {
          id: institucion.id_institucion,
          nombre: institucion.nombre,
          cue: institucion.cue
        };
      }
    }

    const token = jwt.sign(
      {
        sub: user.id_usuario,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        dni: user.dni,
        role: user.role,
        nivel_educativo: user.nivel_educativo || null,
        director_area_id: user.director_area_id || null,
        jurisdiccion: user.jurisdiccion || null
      },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "8h" }
    );

    return res.json({
      ok: true,
      message: "Inicio de sesión correcto",
      token,
      user: {
        id: user.id_usuario,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        dni: user.dni,
        role: user.role,
        institucion: institucionInfo,
        nivel_educativo: user.nivel_educativo || null,
        director_area_id: user.director_area_id || null,
        jurisdiccion: user.jurisdiccion || null
      }
    });
  } catch (err) {
    return res.status(500).json({ error: "Error en login" });
  }
});

module.exports = router;
