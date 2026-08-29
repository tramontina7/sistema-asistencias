import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  IconLogo,
  IconPanel,
  IconAsistencia,
  IconAlumnos,
  IconMaterias,
  IconReportes,
  IconPrevias,
  IconRetiro,
  IconDocentes,
  IconChevron,
} from '../icons'

const NAV = [
  { to: '/dashboard', label: 'Panel', Icon: IconPanel },
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
    children: [
      { to: '/alumnos', label: 'Ver alumnos', Icon: IconAlumnos },
    ],
  },
  {
    key: 'retiro',
    label: 'Retiro',
    Icon: IconRetiro,
    children: [
      { to: '/retiro/retirar', label: 'Retirar Alumno', Icon: IconRetiro },
      { to: '/retiro/tutores', label: 'Ver Tutores', Icon: IconAlumnos },
    ],
  },
  {
    key: 'materias',
    label: 'Cursos',
    Icon: IconMaterias,
    children: [
      { to: '/cursos', label: 'Materias y Horarios', Icon: IconMaterias },
      { to: '/cursos/comisiones', label: 'Comisiones', Icon: IconAlumnos },
      { to: '/previas', label: 'Previas', Icon: IconPrevias },
    ],
  },
  {
    key: 'docentes',
    label: 'Docentes',
    Icon: IconDocentes,
    children: [
      { to: '/docentes', label: 'Lista', Icon: IconDocentes },
      { to: '/docentes/asignacion', label: 'Asignación', Icon: IconMaterias },
      { to: '/docentes/disponibilidad', label: 'Disponibilidad / Licencias', Icon: IconAsistencia },
      { to: '/docentes/ausencias', label: 'Ausencias', Icon: IconAsistencia },
    ],
  },
]

const grupoDe = pathname =>
  NAV.find(item => item.children?.some(c => c.to === pathname || pathname.startsWith(c.to + '/')))?.key

export default function Sidebar() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [expandedKey, setExpandedKey] = useState(() => grupoDe(location.pathname))

  const toggleGroup = (key) => {
    setExpandedKey(prev => prev === key ? null : key)
  }

  const closeMenu = () => {}

  return (
    <>
      <header className="mobile-topbar">
        <h2>Asistencias</h2>
        <span className="user-info">{usuario?.nombre} {usuario?.apellido}</span>
      </header>
      <nav className="sidebar">
        <div className="sidebar-header">
          <button className="brand" onClick={() => navigate('/dashboard')} aria-label="Ir al panel">
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
                        onClick={closeMenu}
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
                onClick={closeMenu}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                <item.Icon />
                <span className="nav-label">{item.label}</span>
              </NavLink>
            )
          )}
        </div>
      </nav>
    </>
  )
}
