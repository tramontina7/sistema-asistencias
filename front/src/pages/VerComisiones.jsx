import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api'

const COMISIONES = [
  { value: 'A', label: 'Comisión A' },
  { value: 'B', label: 'Comisión B' },
]

export default function VerComisiones() {
  const [searchParams, setSearchParams] = useSearchParams()
  const cursoId = searchParams.get('curso') || ''
  const [cursos, setCursos] = useState([])
  const [alumnos, setAlumnos] = useState([])
  const [pendientes, setPendientes] = useState({})
  const [cursoPendientes, setCursoPendientes] = useState({})
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    api.get('/cursos').then(res => setCursos(res.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!cursoId) {
      setAlumnos([])
      setPendientes({})
      setCursoPendientes({})
      return
    }
    api.get('/alumnos', { params: { curso_id: cursoId } })
      .then(res => {
        setAlumnos(res.data)
        setPendientes({})
        setCursoPendientes({})
      })
      .catch(() => setMensaje('Error al cargar alumnos'))
  }, [cursoId])

  const labelDe = (v) => {
    const c = COMISIONES.find(c => c.value === v)
    return c ? c.label : (v || 'Sin comisión')
  }

  const cursoActual = cursos.find(c => String(c.curso_id) === String(cursoId))
  const cursosDisponibles = cursoActual
    ? cursos.filter(c => c.especialidad === cursoActual.especialidad && c.anio === cursoActual.anio)
    : []

  const cambiarCurso = (id) => {
    setSearchParams(id ? { curso: id } : {}, { replace: true })
  }

  const cambiarCursoAlumno = (alumnoId, curso) => {
    setCursoPendientes(prev => {
      const next = { ...prev }
      const alumno = alumnos.find(a => a.alumno_id === alumnoId)
      if (!alumno || String(curso) === String(alumno.curso_id)) delete next[alumnoId]
      else next[alumnoId] = curso
      return next
    })
    setMensaje('')
  }

  const cambiarComision = (alumnoId, comision) => {
    setPendientes(prev => ({ ...prev, [alumnoId]: comision }))
    setMensaje('')
  }

  const valorDe = (a) => pendientes[a.alumno_id] !== undefined ? pendientes[a.alumno_id] : a.comision
  const cursoValorDe = (a) =>
    cursoPendientes[a.alumno_id] !== undefined ? cursoPendientes[a.alumno_id] : String(a.curso_id)

  const guardar = async (alumnoId) => {
    const comision = pendientes[alumnoId]
    const curso = cursoPendientes[alumnoId]
    if (comision === undefined && curso === undefined) return
    setGuardando(true)
    setMensaje('')
    try {
      const body = {}
      if (comision !== undefined) body.comision = comision
      if (curso !== undefined) body.curso_id = Number(curso)
      await api.put(`/alumnos/${alumnoId}`, body)
      setPendientes(prev => {
        const next = { ...prev }
        delete next[alumnoId]
        return next
      })
      setCursoPendientes(prev => {
        const next = { ...prev }
        delete next[alumnoId]
        return next
      })
      if (curso !== undefined) {
        setAlumnos(prev => prev.filter(a => a.alumno_id !== alumnoId))
        setMensaje('Alumno cambiado de curso')
      } else {
        setAlumnos(prev => prev.map(a => a.alumno_id === alumnoId ? { ...a, comision } : a))
        setMensaje('Comisión actualizada')
      }
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div>
      <h1>Comisiones</h1>

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

      {!cursoId ? (
        <p className="empty">Seleccioná un curso para ver y cambiar sus comisiones</p>
      ) : alumnos.length === 0 ? (
        <p className="empty">Este curso no tiene alumnos</p>
      ) : (
        <div>
          <div className="tabla table-alumnos tabla-comisiones">
            <div className="table-header">
              <span>Apellido</span>
              <span>Nombre</span>
              <span>DNI</span>
              <span>Curso</span>
              <span>Comisión</span>
              <span>Estado</span>
              <span>Acciones</span>
            </div>
            {alumnos.map(a => {
              const modificado = pendientes[a.alumno_id] !== undefined || cursoPendientes[a.alumno_id] !== undefined
              const actual = valorDe(a)
              const enLista = COMISIONES.some(c => c.value === actual)
              return (
                <div key={a.alumno_id} className="tabla-fila">
                  <span data-label="Apellido">{a.apellido}</span>
                  <span data-label="Nombre">{a.nombre}</span>
                  <span data-label="DNI">{a.dni}</span>
                  <span className="select-cell" data-label="Curso">
                    <select
                      value={cursoValorDe(a)}
                      onChange={e => cambiarCursoAlumno(a.alumno_id, e.target.value)}
                    >
                      {cursosDisponibles.map(c => (
                        <option key={c.curso_id} value={c.curso_id}>{c.nombre}</option>
                      ))}
                    </select>
                  </span>
                  <span className="select-cell" data-label="Comisión">
                    <select
                      value={actual}
                      onChange={e => cambiarComision(a.alumno_id, e.target.value)}
                    >
                      {!enLista && actual && <option value={actual}>{labelDe(actual)}</option>}
                      {COMISIONES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </span>
                  <span data-label="Estado">{modificado ? 'Sin guardar' : 'Guardado'}</span>
                  <span className="actions-cell" data-label="">
                    <button
                      className="btn-small"
                      disabled={!modificado || guardando}
                      onClick={() => guardar(a.alumno_id)}
                    >
                      Guardar
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
