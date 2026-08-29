import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { IconLogout } from '../../icons'

export default function LogoutButton() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <button className="aside-logout" onClick={handleLogout}>
      <IconLogout size={15} />
      Cerrar sesión
    </button>
  )
}
