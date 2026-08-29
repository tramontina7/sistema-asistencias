import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../api'

export default function AsignacionDocentes() {
  const navegar = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const cursoId = searchParams.get('curso') || ''
  const [cursos, setCursos] = useState([])
  const [materias, setMaterias] = useState([])

  useEffect(() => {
    api.get('/cursos').then(res => setCursos(res.data))
  }, [])

  const cambiarCurso = (id) => {
    setSearchParams(id ? { curso: id } : {}, { replace: true })
  }

  useEffect(() => {
    if (!cursoId) { setMaterias([]); return }
    api.get('/materias', { params: { curso_id: cursoId } })
      .then(res => setMaterias(res.data))
      .catch(() => setMaterias([]))
  }, [cursoId])

  return (
    <div>
      <h1>Asignación de Docentes</h1>

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

      {cursoId && (
        <div className="tabla table-alumnos">
          <div className="table-header">
            <span>Materia</span>
            <span>Especialidad</span>
            <span>Docente</span>
          </div>
          {materias.map(m => (
            <div
              key={m.materia_id}
              className="tabla-fila asignacion-fila"
              onClick={() => navegar(`/docentes/asignacion/${m.materia_id}`)}
            >
              <span className="materia-link">{m.nombre_materia}</span>
              <span>{m.especialidad}</span>
              <span>{m.docente_nombre ? `${m.docente_apellido}, ${m.docente_nombre}` : 'Sin docente'}</span>
            </div>
          ))}
          {materias.length === 0 && <p className="empty">No hay materias para este curso</p>}
        </div>
      )}

      {!cursoId && <p className="empty">Seleccioná un curso para asignar docentes</p>}
    </div>
  )
}