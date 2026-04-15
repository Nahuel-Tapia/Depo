import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token') || null)
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'))
  const [permissions, setPermissions] = useState([])

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
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }, [])

  const hasPermission = useCallback((perm) => {
    return permissions.includes(perm)
  }, [permissions])

 const loadPermissions = useCallback(async () => {
  if (!token) {
    setPermissions([])
    return
  }

  try {
    const data = await apiFetch('/permissions/me') // ✅ FIX

    setPermissions(data.permissions || [])
  } catch (err) {
    console.error('Error cargando permisos:', err)
    logout()
  }
}, [token, logout])

  useEffect(() => {
    if (token) {
      loadPermissions()
    }
  }, [token, loadPermissions])

  return (
    <AuthContext.Provider value={{ token, user, permissions, login, logout, hasPermission, loadPermissions }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
