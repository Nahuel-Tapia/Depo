import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'

export default function App() {
  const { token } = useAuth()

  return (
    <Routes>
      <Route path="/" element={token ? <Dashboard /> : <Login />} />
      <Route path="/registro" element={token ? <Navigate to="/" /> : <Register />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
