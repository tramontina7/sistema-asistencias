import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

export default function Tutores() {
  const navigate = useNavigate()
  const [tutores, setTutores] = useState([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState('')

  const cargar = () => {
    api.get('/retiros/tutores')
      .then(res => setTutores(res.data))
      .catch(err => setMensaje(err.response?.data?.error || 'Error al cargar tutores'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [])

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este tutor?')) return
    try {
      await api.delete(`/retiros/tutores/${id}`)
      setMensaje('Tutor eliminado')
      cargar()
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al eliminar')
    }
  }

  return (
    <div>
      <h1>Tutores</h1>

      <div className="actions">
        <button className="btn-primary" onClick={() => navigate('/retiro/tutores/nuevo')}>+ Nuevo Tutor</button>
      </div>

      {mensaje && <p className={mensaje.includes('Error') ? 'error' : 'success'}>{mensaje}</p>}

      {loading && <p className="empty">Cargando...</p>}

      {!loading && tutores.length === 0 && <p className="empty">No hay tutores registrados</p>}

      {!loading && tutores.length > 0 && (
        <div className="tabla">
          <div className="table-header">
            <span>Apellido</span>
            <span>Nombre</span>
            <span>DNI</span>
            <span>Teléfono</span>
            <span>Alumnos a cargo</span>
            <span>Acciones</span>
          </div>
          {tutores.map(t => (
            <div key={t.tutor_id} className="tabla-fila">
              <span>{t.apellido}</span>
              <span>{t.nombre}</span>
              <span>{t.dni}</span>
              <span>{t.telefono || '-'}</span>
              <span>
                {t.vinculos && t.vinculos.length > 0
                  ? t.vinculos.map(v => `${v.apellido}, ${v.nombre}`).join(' · ')
                  : '-'}
              </span>
              <span className="actions-cell">
                <button className="btn-small" onClick={() => navigate(`/retiro/tutores/editar/${t.tutor_id}`)}>Editar</button>
                <button className="btn-elim btn-danger" onClick={() => handleDelete(t.tutor_id)}>Eliminar</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
