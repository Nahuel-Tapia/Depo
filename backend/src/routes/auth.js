const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { get, run } = require("../db");

const router = express.Router();

function normalizeCue(cue) {
  if (!cue) return "";
  return String(cue).replace(/\D/g, "");
}

function helpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

router.post("/register", async (req, res) => {
  try {
    const { nombre, cue, numero, password } = req.body;
    const cueNormalized = normalizeCue(cue);
    const numeroNormalized = String(numero || "").replace(/\D/g, "");

    if (!nombre || !cueNormalized || !numeroNormalized || !password) {
      return res.status(400).json({ error: "Nombre, CUE, número y contraseña son obligatorios" });
    }

    if (cueNormalized.length !== 9) {
      return res.status(400).json({ error: "El CUE debe tener exactamente 9 dígitos" });
    }

    if (numeroNormalized.length < 6) {
      return res.status(400).json({ error: "El número debe tener al menos 6 dígitos" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }

    const institucion = await get(
      "SELECT id, nombre, activo FROM instituciones WHERE cue = ?",
      [cueNormalized]
    );
    if (!institucion || !institucion.activo) {
      return res.status(404).json({ error: "escuela no registrada" });
    }

    const existingCue = await get("SELECT id FROM users WHERE cue = ?", [cueNormalized]);
    if (existingCue) {
      const code = helpCode();
      return res.status(409).json({
        ok: false,
        error: "El CUE ya está registrado",
        helpCode: code,
        message: `El CUE ya está registrado. Número de ayuda: ${code}`
      });
    }

    const emailGenerated = `${cueNormalized}.${numeroNormalized}@registro.local`;
    const existingEmail = await get("SELECT id FROM users WHERE email = ?", [emailGenerated]);
    if (existingEmail) {
      return res.status(409).json({ error: "Ya existe un registro para ese CUE y número" });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await run(
      "INSERT INTO users (nombre, email, cue, password_hash, role, institucion, activo) VALUES (?, ?, ?, ?, ?, ?, 1)",
      [nombre.trim(), emailGenerated, cueNormalized, hash, "directivo", institucion.nombre]
    );

    return res.status(201).json({
      ok: true,
      id: result.lastID,
      message: "Usuario creado correctamente. Ya puede iniciar sesión con su CUE"
    });
  } catch (err) {
    if (String(err.message || "").includes("UNIQUE")) {
      const code = helpCode();
      return res.status(409).json({
        ok: false,
        error: "El CUE ya está registrado",
        helpCode: code,
        message: `El CUE ya está registrado. Número de ayuda: ${code}`
      });
    }
    return res.status(500).json({ ok: false, error: "Error al registrar usuario" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, cue, password } = req.body;
    const cueNormalized = normalizeCue(cue);
    const identifier = email || cueNormalized;

    if (!identifier || !password) {
      return res.status(400).json({ error: "CUE/Email y contraseña son obligatorios" });
    }

    const user = cueNormalized
      ? await get("SELECT * FROM users WHERE cue = ?", [cueNormalized])
      : await get("SELECT * FROM users WHERE email = ?", [email]);
    if (!user || !user.activo) {
      return res.status(401).json({
        code: "INVALID_CREDENTIALS",
        error: "No pudimos iniciar sesion con los datos ingresados. Verifique e intente nuevamente."
      });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({
        code: "INVALID_PASSWORD",
        error: "La contrasena ingresada es incorrecta. Revise la contrasena e intente nuevamente."
      });
    }

    const token = jwt.sign(
      {
        sub: user.id,
        nombre: user.nombre,
        email: user.email,
        cue: user.cue,
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
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        cue: user.cue,
        role: user.role
      }
    });
  } catch (err) {
    return res.status(500).json({ error: "Error en login" });
  }
});

module.exports = router;
