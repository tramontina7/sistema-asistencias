import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import apiAlumno from '../apiAlumno'

export default function AlumnoQr() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const alumno = JSON.parse(localStorage.getItem('alumno_data') || '{}')

  useEffect(() => {
    if (!localStorage.getItem('alumno_token')) {
      navigate('/alumno/login')
      return
    }
    apiAlumno.get('/qr/alumno')
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.error || 'Error al obtener QR'))
      .finally(() => setLoading(false))
  }, [navigate])

  const cerrarSesion = () => {
    localStorage.removeItem('alumno_token')
    localStorage.removeItem('alumno_data')
    navigate('/alumno/login')
  }

  if (loading) return <div className="loading-page">Cargando tu código QR...</div>
  if (error) return (
    <div className="loading-page">
      <div className="alumno-error">
        <p className="error">{error}</p>
        <button className="btn-primary" onClick={cerrarSesion}>Volver a ingresar</button>
      </div>
    </div>
  )

  return (
    <div className="alumno-qr-page">
      <div className="alumno-qr-card">
        <div className="alumno-header">
          <h1>Tu Código QR</h1>
          <p className="alumno-nombre">{alumno.apellido}, {alumno.nombre}</p>
        </div>

        <div className="alumno-qr-code">
          {data?.token && (
            <QRCodeCanvas value={data.token} size={240} level="M" />
          )}
        </div>

        <p className="alumno-instruccion">
          Mostrale este código a tu preceptor para registrar tu asistencia
        </p>

        <button className="btn-secondary" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
