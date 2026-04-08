export function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  }
}

export function apiFetch(url, { token, ...options } = {}) {
  const headers = token ? authHeaders(token) : { 'Content-Type': 'application/json' }
  return fetch(url, { ...options, headers: { ...headers, ...options.headers } })
}
