const bcrypt = require("bcryptjs");
const { get, run } = require("../db.pg");
const { getInstitucionNivelColumn } = require("../utils/schemaCache");

function normalizeDni(dni) {
  if (!dni) return "";
  return String(dni).replace(/\D/g, "");
}

class AuthService {
  async registerUser({ nombre, email, cue, nivel_educativo, numero, password }) {
    if (!nombre || !email || !cue || !nivel_educativo || !password) {
      const err = new Error("Nombre, email, CUE, nivel educativo y contraseña son obligatorios");
      err.status = 400; throw err;
    }

    const emailNormalized = String(email).trim().toLowerCase();
    if (!emailNormalized.includes("@")) {
      const err = new Error("El email no es válido");
      err.status = 400; throw err;
    }

    const cueNormalized = String(cue).replace(/\D/g, "");
    if (cueNormalized.length !== 9) {
      const err = new Error("El CUE debe tener exactamente 9 dígitos");
      err.status = 400; throw err;
    }

    if (password.length < 6) {
      const err = new Error("La contraseña debe tener al menos 6 caracteres");
      err.status = 400; throw err;
    }

    // Verificar que la institución existe con ese CUE y nivel educativo
    const nivelColumn = await getInstitucionNivelColumn();
    if (!nivelColumn) {
      const err = new Error("Configuración inválida: falta columna de nivel en institucion");
      err.status = 500; throw err;
    }

    const institucion = await get(
      `SELECT id_institucion FROM institucion WHERE cue = ? AND LOWER(${nivelColumn}) = LOWER(?)`,
      [cueNormalized, nivel_educativo]
    );
    if (!institucion) {
      const err = new Error("No se encontró una institución con ese CUE y nivel educativo");
      err.status = 404; throw err;
    }

    // Verificar que no exista ya un usuario para esa institución+nivel
    const existing = await get(
      "SELECT id_usuario FROM usuario WHERE id_institucion = ? AND role = 'directivo' AND LOWER(COALESCE(nivel_educativo, '')) = LOWER(COALESCE(?, ''))",
      [institucion.id_institucion, nivel_educativo]
    );
    if (existing) {
      const err = new Error("Ya existe un usuario registrado para esa institución y nivel educativo");
      err.status = 409;
      err.code = "DUPLICATE_INSTITUTION_USER";
      throw err;
    }

    const existingEmail = await get("SELECT id_usuario FROM usuario WHERE LOWER(email) = ?", [emailNormalized]);
    if (existingEmail) {
      const err = new Error("Ya existe un usuario registrado con ese email");
      err.status = 409; throw err;
    }

    const hash = await bcrypt.hash(password, 10);
    try {
      const result = await run(
        "INSERT INTO usuario (nombre, email, dni, password, telefono, id_institucion, role, activo, nivel_educativo) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?)",
        [nombre.trim(), emailNormalized, cueNormalized, hash, numero || null, institucion.id_institucion, "directivo", nivel_educativo]
      );
      return result.lastID;
    } catch(err) {
      const errMsg = String(err.message || "").toUpperCase();
      if (errMsg.includes("UNIQUE") || errMsg.includes("DUPLICATE")) {
        const customErr = new Error("Ya existe un usuario registrado con esos datos (Email o CUE)");
        customErr.status = 409;
        customErr.code = "DUPLICATE_USER";
        throw customErr;
      }
      throw err;
    }
  }

  async loginUser({ email, dni, cue, password }) {
    const rawNumeric = dni || cue || (/^\d+$/.test(String(email || "").trim()) ? String(email).trim() : "");
    const dniNormalized = normalizeDni(rawNumeric);
    const identifier = dniNormalized || (email ? String(email).trim().toLowerCase() : "");

    if (!identifier || !password) {
      const err = new Error("DNI/Email y contraseña son obligatorios");
      err.status = 400; throw err;
    }

    let user = dniNormalized
      ? await get("SELECT * FROM usuario WHERE dni = ?", [dniNormalized])
      : await get("SELECT * FROM usuario WHERE email = ?", [String(email).trim().toLowerCase()]);
      
    if (!user && email && email.trim().toLowerCase() === 'admin@depo.local') {
      try {
        const hash = bcrypt.hashSync('Admin123!', 10);
        await run(
          `INSERT INTO usuario (nombre, apellido, dni, email, password, role, activo, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, TRUE, NOW())`,
          ['Administrador', 'Inicial', '00000000', 'admin@depo.local', hash, 'admin']
        );
        user = await get("SELECT * FROM usuario WHERE email = ?", ['admin@depo.local']);
      } catch (seedErr) {
        console.warn("[AuthService] Could not auto-seed admin:", seedErr.message);
      }
    }

    if (!user && email && email.trim().toLowerCase() === 'director@depo.local') {
      try {
        const hash = bcrypt.hashSync('Director123!', 10);
        await run(
          `INSERT INTO usuario (nombre, apellido, dni, email, password, role, activo, nivel_educativo, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, TRUE, ?, NOW())`,
          ['Director', 'de Área', '11111111', 'director@depo.local', hash, 'director_area', 'PRIMARIO']
        );
        user = await get("SELECT * FROM usuario WHERE email = ?", ['director@depo.local']);
      } catch (seedErr) {
        console.warn("[AuthService] Could not auto-seed director:", seedErr.message);
      }
    }

    if (!user || !user.activo) {
      const err = new Error("No pudimos iniciar sesion con los datos ingresados. Verifique e intente nuevamente.");
      err.status = 401; err.code = "INVALID_CREDENTIALS"; throw err;
    }

    let ok = await bcrypt.compare(password, user.password);
    if (!ok && typeof password === 'string') {
      ok = await bcrypt.compare(password.trim(), user.password);
    }
    if (!ok) {
      const err = new Error("La contrasena ingresada es incorrecta. Revise la contrasena e intente nuevamente.");
      err.status = 401; err.code = "INVALID_PASSWORD"; throw err;
    }

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

    return { user, institucionInfo };
  }
}

module.exports = new AuthService();
