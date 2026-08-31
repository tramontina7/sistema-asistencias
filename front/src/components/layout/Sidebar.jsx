import { useState } from 'react'
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
      { to: '/qr/generar', label: 'Generar QR', Icon: IconGenerar },
      { to: '/qr/escanear', label: 'Escanear QR', Icon: IconEscanear },
    ],
  },
]

const grupoDe = pathname =>
  NAV.find(item => item.children?.some(c => c.to === pathname || pathname.startsWith(c.to + '/')))?.key

export default function Sidebar() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [expandedKey, setExpandedKey] = useState(() => grupoDe(location.pathname))

  const toggleGroup = (key) => {
    setExpandedKey(prev => prev === key ? null : key)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
      <header className="mobile-topbar">
        <h2>Asistencias</h2>
        <span className="user-info">{usuario?.nombre} {usuario?.apellido}{usuario?.turno ? ` · ${usuario.turno}` : ''}</span>
      </header>
      <nav className="sidebar">
        <div className="sidebar-header">
          <button className="brand" onClick={() => navigate('/asistencia')} aria-label="Ir a tomar asistencia">
            <IconLogo size={22} />
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
              >
                <item.Icon />
                <span className="nav-label">{item.label}</span>
              </NavLink>
            )
          )}
          <button className="sidebar-logout" onClick={handleLogout}>
            <IconLogout size={15} />
            Cerrar sesión
          </button>
        </div>
      </nav>
    </>
  )
}