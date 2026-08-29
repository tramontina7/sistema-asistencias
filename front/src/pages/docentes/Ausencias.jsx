import { useState, useEffect, useCallback } from 'react'
import api from '../../api'

const hoy = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Ausencias() {
  const [fecha, setFecha] = useState(hoy())
  const [docentes, setDocentes] = useState([])
  const [ausencias, setAusencias] = useState([])
  const [mensaje, setMensaje] = useState('')
  const [guardandoId, setGuardandoId] = useState(null)

  const cargarDocentes = useCallback(async () => {
    try {
      const res = await api.get('/docentes/ausencias/docentes', { params: { fecha } })
      setDocentes(res.data || [])
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al cargar docentes')
    }
  }, [fecha])

  const cargarAusencias = useCallback(async () => {
    try {
      const res = await api.get('/docentes/ausencias', { params: { fecha } })
      setAusencias(res.data || [])
    } catch (err) {
      if (err.response?.status === 400) {
        setAusencias([])
        setMensaje(err.response?.data?.error || '')
      } else {
        setMensaje(err.response?.data?.error || 'Error al cargar horas libres')
      }
    }
  }, [fecha])

  useEffect(() => {
    cargarDocentes()
    cargarAusencias()
  }, [cargarDocentes, cargarAusencias])

  const cambiarFecha = (val) => {
    setFecha(val)
    setMensaje('')
  }

  const alternarAusencia = async (docenteId, ausente) => {
    setGuardandoId(docenteId)
    setMensaje('')
    try {
      if (ausente) {
        await api.delete('/docentes/ausencias', { params: { docente_id: docenteId, fecha } })
      } else {
        await api.put('/docentes/ausencias', { docente_id: docenteId, fecha })
      }
      await cargarDocentes()
      await cargarAusencias()
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al guardar ausencia')
    } finally {
      setGuardandoId(null)
    }
  }

  return (
    <div>
      <h1>Ausencias de Docentes</h1>

      <div className="filters">
        <div className="form-group">
          <label>Fecha</label>
          <input type="date" value={fecha} onChange={e => cambiarFecha(e.target.value)} />
        </div>
      </div>

      {mensaje && <p className="error">{mensaje}</p>}

      <div className="tabla table-alumnos">
        <div className="table-header">
          <span>Docente</span>
          <span>Ausente</span>
          <span>Acciones</span>
        </div>
        {docentes.map(d => (
          <div key={d.docente_id} className="tabla-fila">
            <span>{d.apellido}, {d.nombre}</span>
            <span>
              {d.licencia ? (
                <span className="badge badge-licencia">Licencia</span>
              ) : d.ausente ? (
                <span className="badge badge-licencia">Ausente</span>
              ) : (
                <span className="muted">Presente</span>
              )}
            </span>
            <span className="actions-cell">
              {d.licencia ? (
                <button className="btn-small" disabled title="Gestionar la licencia desde Docentes">
                  En licencia
                </button>
              ) : (
                <button
                  className={d.ausente ? 'btn-small btn-danger' : 'btn-small'}
                  disabled={guardandoId === d.docente_id}
                  onClick={() => alternarAusencia(d.docente_id, d.ausente)}
                >
                  {guardandoId === d.docente_id ? 'Guardando...' : (d.ausente ? 'Quitar ausencia' : 'Marcar ausente')}
                </button>
              )}
            </span>
          </div>
        ))}
        {docentes.length === 0 && <p className="empty">No hay docentes</p>}
      </div>

      <h2 className="curso-titulo">Horas libres ({fecha})</h2>
      {ausencias.length === 0 ? (
        <p className="empty">No hay docentes ausentes este día</p>
      ) : (
        <div className="tabla table-alumnos tabla-ausencias">
          <div className="table-header">
            <span>Docente</span>
            <span>Materia</span>
            <span>Curso</span>
            <span>Comisión</span>
            <span>Franja</span>
          </div>
          {ausencias.flatMap(a =>
            a.bloques.length > 0
              ? a.bloques.map((b, i) => ({ docente: a, b, i }))
              : [{ docente: a, b: null, i: 0 }]
          ).map(({ docente, b, i }, idx) => (
            <div key={`${docente.docente_id}-${i}-${idx}`} className="tabla-fila">
              <span>
                {docente.apellido}, {docente.nombre}
                {docente.motivo === 'licencia' && <span className="badge badge-licencia">Licencia</span>}
              </span>
              {b ? (
                <>
                  <span>{b.nombre_materia}</span>
                  <span>{b.curso_nombre}</span>
                  <span>{b.comision || '—'}</span>
                  <span>{b.hora_entrada} – {b.hora_salida}</span>
                </>
              ) : (
                <>
                  <span className="muted">Sin horarios este día</span>
                  <span>—</span>
                  <span>—</span>
                  <span>—</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
