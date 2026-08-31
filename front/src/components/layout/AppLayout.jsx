import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AppLayout() {
  const [menuAbierto, setMenuAbierto] = useState(false)

  const cerrarMenu = () => setMenuAbierto(false)

  return (
    <div className="layout">
      <Sidebar abierto={menuAbierto} onToggle={() => setMenuAbierto(o => !o)} onClose={cerrarMenu} />
      {menuAbierto && <div className="sidebar-overlay" onClick={cerrarMenu} aria-hidden="true" />}
      <div className="main-area">
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
