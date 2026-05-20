const errorHandler = (err, req, res, next) => {
  console.error("[ERROR GLOBAL]", err.stack || err.message || err);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Ha ocurrido un error interno en el servidor.";
  
  const response = {
    error: message,
    ok: false,
  };

  // En entorno de desarrollo podemos proveer más detalles
  if (process.env.NODE_ENV === "development" || !process.env.NODE_ENV) {
    response.stack = err.stack;
    response.details = err.details || null;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
