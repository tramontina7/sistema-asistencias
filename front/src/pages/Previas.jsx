import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api'

export default function Previas() {
  const [searchParams, setSearchParams] = useSearchParams()
  const cursoId = searchParams.get('curso') || ''
  const [cursos, setCursos] = useState([])
  const [previas, setPrevias] = useState([])
  const [mensaje, setMensaje] = useState('')

  const cambiarCurso = (id) => {
    setSearchParams(id ? { curso: id } : {}, { replace: true })
  }

  useEffect(() => {
    api.get('/cursos').then(res => setCursos(res.data))
  }, [])

  useEffect(() => {
    if (!cursoId) { setPrevias([]); return }
    api.get(`/previas/curso/${cursoId}`)
      .then(res => setPrevias(res.data))
      .catch(() => setPrevias([]))
  }, [cursoId])

  const cambiarEstado = async (previaId, nuevoEstado) => {
    try {
      await api.put(`/previas/${previaId}`, { estado: nuevoEstado })
      setPrevias(prev => prev.map(p => p.previa_id === previaId ? { ...p, estado: nuevoEstado } : p))
      setMensaje('Estado actualizado')
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al actualizar')
    }
  }

  const ponerNota = async (previaId, nota) => {
    try {
      await api.put(`/previas/${previaId}`, { nota: Number(nota), estado: 'Aprobada' })
      setPrevias(prev => prev.map(p => p.previa_id === previaId ? { ...p, nota: Number(nota), estado: 'Aprobada' } : p))
      setMensaje('Nota registrada')
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al guardar nota')
    }
  }

  return (
    <div>
      <h1>Previas</h1>

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

      {mensaje && <p className={mensaje.includes('Error') ? 'error' : 'success'}>{mensaje}</p>}

      {cursoId && (
        <div className="tabla table-alumnos">
          <div className="table-header">
            <span>Alumno</span>
            <span>Materia</span>
            <span>Año cursada</span>
            <span>Estado</span>
            <span>Nota</span>
            <span>Acciones</span>
          </div>
          {previas.map(p => (
            <div key={p.previa_id} className="tabla-fila">
              <span>{p.alumno_apellido}, {p.alumno_nombre}</span>
              <span>{p.nombre_materia}</span>
              <span>{p.anio_cursada}</span>
              <span>
                <select
                  value={p.estado}
                  onChange={e => cambiarEstado(p.previa_id, e.target.value)}
                  className="estado-select"
                >
                  <option value="Pendiente">Pendiente</option>
                  <option value="En Curso">En Curso</option>
                  <option value="Regularizada">Regularizada</option>
                  <option value="Aprobada">Aprobada</option>
                </select>
              </span>
              <span>
                {p.nota != null ? (
                  p.nota
                ) : p.estado === 'Aprobada' || p.estado === 'Regularizada' ? (
                  <input
                    type="number"
                    min="1"
                    max="10"
                    placeholder="Nota"
                    style={{ width: 50 }}
                    onBlur={e => e.target.value && ponerNota(p.previa_id, e.target.value)}
                  />
                ) : '-'}
              </span>
              <span className="actions-cell">
                {p.docente_nombre && <span className="muted">{p.docente_apellido}</span>}
              </span>
            </div>
          ))}
          {previas.length === 0 && <p className="empty">No hay previas para este curso</p>}
        </div>
      )}

      {!cursoId && <p className="empty">Seleccioná un curso para ver las previas</p>}
    </div>
  )
}
