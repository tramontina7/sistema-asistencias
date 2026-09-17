import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default function Cursos() {
  const [searchParams, setSearchParams] = useSearchParams()
  const cursoId = searchParams.get('curso') || ''
  const [cursos, setCursos] = useState([])

  const cambiarCurso = (id) => {
    setSearchParams(id ? { curso: id } : {}, { replace: true })
  }
  const [materias, setMaterias] = useState([])
  const [editHorarioId, setEditHorarioId] = useState(null)
  const [horariosEdit, setHorariosEdit] = useState([])
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    api.get('/cursos').then(res => setCursos(res.data))
  }, [])

  const cargarMaterias = async () => {
    const res = await api.get('/materias/all')
    setMaterias(res.data)
  }

  useEffect(() => {
    cargarMaterias().catch(() => setMaterias([]))
  }, [])

  const grupos = () => {
    const mapa = new Map()
    for (const m of materias) {
      if (String(m.curso_id) !== String(cursoId)) continue
      if (!mapa.has(m.curso_id)) {
        mapa.set(m.curso_id, {
          curso_id: m.curso_id,
          curso_nombre: m.curso_nombre,
          curso_especialidad: m.curso_especialidad,
          turno: m.turno,
          materias: [],
        })
      }
      mapa.get(m.curso_id).materias.push(m)
    }
    return [...mapa.values()]
  }

  const abrirHorario = async (materiaId) => {
    try {
      const res = await api.get(`/materias/${materiaId}`)
      setHorariosEdit(res.data.horarios || [])
      setEditHorarioId(materiaId)
    } catch {
      setMensaje('Error al cargar horario')
    }
  }

  const agregarHorario = () => {
    setHorariosEdit([...horariosEdit, { dia_semana: 'Lunes', hora_entrada: '08:00', hora_salida: '09:00' }])
  }

  const actualizarHorario = (idx, campo, valor) => {
    setHorariosEdit(prev => prev.map((h, i) => i === idx ? { ...h, [campo]: valor } : h))
  }

  const eliminarHorario = (idx) => {
    setHorariosEdit(prev => prev.filter((_, i) => i !== idx))
  }

  const guardarHorario = async () => {
    try {
      await api.put(`/materias/${editHorarioId}/horarios`, { horarios: horariosEdit })
      setMensaje('Horario guardado')
      setEditHorarioId(null)
      await cargarMaterias()
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al guardar horario')
    }
  }

  const textosHorarios = (horarios) =>
    horarios.map(h => `${h.dia_semana} ${h.hora_entrada}–${h.hora_salida}`).join(', ') || 'Sin horarios'

  const secciones = grupos()

  return (
    <div>
      <h1>Cursos</h1>

      {mensaje && <p className={mensaje.includes('Error') ? 'error' : 'success'}>{mensaje}</p>}

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

      {!cursoId && <p className="empty">Seleccioná un curso para ver sus materias</p>}

      {secciones.map(g => (
        <section key={g.curso_id} className="curso-grupo">
          <h2 className="curso-titulo">
            {g.curso_nombre}{g.curso_especialidad && ` · ${g.curso_especialidad}`}{g.turno && ` · ${g.turno}`}
          </h2>
          <div className="tabla table-alumnos tabla-cursos">
            <div className="table-header">
              <span>Materia</span>
              <span>Especialidad</span>
              <span>Tipo</span>
              <span>Horarios</span>
            </div>
            {g.materias.map(m => (
              <div key={m.materia_id} className="tabla-fila">
                <span data-label="Materia">{m.nombre_materia}</span>
                <span data-label="Especialidad">{m.especialidad}</span>
                <span data-label="Tipo">{m.tipo}</span>
                <span data-label="Horarios">
                  <span className="muted">{textosHorarios(m.horarios)}</span>
                  <button className="btn-small" onClick={() => abrirHorario(m.materia_id)}>Editar horario</button>
                </span>
              </div>
            ))}
            {g.materias.length === 0 && <p className="empty">No hay materias</p>}
          </div>
        </section>
      ))}

      {cursoId && secciones.length === 0 && <p className="empty">No hay materias para este curso</p>}

      {editHorarioId && (
        <div className="modal">
          <div className="modal-content">
            <h3>Horario{materias.find(m => m.materia_id === editHorarioId)?.nombre_materia
              ? ` de ${materias.find(m => m.materia_id === editHorarioId).nombre_materia}`
              : ''}</h3>
            <div className="horarios-editor">
              {horariosEdit.map((h, idx) => (
                <div key={idx} className="horario-row">
                  <select value={h.dia_semana} onChange={e => actualizarHorario(idx, 'dia_semana', e.target.value)}>
                    {DIAS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <input type="time" value={h.hora_entrada} onChange={e => actualizarHorario(idx, 'hora_entrada', e.target.value)} />
                  <input type="time" value={h.hora_salida} onChange={e => actualizarHorario(idx, 'hora_salida', e.target.value)} />
                  <button className="btn-danger-red" onClick={() => eliminarHorario(idx)}>✕</button>
                </div>
              ))}
              <button className="btn-agregar" onClick={agregarHorario}>+ Agregar día</button>
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={guardarHorario}>Guardar</button>
              <button className="btn-secondary" onClick={() => setEditHorarioId(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}