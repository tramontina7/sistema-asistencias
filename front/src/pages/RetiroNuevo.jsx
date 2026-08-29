import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../api'

function hoyLocal() {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export default function RetiroNuevo() {
  const { alumnoId } = useParams()
  const navigate = useNavigate()
  const [alumno, setAlumno] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ nombre: '', apellido: '', dni: '' })
  const [enviando, setEnviando] = useState(false)
  const fecha = hoyLocal()

  useEffect(() => {
    api.get(`/alumnos/${alumnoId}`)
      .then(res => setAlumno(res.data))
      .catch(() => setError('No se pudo cargar el alumno'))
      .finally(() => setLoading(false))
  }, [alumnoId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nombre || !form.apellido || !form.dni) return
    setEnviando(true)
    try {
      await api.post('/retiros', {
        alumnoId: Number(alumnoId),
        nombre: form.nombre,
        apellido: form.apellido,
        dni: form.dni,
        fecha,
      })
      alert('Retiro registrado correctamente.')
      navigate('/retiro/retirar')
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al realizar el retiro'
      alert(msg === 'Persona no Autorizada' ? 'Persona no Autorizada' : msg)
      setEnviando(false)
    }
  }

  if (loading) return <div className="loading-page">Cargando...</div>
  if (error) return <div><h1>Retiro</h1><p className="error">{error}</p><Link to="/retiro/retirar" className="btn-secondary">Volver</Link></div>

  return (
    <div>
      <h1>Realizar Retiro</h1>
      <p className="subtitle">
        Alumno: <strong>{alumno.apellido}, {alumno.nombre}</strong>
      </p>

      <div className="form-group" style={{ maxWidth: 420 }}>
        <label>Datos de la persona autorizada</label>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre</label>
            <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Apellido</label>
            <input value={form.apellido} onChange={e => setForm({ ...form, apellido: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>DNI</label>
            <input value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} required />
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn-primary" disabled={enviando}>
              {enviando ? 'Procesando...' : 'Confirmar Retiro'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate('/retiro/retirar')}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
