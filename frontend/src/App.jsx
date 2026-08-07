import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const PrintRemitoGeneral = lazy(() => import('./pages/PrintRemitoGeneral'))

function LoadingFallback() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#64748b' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>Cargando módulo...</p>
      </div>
    </div>
  )
}

export default function App() {
  const { token } = useAuth()

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={token ? <Navigate to="/dashboard/inicio" replace /> : <Login />} />
        <Route path="/dashboard/:tab" element={token ? <Dashboard /> : <Navigate to="/" replace />} />
        <Route path="/print/remito-general/:id" element={token ? <PrintRemitoGeneral /> : <Navigate to="/" replace />} />
        <Route path="/registro" element={token ? <Navigate to="/dashboard/inicio" replace /> : <Register />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
