import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { apiFetch, withDirectorAreaQuery } from '../api'

const AuthContext = createContext(null)

const MASTER_DIRECTOR_STORAGE_KEY = 'depo_master_director_area_id'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token') || null)
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'))
  const [permissions, setPermissions] = useState([])
  const [masterDirectorAreaId, setMasterDirectorAreaIdState] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(MASTER_DIRECTOR_STORAGE_KEY) || '' : ''
  )

  const login = useCallback((newToken, newUser) => {
    setToken(newToken)
    setUser(newUser)
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(newUser))
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    setPermissions([])
    setMasterDirectorAreaIdState('')
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem(MASTER_DIRECTOR_STORAGE_KEY)
  }, [])

  const hasPermission = useCallback(
    (perm) => {
      if (user?.role === 'master') return true
      return permissions.includes(perm)
    },
    [permissions, user]
  )

  const setMasterDirectorAreaId = useCallback((id) => {
    const v = id == null || id === '' ? '' : String(id)
    setMasterDirectorAreaIdState(v)
    if (v) localStorage.setItem(MASTER_DIRECTOR_STORAGE_KEY, v)
    else localStorage.removeItem(MASTER_DIRECTOR_STORAGE_KEY)
  }, [])

  const withMasterDirector = useCallback(
    (url) => {
      if (user?.role !== 'master' || !masterDirectorAreaId) return url
      return withDirectorAreaQuery(url, masterDirectorAreaId)
    },
    [user?.role, masterDirectorAreaId]
  )

  const loadPermissions = useCallback(async () => {
    if (!token) {
      setPermissions([])
      return
    }
    try {
      const res = await apiFetch('/api/permissions/me', { token })
      if (res.status === 401) {
        logout()
        return
      }
      if (res.ok) {
        const data = await res.json()
        setPermissions(data.permissions || [])
      }
    } catch {
      setPermissions([])
    }
  }, [token, logout])

  useEffect(() => {
    if (token) {
      loadPermissions()
    }
  }, [token, loadPermissions])

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        permissions,
        login,
        logout,
        hasPermission,
        loadPermissions,
        masterDirectorAreaId,
        setMasterDirectorAreaId,
        withMasterDirector,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
