import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api'

export default function AlumnoLogin() {
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [dni, setDni] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/alumno/login', { nombre, apellido, dni })
      localStorage.setItem('alumno_token', res.data.token)
      localStorage.setItem('alumno_data', JSON.stringify(res.data.alumno))
      navigate('/alumno/qr')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Acceso Alumnos</h1>
        <p className="login-subtitle">Ingresá tus datos para ver tu código QR</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Tu nombre"
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label>Apellido</label>
            <input
              type="text"
              value={apellido}
              onChange={e => setApellido(e.target.value)}
              placeholder="Tu apellido"
              required
            />
          </div>
          <div className="form-group">
            <label>DNI</label>
            <input
              type="text"
              value={dni}
              onChange={e => setDni(e.target.value)}
              placeholder="Número de documento"
              inputMode="numeric"
              required
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
        <p className="login-footer-link">
          <Link to="/login">¿Sos preceptor? Ingresá acá</Link>
        </p>
      </div>
    </div>
  )
}
