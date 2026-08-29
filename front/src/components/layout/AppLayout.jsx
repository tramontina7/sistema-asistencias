import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Aside from './Aside'
import { AsideProvider } from '../../context/AsideContext'

export default function AppLayout() {
  return (
    <AsideProvider>
      <div className="layout">
        <Sidebar />
        <div className="main-area">
          <main className="content">
            <Outlet />
          </main>
          <Aside />
        </div>
      </div>
    </AsideProvider>
  )
}
