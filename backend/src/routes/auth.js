const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { get, run } = require("../db.pg");

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
    const { nombre, apellido, institucion, dni, email, password, telefono } = req.body;
    const dniNormalized = normalizeCue(dni);
    const emailNormalized = String(email || "").trim().toLowerCase();

    if (!nombre || !dniNormalized || !emailNormalized || !password) {
      return res.status(400).json({ error: "Nombre, DNI, email y contraseña son obligatorios" });
    }

    if (dniNormalized.length < 6 || dniNormalized.length > 12) {
      return res.status(400).json({ error: "El DNI debe tener entre 6 y 12 digitos" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNormalized)) {
      return res.status(400).json({ error: "El email no tiene un formato válido" });
    }

    const existingDni = await get("SELECT id_usuario FROM usuario WHERE dni = ?", [dniNormalized]);
    if (existingDni) {
      const code = helpCode();
      return res.status(409).json({
        ok: false,
        error: "El DNI ya está registrado",
        helpCode: code,
        message: `El DNI ya está registrado. Número de ayuda: ${code}`
      });
    }

    const existingEmail = await get("SELECT id_usuario FROM usuario WHERE email = ?", [emailNormalized]);
    if (existingEmail) {
      return res.status(409).json({ error: "El email ya está registrado" });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await run(
      "INSERT INTO usuario (nombre, apellido, dni, email, password, telefono, id_institucion, role, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)",
      [nombre.trim(), apellido || null, dniNormalized, emailNormalized, hash, telefono || null, institucion || null, "consulta"]
    );

    return res.status(201).json({
      ok: true,
      id: result.lastID,
      message: "Usuario creado correctamente. Ya puede iniciar sesión con su DNI"
    });
  } catch (err) {
    if (String(err.message || "").includes("UNIQUE")) {
      const code = helpCode();
      return res.status(409).json({
        ok: false,
        error: "El DNI ya está registrado",
        helpCode: code,
        message: `El DNI ya está registrado. Número de ayuda: ${code}`
      });
    }
    return res.status(500).json({ ok: false, error: "Error al registrar usuario" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, dni, password } = req.body;
    const dniNormalized = normalizeCue(dni);
    const identifier = email || dniNormalized;

    if (!identifier || !password) {
      return res.status(400).json({ error: "DNI/Email y contraseña son obligatorios" });
    }

    const user = dniNormalized
      ? await get("SELECT * FROM usuario WHERE dni = ?", [dniNormalized])
      : await get("SELECT * FROM usuario WHERE email = ?", [email]);
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
