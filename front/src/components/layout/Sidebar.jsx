import { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  IconLogo,
  IconAsistencia,
  IconAlumnos,
  IconMaterias,
  IconReportes,
  IconEscanear,
  IconGenerar,
  IconChevron,
  IconLogout,
  IconClose,
} from '../icons'

const NAV = [
  {
    key: 'asistencias',
    label: 'Asistencias',
    Icon: IconAsistencia,
    children: [
      { to: '/asistencia', label: 'Tomar asistencia', Icon: IconAsistencia },
      { to: '/reportes', label: 'Reportes', Icon: IconReportes },
    ],
  },
  {
    key: 'alumnos',
    label: 'Alumnos',
    Icon: IconAlumnos,
    children: [{ to: '/alumnos', label: 'Ver alumnos', Icon: IconAlumnos }],
  },
  {
    key: 'materias',
    label: 'Cursos',
    Icon: IconMaterias,
    children: [
      { to: '/cursos', label: 'Materias y Horarios', Icon: IconMaterias },
      { to: '/cursos/comisiones', label: 'Comisiones', Icon: IconAlumnos },
    ],
  },
  {
    key: 'qr',
    label: 'QR',
    Icon: IconGenerar,
    children: [
      { to: '/qr/escanear', label: 'Escanear QR', Icon: IconEscanear },
    ],
  },
]

const grupoDe = pathname =>
  NAV.find(item => item.children?.some(c => c.to === pathname || pathname.startsWith(c.to + '/')))?.key

export default function Sidebar({ abierto = false, onToggle, onClose }) {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [expandedKey, setExpandedKey] = useState(() => grupoDe(location.pathname))

  const toggleGroup = (key) => {
    setExpandedKey(prev => prev === key ? null : key)
  }

  const handleLogout = () => {
    logout()
    onClose?.()
    navigate('/login')
  }

  // Cierra el drawer con la tecla Escape.
  useEffect(() => {
    if (!abierto) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [abierto, onClose])

  return (
    <>
      <header className="mobile-topbar">
        <button
          className={`menu-toggle${abierto ? ' open' : ''}`}
          onClick={onToggle}
          aria-label="Abrir menú"
          aria-expanded={abierto}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        <h2>Asistencias</h2>
        <span className="user-info">{usuario?.nombre} {usuario?.apellido}</span>
      </header>
      <nav className={`sidebar${abierto ? ' open' : ''}`}>
        <div className="sidebar-header">
          <button className="brand" onClick={() => { onClose?.(); navigate('/asistencia') }} aria-label="Ir a tomar asistencia">
            <IconLogo size={22} />
          </button>
          <button className="sidebar-close" onClick={onClose} aria-label="Cerrar menú">
            <IconClose size={20} />
          </button>
        </div>
        <div className="sidebar-links">
          {NAV.map(item =>
            item.children ? (
              <div key={item.key} className={`nav-group${expandedKey === item.key ? ' open' : ''}`}>
                <button
                  className="nav-group-toggle"
                  aria-expanded={expandedKey === item.key}
                  onClick={() => toggleGroup(item.key)}
                >
                  <item.Icon />
                  <span className="nav-label">{item.label}</span>
                  <IconChevron size={15} className="nav-chevron" />
                </button>
                <div className="nav-sublinks">
                  <div className="nav-sublinks-inner">
                    {item.children.map(({ to, label, Icon }) => (
                      <NavLink
                        key={to}
                        to={to}
                        end
                        className={({ isActive }) => (isActive ? 'active' : '')}
                        onClick={onClose}
                      >
                        <Icon size={15} />
                        <span>{label}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={onClose}
              >
                <item.Icon />
                <span className="nav-label">{item.label}</span>
              </NavLink>
            )
          )}
          <button className="sidebar-logout" data-tooltip="Cerrar sesión" onClick={handleLogout}>
            <IconLogout size={15} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </nav>
    </>
  )
}
