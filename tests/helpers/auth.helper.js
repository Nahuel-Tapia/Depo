/**
 * Helper de autenticación para tests de Depo Stock.
 * Provee funciones para login de cada rol del sistema.
 */
const { API_URL, TEST_USERS } = require('./constants');

// Cache de tokens para evitar logins repetitivos
const tokenCache = new Map();

/**
 * Realiza login con un rol específico y devuelve { token, user }.
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} role - Nombre del rol (admin, directivo, supervisor, etc.)
 * @param {object} [overrideCredentials] - Credenciales alternativas { email, password }
 * @returns {Promise<{ token: string, user: object }>}
 */
async function loginAs(request, role, overrideCredentials = null) {
  const credentials = overrideCredentials || TEST_USERS[role];
  if (!credentials) {
    throw new Error(`No se encontraron credenciales para el rol: ${role}`);
  }

  const response = await request.post(`${API_URL}/auth/login`, {
    data: {
      email: credentials.email,
      password: credentials.password
    }
  });

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Login fallido para ${role} (${credentials.email}): ${response.status()} - ${text}`);
  }

  const body = await response.json();
  return {
    token: body.token,
    user: body.user
  };
}

/**
 * Obtiene solo el token JWT para un rol, usando cache cuando es posible.
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} role
 * @returns {Promise<string>}
 */
async function getToken(request, role) {
  if (tokenCache.has(role)) {
    return tokenCache.get(role);
  }
  const { token } = await loginAs(request, role);
  tokenCache.set(role, token);
  return token;
}

/**
 * Realiza login con credenciales arbitrarias (no de un rol conocido).
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('@playwright/test').APIResponse>}
 */
async function loginRaw(request, email, password) {
  return request.post(`${API_URL}/auth/login`, {
    data: { email, password }
  });
}

/**
 * Realiza login por CUE (modo directivo).
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} cue
 * @param {string} password
 * @returns {Promise<import('@playwright/test').APIResponse>}
 */
async function loginByCue(request, cue, password) {
  return request.post(`${API_URL}/auth/login`, {
    data: { cue, password }
  });
}

/**
 * Realiza login por DNI.
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} dni
 * @param {string} password
 * @returns {Promise<import('@playwright/test').APIResponse>}
 */
async function loginByDni(request, dni, password) {
  return request.post(`${API_URL}/auth/login`, {
    data: { dni, password }
  });
}

module.exports = {
  loginAs,
  getToken,
  loginRaw,
  loginByCue,
  loginByDni,
  tokenCache
};
