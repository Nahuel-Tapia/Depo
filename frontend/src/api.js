export const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:4000' : '')

export function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  }
}

export function apiFetch(url, { token, ...options } = {}) {
  const headers = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const normalizedBase = API_URL.replace(/\/$/, '')
  let normalizedPath = url.startsWith('/') ? url : `/${url}`
  
  // Prevent duplicate /api if base already includes it
  if (normalizedBase.endsWith('/api') && normalizedPath.startsWith('/api')) {
    normalizedPath = normalizedPath.substring(4)
  }
  
  const fullUrl = url.startsWith('http') ? url : `${normalizedBase}${normalizedPath}`
  
  return fetch(fullUrl, { 
    ...options, 
    headers: { ...headers, ...options.headers } 
  })
}

/** Appends director_area_id for master "acting as" director (backend reads query on all methods). */
export function withDirectorAreaQuery(url, directorAreaId) {
  const id = directorAreaId != null && directorAreaId !== '' ? String(directorAreaId).trim() : ''
  if (!id) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}director_area_id=${encodeURIComponent(id)}`
}
