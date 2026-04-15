const jwt = require("jsonwebtoken");
const { hasPermission } = require("../permissions");


function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Token no enviado" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido" });
  }
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "No autorizado" });
    }
    return next();
  };
}

function authorizePermissions(...permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const hasAllPermissions = permissions.every((permission) =>
      hasPermission(req.user.role, permission)
    );

    if (!hasAllPermissions) {
      return res.status(403).json({ error: "No tenés permisos suficientes" });
    }

    return next();
  };
}

module.exports = {
  authenticate,
  authorizeRoles,
  authorizePermissions
};
