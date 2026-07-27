/**
 * Helper de API para tests de Depo Stock.
 * Wrapper sobre Playwright request context con autenticación automática.
 */
const { API_URL } = require('./constants');

/**
 * Realiza un GET autenticado.
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} token - JWT token
 * @param {string} path - Path del endpoint (ej: '/api/productos')
 * @param {object} [params] - Query params opcionales
 * @returns {Promise<import('@playwright/test').APIResponse>}
 */
async function authGet(request, token, path, params = {}) {
  const url = path.startsWith('http') ? path : `${API_URL}${path.startsWith('/api') ? path.replace('/api', '') : path}`;
  const fullUrl = path.startsWith('http') ? path : `${API_URL}${path.replace(/^\/api/, '')}`;
  return request.get(fullUrl, {
    headers: { 'Authorization': `Bearer ${token}` },
    params
  });
}

/**
 * Realiza un POST autenticado.
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} token
 * @param {string} path
 * @param {object} data - Body del request
 * @returns {Promise<import('@playwright/test').APIResponse>}
 */
async function authPost(request, token, path, data = {}) {
  const fullUrl = path.startsWith('http') ? path : `${API_URL}${path.replace(/^\/api/, '')}`;
  return request.post(fullUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    data
  });
}

/**
 * Realiza un PATCH autenticado.
 */
async function authPatch(request, token, path, data = {}) {
  const fullUrl = path.startsWith('http') ? path : `${API_URL}${path.replace(/^\/api/, '')}`;
  return request.patch(fullUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    data
  });
}

/**
 * Realiza un PUT autenticado.
 */
async function authPut(request, token, path, data = {}) {
  const fullUrl = path.startsWith('http') ? path : `${API_URL}${path.replace(/^\/api/, '')}`;
  return request.put(fullUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    data
  });
}

/**
 * Realiza un DELETE autenticado.
 */
async function authDelete(request, token, path) {
  const fullUrl = path.startsWith('http') ? path : `${API_URL}${path.replace(/^\/api/, '')}`;
  return request.delete(fullUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
}

/**
 * Realiza un GET sin autenticación.
 */
async function publicGet(request, path, params = {}) {
  const fullUrl = path.startsWith('http') ? path : `${API_URL}${path.replace(/^\/api/, '')}`;
  return request.get(fullUrl, { params });
}

/**
 * Realiza un POST sin autenticación.
 */
async function publicPost(request, path, data = {}) {
  const fullUrl = path.startsWith('http') ? path : `${API_URL}${path.replace(/^\/api/, '')}`;
  return request.post(fullUrl, {
    headers: { 'Content-Type': 'application/json' },
    data
  });
}

module.exports = {
  authGet,
  authPost,
  authPatch,
  authPut,
  authDelete,
  publicGet,
  publicPost,
  API_URL
};
