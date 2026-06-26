class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = "No autorizado para acceder a este recurso.") {
    super(message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = "Permisos insuficientes para realizar esta acción.") {
    super(message, 403);
  }
}

class NotFoundError extends AppError {
  constructor(message = "El recurso solicitado no fue encontrado.") {
    super(message, 404);
  }
}

class ConflictError extends AppError {
  constructor(message, details = null) {
    super(message, 409, details);
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError
};
