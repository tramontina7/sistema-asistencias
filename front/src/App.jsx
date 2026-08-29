import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Asistencia from './pages/Asistencia'
import Alumnos from './pages/Alumnos'
import Cursos from './pages/Cursos'
import VerComisiones from './pages/VerComisiones'
import Reportes from './pages/Reportes'
import Previas from './pages/Previas'
import Retiro from './pages/Retiro'
import RetiroNuevo from './pages/RetiroNuevo'
import Tutores from './pages/Tutores'
import FormTutor from './pages/FormTutor'
import ListaDocentes from './pages/docentes/ListaDocentes'
import AsignacionDocentes from './pages/docentes/AsignacionDocentes'
import AsignarDocente from './pages/docentes/AsignarDocente'
import DisponibilidadDocentes from './pages/docentes/DisponibilidadDocentes'
import DocenteMaterias from './pages/docentes/DocenteMaterias'
import FormDocente from './pages/docentes/FormDocente'
import Ausencias from './pages/docentes/Ausencias'
import QrGenerar from './pages/QrGenerar'
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
          <Route element={<PrivateRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/asistencia" element={<Asistencia />} />
            <Route path="/alumnos" element={<Alumnos />} />
            <Route path="/cursos" element={<Cursos />} />
            <Route path="/cursos/comisiones" element={<VerComisiones />} />
            <Route path="/reportes" element={<Reportes />} />
            <Route path="/previas" element={<Previas />} />
            <Route path="/retiro" element={<Navigate to="/retiro/retirar" />} />
            <Route path="/retiro/retirar" element={<Retiro />} />
            <Route path="/retiro/nuevo/:alumnoId" element={<RetiroNuevo />} />
            <Route path="/retiro/tutores" element={<Tutores />} />
            <Route path="/retiro/tutores/nuevo" element={<FormTutor />} />
            <Route path="/retiro/tutores/editar/:id" element={<FormTutor />} />
            <Route path="/docentes" element={<ListaDocentes />} />
            <Route path="/docentes/nuevo" element={<FormDocente />} />
            <Route path="/docentes/editar/:id" element={<FormDocente />} />
            <Route path="/docentes/materias" element={<DocenteMaterias />} />
            <Route path="/docentes/asignacion" element={<AsignacionDocentes />} />
            <Route path="/docentes/asignacion/:materiaId" element={<AsignarDocente />} />
            <Route path="/docentes/disponibilidad" element={<DisponibilidadDocentes />} />
            <Route path="/docentes/ausencias" element={<Ausencias />} />
            <Route path="/qr/generar" element={<QrGenerar />} />
            <Route path="/qr/escanear" element={<QrEscanear />} />
          </Route>
          <Route path="/alumno/login" element={<AlumnoLogin />} />
          <Route path="/alumno/qr" element={<AlumnoQr />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
