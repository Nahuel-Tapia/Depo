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
    const { nombre, cue, email, password } = req.body;
    const cueNormalized = normalizeCue(cue);
    const emailNormalized = String(email || "").trim().toLowerCase();

    if (!nombre || !cueNormalized || !emailNormalized || !password) {
      return res.status(400).json({ error: "Nombre, CUE, email y contraseña son obligatorios" });
    }

    if (cueNormalized.length < 6 || cueNormalized.length > 12) {
      return res.status(400).json({ error: "El CUE debe tener entre 6 y 12 digitos" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNormalized)) {
      return res.status(400).json({ error: "El email no tiene un formato válido" });
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

    const existingEmail = await get("SELECT id FROM users WHERE email = ?", [emailNormalized]);
    if (existingEmail) {
      return res.status(409).json({ error: "El email ya está registrado" });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await run(
      "INSERT INTO users (nombre, email, cue, password_hash, role, activo) VALUES (?, ?, ?, ?, ?, 1)",
      [nombre.trim(), emailNormalized, cueNormalized, hash, "consulta"]
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
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Credenciales inválidas" });
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
