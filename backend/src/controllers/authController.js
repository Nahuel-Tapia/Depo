const jwt = require("jsonwebtoken");
const authService = require("../services/authService");

function helpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

exports.register = async (req, res, next) => {
  try {
    const id = await authService.registerUser(req.body);
    return res.status(201).json({
      ok: true,
      id,
      message: "Usuario creado correctamente. Ya puede iniciar sesión con su email"
    });
  } catch (err) {
    const status = err.status || 500;
    
    if (err.code === "DUPLICATE_INSTITUTION_USER" || err.code === "DUPLICATE_USER") {
      const code = helpCode();
      return res.status(409).json({
        ok: false,
        error: err.message,
        helpCode: code,
        message: `${err.message}. Número de ayuda: ${code}`
      });
    }

    return res.status(status).json({ 
      ok: false, 
      error: err.message || "Error al registrar usuario", 
      details: err.message 
    });
  }
};

exports.login = async (req, res, next) => {
  try {
    const { user, institucionInfo } = await authService.loginUser(req.body);
    
    const token = jwt.sign(
      {
        sub: user.id_usuario,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        dni: user.dni,
        role: user.role,
        nivel_educativo: user.nivel_educativo || null,
        director_area_id: user.director_area_id || null
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
        director_area_id: user.director_area_id || null
      }
    });
  } catch (err) {
    const status = err.status || 500;
    // Don't leak technical details on login, just the exact error message we crafted
    return res.status(status).json({ 
      error: err.message || "Error en login",
      code: err.code || "INTERNAL_ERROR"
    });
  }
};
