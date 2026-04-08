import { useAuth } from '../context/AuthContext'

export default function Inicio() {
  const { user } = useAuth()

  return (
    <div>
      <div className="stock-alert-box">
        <div className="stock-alert-title">
          <span className="stock-alert-triangle"></span>
          Bienvenido al Sistema de Depósito
        </div>
        <p className="stock-alert-role">
          Rol: {user?.role || 'Sin rol'}
        </p>
      </div>
    </div>
  )
}
