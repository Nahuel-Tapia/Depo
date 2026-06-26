const rateLimit = require("express-rate-limit");

/**
 * Rate limiter para rutas de autenticación (login/register).
 * Más restrictivo: 10 intentos por ventana de 15 minutos.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos de autenticación. Intentá de nuevo en 15 minutos.",
  },
});

/**
 * Rate limiter general para la API.
 * 200 requests por ventana de 1 minuto por IP.
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiadas solicitudes. Intentá de nuevo en un momento.",
  },
});

module.exports = { authLimiter, apiLimiter };
