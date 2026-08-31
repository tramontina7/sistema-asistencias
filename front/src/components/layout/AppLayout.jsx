import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AppLayout() {
  return (
    <div className="layout">
      <Sidebar />
      <div className="main-area">
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}