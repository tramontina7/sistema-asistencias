import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/Login'
import Asistencia from './pages/Asistencia'
import Alumnos from './pages/Alumnos'
import PerfilAlumno from './pages/PerfilAlumno'
import Cursos from './pages/Cursos'
import VerComisiones from './pages/VerComisiones'
import Reportes from './pages/Reportes'
import QrEscanear from './pages/QrEscanear'
import AlumnoLogin from './pages/AlumnoLogin'
import AlumnoQr from './pages/AlumnoQr'

function PrivateRoute() {
  const { usuario, loading } = useAuth()
  if (loading) return <div className="loading-page">Cargando...</div>
  return usuario ? <AppLayout /> : <Navigate to="/login" />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/alumno/login" element={<AlumnoLogin />} />
          <Route path="/alumno/qr" element={<AlumnoQr />} />
          <Route element={<PrivateRoute />}>
            <Route path="/asistencia" element={<Asistencia />} />
            <Route path="/alumnos" element={<Alumnos />} />
            <Route path="/alumnos/perfil" element={<PerfilAlumno />} />
            <Route path="/cursos" element={<Cursos />} />
            <Route path="/cursos/comisiones" element={<VerComisiones />} />
            <Route path="/reportes" element={<Reportes />} />
            <Route path="/qr/escanear" element={<QrEscanear />} />
          </Route>
          <Route path="*" element={<Navigate to="/asistencia" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App