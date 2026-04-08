const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { get, run } = require("../db.pg");

const router = express.Router();

function normalizeDni(dni) {
  if (!dni) return "";
  return String(dni).replace(/\D/g, "");
}

function helpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

router.post("/register", async (req, res) => {
  try {
    const { nombre, cue, nivel_educativo, numero, password } = req.body;

    if (!nombre || !cue || !nivel_educativo || !password) {
      return res.status(400).json({ error: "Nombre, CUE, nivel educativo y contraseña son obligatorios" });
    }

    const cueNormalized = String(cue).replace(/\D/g, "");
    if (cueNormalized.length !== 9) {
      return res.status(400).json({ error: "El CUE debe tener exactamente 9 dígitos" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }

    // Verificar que la institución existe con ese CUE y nivel educativo
    const institucion = await get(
      "SELECT id_institucion FROM institucion WHERE cue = ? AND nivel_educativo = ?",
      [cueNormalized, nivel_educativo]
    );
    if (!institucion) {
      return res.status(404).json({ error: "No se encontró una institución con ese CUE y nivel educativo" });
    }

    // Verificar que no exista ya un usuario para esa institución+nivel
    const existing = await get("SELECT id_usuario FROM usuario WHERE id_institucion = ?", [institucion.id_institucion]);
    if (existing) {
      const code = helpCode();
      return res.status(409).json({
        ok: false,
        error: "Ya existe un usuario registrado para esa institución y nivel educativo",
        helpCode: code,
        message: `Ya existe un usuario registrado para esa institución y nivel educativo. Número de ayuda: ${code}`
      });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await run(
      "INSERT INTO usuario (nombre, dni, password, telefono, id_institucion, role, activo) VALUES (?, ?, ?, ?, ?, ?, TRUE)",
      [nombre.trim(), cueNormalized, hash, numero || null, institucion.id_institucion, "directivo"]
    );

    return res.status(201).json({
      ok: true,
      id: result.lastID,
      message: "Usuario creado correctamente. Ya puede iniciar sesión con su CUE"
    });
  } catch (err) {
    console.error(err);
    if (String(err.message || "").includes("UNIQUE")) {
      const code = helpCode();
      return res.status(409).json({
        ok: false,
        error: "Ya existe un usuario registrado con ese CUE",
        helpCode: code,
        message: `Ya existe un usuario registrado con ese CUE. Número de ayuda: ${code}`
      });
    }
    return res.status(500).json({ ok: false, error: "Error al registrar usuario" });
  }
});

router.post("/login", async (req, res) => {
  try {
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

    const token = jwt.sign(
      {
        sub: user.id_usuario,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        dni: user.dni,
        role: user.role
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
        role: user.role
      }
    });
  } catch (err) {
    return res.status(500).json({ error: "Error en login" });
  }
});

module.exports = router;
