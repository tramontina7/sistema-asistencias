import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../api'

export default function ListaDocentes() {
  const navegar = useNavigate()
  const [docentes, setDocentes] = useState([])
  const [mensaje, setMensaje] = useState('')

  const cargarDocentes = async () => {
    const res = await api.get('/docentes')
    setDocentes(res.data)
  }

  useEffect(() => {
    cargarDocentes()
  }, [])

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este docente?')) return
    try {
      await api.delete(`/docentes/${id}`)
      cargarDocentes()
      setMensaje('Docente eliminado')
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al eliminar')
    }
  }

  return (
    <div>
      <h1>Docentes</h1>

      <div className="actions">
        <Link to="/docentes/nuevo" className="btn-primary">+ Nuevo Docente</Link>
      </div>

      {mensaje && <p className={mensaje.includes('Error') ? 'error' : 'success'}>{mensaje}</p>}

      <div className="tabla table-alumnos tabla-docentes">
        <div className="table-header">
          <span>Apellido</span>
          <span>Nombre</span>
          <span>DNI</span>
          <span>Correo</span>
          <span>Teléfono</span>
          <span>Puede dictar</span>
          <span>Acciones</span>
        </div>
        {docentes.map(d => (
          <div key={d.docente_id} className="tabla-fila">
            <span>{d.apellido}</span>
            <span>{d.nombre}</span>
            <span>{d.dni}</span>
            <span>{d.correo || '-'}</span>
            <span>{d.telefono || '-'}</span>
            <span className="competencias-cell">
              {(d.puede_dictar || []).length > 0 ? (
                <Link
                  className="btn-small"
                  to={`/docentes/materias?docente=${d.docente_id}`}
                >
                  Ver ({d.puede_dictar.length})
                </Link>
              ) : '-'}
            </span>
            <span className="actions-cell">
              <button className="btn-small" onClick={() => navegar(`/docentes/editar/${d.docente_id}`)}>Editar</button>
              <button className="btn-elim btn-danger" onClick={() => handleDelete(d.docente_id)}>Eliminar</button>
            </span>
          </div>
        ))}
        {docentes.length === 0 && <p className="empty">No hay docentes</p>}
      </div>
    </div>
  )
}
