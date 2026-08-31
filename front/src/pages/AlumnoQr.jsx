import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import apiAlumno from '../apiAlumno'

const REFRESH_MS = 10000

export default function AlumnoQr() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const alumno = JSON.parse(localStorage.getItem('alumno_data') || '{}')
  const fetchingRef = useRef(false)

  const cerrarSesion = useCallback(() => {
    localStorage.removeItem('alumno_token')
    localStorage.removeItem('alumno_data')
    navigate('/alumno/login')
  }, [navigate])

  useEffect(() => {
    if (!localStorage.getItem('alumno_token')) {
      navigate('/alumno/login')
      return
    }

    const fetchQr = async () => {
      if (fetchingRef.current) return
      if (document.visibilityState === 'hidden') return
      fetchingRef.current = true
      try {
        const res = await apiAlumno.get('/qr/alumno')
        setData(res.data)
        setError('')
      } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          cerrarSesion()
          return
        }
        setError(err.response?.data?.error || 'Error al obtener QR')
      } finally {
        fetchingRef.current = false
        setLoading(false)
      }
    }

    fetchQr()
    const interval = setInterval(fetchQr, REFRESH_MS)
    return () => clearInterval(interval)
  }, [navigate, cerrarSesion])

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
          <p className="alumno-refresco">Este código se renueva cada 10 segundos</p>
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
