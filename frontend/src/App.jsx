import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import PrintRemitoGeneral from './pages/PrintRemitoGeneral'

export default function App() {
  const { token } = useAuth()

  return (
    <Routes>
      <Route path="/" element={token ? <Navigate to="/dashboard/inicio" replace /> : <Login />} />
      <Route path="/dashboard/:tab" element={token ? <Dashboard /> : <Navigate to="/" replace />} />
      <Route path="/print/remito-general/:id" element={token ? <PrintRemitoGeneral /> : <Navigate to="/" replace />} />
      <Route path="/registro" element={token ? <Navigate to="/dashboard/inicio" replace /> : <Register />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
