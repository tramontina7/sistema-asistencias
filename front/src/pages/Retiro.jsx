import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../api'

function hoyLocal() {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export default function Retiro() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const cursoId = searchParams.get('curso') || ''
  const [cursos, setCursos] = useState([])
  const [presentes, setPresentes] = useState([])
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const fecha = hoyLocal()

  useEffect(() => {
    api.get('/cursos').then(res => setCursos(res.data))
  }, [])

  useEffect(() => {
    if (!cursoId) {
      setPresentes([])
      return
    }
    setLoading(true)
    api.get('/retiros/presentes', { params: { curso_id: cursoId, fecha } })
      .then(res => setPresentes(res.data))
      .catch(err => setMensaje(err.response?.data?.error || 'Error al cargar presentes'))
      .finally(() => setLoading(false))
  }, [cursoId, fecha])

  const cambiarCurso = (id) => {
    setSearchParams(id ? { curso: id } : {}, { replace: true })
  }

  const cursoSel = cursos.find(c => String(c.curso_id) === String(cursoId))

  return (
    <div>
      <h1>Retiro de Alumnos</h1>
      <p className="subtitle">Seleccioná un curso para ver los alumnos presentes del día ({fecha}).</p>

      <div className="filters">
        <div className="form-group">
          <label>Curso</label>
          <select value={cursoId} onChange={e => cambiarCurso(e.target.value)}>
            <option value="">Seleccionar curso</option>
            {cursos.map(c => (
              <option key={c.curso_id} value={c.curso_id}>{c.nombre} · {c.especialidad}</option>
            ))}
          </select>
        </div>
      </div>

      {mensaje && <p className="error">{mensaje}</p>}

      {!cursoId && <p className="empty">Elegí un curso para listar los alumnos presentes.</p>}

      {cursoId && loading && <p className="empty">Cargando...</p>}

      {cursoId && !loading && presentes.length === 0 && (
        <p className="empty">No hay alumnos presentes de {cursoSel ? cursoSel.nombre : ''} hoy.</p>
      )}

      {cursoId && !loading && presentes.length > 0 && (
        <div className="tabla">
          <div className="table-header">
            <span>Apellido</span>
            <span>Nombre</span>
            <span>Comisión</span>
            <span>Curso</span>
            <span>Acciones</span>
          </div>
          {presentes.map(p => (
            <div key={p.alumno_id} className="tabla-fila">
              <span>{p.apellido}</span>
              <span>{p.nombre}</span>
              <span>{p.comision}</span>
              <span>{p.curso_nombre}</span>
              <span className="actions-cell">
                <button
                  className="btn-small"
                  onClick={() => navigate(`/retiro/nuevo/${p.alumno_id}`)}
                >
                  Retirar
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
