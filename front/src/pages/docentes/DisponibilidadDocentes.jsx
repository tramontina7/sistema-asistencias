import { useState, useEffect } from 'react'
import api from '../../api'

const ORDINAL_ANIO = { 1: 'ro', 2: 'do', 3: 'ro', 4: 'to', 5: 'to', 6: 'to', 7: 'mo' }
const ORDINAL_DIVISION = { 1: 'ra', 2: 'da', 3: 'ra', 4: 'ta', 5: 'ta', 6: 'ta', 7: 'ma', 8: 'va', 9: 'na', 10: 'ma' }

const ordinal = (num, map, fallback) => {
  const n = Number(num)
  return map[n] ? `${n}${map[n]}` : fallback
}

const cursoNombre = (anio, division) =>
  `${ordinal(anio, ORDINAL_ANIO, String(anio))} ${ordinal(division, ORDINAL_DIVISION, String(division))}`

const ESTADOS = ['Disponible', 'Licencia']

export default function DisponibilidadDocentes() {
  const [docentes, setDocentes] = useState([])
  const [estadosPendientes, setEstadosPendientes] = useState({})
  const [mensaje, setMensaje] = useState('')
  const [savingId, setSavingId] = useState(null)

  const cargar = async () => {
    setMensaje('')
    try {
      const res = await api.get('/docentes/disponibilidad')
      setDocentes(res.data || [])
      setEstadosPendientes({})
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al cargar')
    }
  }

  useEffect(() => { cargar() }, [])

  const estadoEfectivo = (d) => estadosPendientes[d.docente_id] ?? d.estado
  const tieneCambio = (d) =>
    estadosPendientes[d.docente_id] !== undefined && estadosPendientes[d.docente_id] !== d.estado

  const seleccionarEstado = (docenteId, estado) => {
    setEstadosPendientes(prev => ({ ...prev, [docenteId]: estado }))
    setMensaje('')
  }

  const guardarEstado = async (docenteId, estado) => {
    setSavingId(docenteId)
    setMensaje('')
    try {
      await api.put(`/docentes/${docenteId}/estado`, { estado })
      await cargar()
      setMensaje('Estado guardado')
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al guardar estado')
    } finally {
      setSavingId(null)
    }
  }

  const asignarReemplazo = async (materiaId, suplenteId, comision) => {
    if (!suplenteId) return
    try {
      await api.put('/docentes/reemplazos', { materia_id: materiaId, suplente_id: suplenteId, comision })
      await cargar()
      setMensaje('Reemplazante asignado')
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al asignar reemplazante')
    }
  }

  const quitarReemplazo = async (materiaId, comision) => {
    if (!confirm('¿Quitar el reemplazante?')) return
    try {
      await api.delete(`/docentes/reemplazos/${materiaId}${comision ? `?comision=${encodeURIComponent(comision)}` : ''}`)
      await cargar()
      setMensaje('Reemplazante quitado')
    } catch {
      setMensaje('Error al quitar reemplazante')
    }
  }

  return (
    <div>
      <h1>Disponibilidad / Licencias</h1>

      {mensaje && <p className={mensaje.includes('Error') ? 'error' : 'success'}>{mensaje}</p>}

      <div className="tabla table-alumnos tabla-disponibilidad">
        <div className="table-header">
          <span>Docente</span>
          <span>Estado</span>
          <span>Materias / Reemplazante</span>
          <span>Acciones</span>
        </div>
        {docentes.map(d => {
          const estado = estadoEfectivo(d)
          const conCambio = tieneCambio(d)
          return (
            <div key={d.docente_id} className="tabla-fila">
              <span>
                {d.apellido}, {d.nombre}
              </span>
              <span>
                <select
                  value={estado}
                  disabled={savingId === d.docente_id}
                  onChange={e => seleccionarEstado(d.docente_id, e.target.value)}
                >
                  {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </span>
              <span>
                {estado === 'Licencia' ? (
                  <div className="horarios-editor">
                    {d.materias.map(m => (
                      <div key={`${m.materia_id}-${m.comision || ''}`} className="horario-row">
                        <span className="muted">
                          {m.nombre_materia} — {cursoNombre(m.anio, m.division)}
                          {m.comision ? ` — ${m.comision}` : ''}
                        </span>
                        <select
                          value={m.reemplazo ? m.reemplazo.docente_id : ''}
                          onChange={e => asignarReemplazo(m.materia_id, e.target.value, m.comision)}
                        >
                          <option value="">Sin reemplazante</option>
                          {m.candidatos.map(c => (
                            <option key={c.docente_id} value={c.docente_id}>{c.apellido}, {c.nombre}</option>
                          ))}
                        </select>
                        {m.candidatos.length === 0 && !m.reemplazo && (
                          <span className="muted">Sin docentes habilitados para esta materia</span>
                        )}
                        {m.reemplazo && (
                          <button className="btn-small btn-danger" onClick={() => quitarReemplazo(m.materia_id, m.comision)}>✕</button>
                        )}
                      </div>
                    ))}
                    {d.materias.length === 0 && <span className="muted">Sin materias asignadas</span>}
                  </div>
                ) : (
                  <span className="muted">
                    {d.materias.length > 0 ? `${d.materias.length} materia(s)` : 'Sin materias asignadas'}
                  </span>
                )}
              </span>
              <span className="actions-cell">
                <button
                  className="btn-guardar btn-guardar-a"
                  disabled={!conCambio || savingId === d.docente_id}
                  onClick={() => guardarEstado(d.docente_id, estado)}
                >
                  Guardar
                </button>
              </span>
            </div>
          )
        })}
        {docentes.length === 0 && <p className="empty">No hay docentes</p>}
      </div>
    </div>
  )
}