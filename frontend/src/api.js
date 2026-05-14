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

/** Appends director_area_id for master "acting as" director (backend reads query on all methods). */
export function withDirectorAreaQuery(url, directorAreaId) {
  const id = directorAreaId != null && directorAreaId !== '' ? String(directorAreaId).trim() : ''
  if (!id) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}director_area_id=${encodeURIComponent(id)}`
}
