import { useAuth } from '../context/AuthContext'

const ROLE_LABELS = {
  admin: 'Administrador',
  directivo: 'Directivo',
  operador: 'Operador',
  consulta: 'Consulta'
}

export default function Inicio() {
  const { user } = useAuth()

  return (
    <div>
      <div className="stock-alert-box">
        <div className="stock-alert-title">
          <span className="stock-alert-triangle"></span>
          Bienvenido, {user?.nombre || 'Usuario'}
        </div>
        <p className="stock-alert-role">
          {ROLE_LABELS[user?.role] || user?.role || 'Sin rol'}
        </p>
      </div>
    </div>
  )
}
