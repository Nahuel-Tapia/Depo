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
      <Route path="/" element={token ? <Dashboard /> : <Login />} />
      <Route path="/print/remito-general/:id" element={token ? <PrintRemitoGeneral /> : <Login />} />
      <Route path="/registro" element={token ? <Navigate to="/" /> : <Register />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
