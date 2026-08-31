import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api'
import { fechaLocal, mesLocal } from '../utils/fechas'

const TIPOS = [
  { value: 'dia', label: 'Día' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'cuatrimestre', label: 'Cuatrimestre' },
]

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1)
const parseFecha = f => { const [y, m, d] = f.split('-').map(Number); return { y, m, d } }
const diaSolo = f => String(parseFecha(f).d).padStart(2, '0')
const diaMes = f => `${diaSolo(f)} de ${capitalize(MESES[parseFecha(f).m - 1])}`

const tituloReporte = (data, tipo) => {
  const desde = diaMes(data.desde)
  const hasta = diaMes(data.hasta)
  const mismoMes = parseFecha(data.desde).m === parseFecha(data.hasta).m
  switch (tipo) {
    case 'dia': return `Reporte del Día: ${desde}`
    case 'semana': return mismoMes
      ? `Reporte de la semana: ${diaSolo(data.desde)} a ${diaSolo(data.hasta)} de ${capitalize(MESES[parseFecha(data.desde).m - 1])}`
      : `Reporte de la semana: ${desde} al ${hasta}`
    case 'mes': return mismoMes
      ? `Reporte del mes: ${diaSolo(data.desde)} al ${diaSolo(data.hasta)} de ${capitalize(MESES[parseFecha(data.desde).m - 1])}`
      : `Reporte del mes: ${desde} al ${hasta}`
    case 'cuatrimestre': return `Reporte del ${data.cuatrimestre === 2 ? '2do' : '1er'} cuatrimestre: ${desde} al ${hasta}`
    default: return `Reporte: ${desde} al ${hasta}`
  }
}

const OPCIONES_MESES = (() => {
  const now = new Date()
  // Enero no es mes hábil: no se ofrece en el selector.
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    if (d.getMonth() === 0) return null
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${capitalize(MESES[d.getMonth()])} ${d.getFullYear()}`,
    }
  }).filter(Boolean)
})()

export default function Reportes() {
  const [searchParams, setSearchParams] = useSearchParams()
  const cursoId = searchParams.get('curso') || ''
  const [cursos, setCursos] = useState([])
  const [modo, setModo] = useState('general')

  const [tipo, setTipo] = useState('dia')
  const [fecha, setFecha] = useState(fechaLocal())
  const [periodo, setPeriodo] = useState(mesLocal())
  const [cuatrimestre, setCuatrimestre] = useState('1')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const [matriz, setMatriz] = useState(null)
  const [loadingMatriz, setLoadingMatriz] = useState(false)

  const cambiarCurso = (id) => {
    setSearchParams(id ? { curso: id } : {}, { replace: true })
  }

  const usaMes = tipo === 'mes'

  useEffect(() => {
    api.get('/cursos').then(res => setCursos(res.data))
  }, [])

  useEffect(() => {
    if (modo !== 'materia' || !cursoId) {
      setMatriz(null)
      return
    }
    let cancel = false
    setLoadingMatriz(true)
    api.get('/reportes/materia', { params: { curso_id: cursoId } })
      .then(res => { if (!cancel) setMatriz(res.data) })
      .catch(() => { if (!cancel) setMatriz(null) })
      .finally(() => { if (!cancel) setLoadingMatriz(false) })
    return () => { cancel = true }
  }, [modo, cursoId])

  const buscar = async () => {
    if (!cursoId) return
    const fechaParam = usaMes ? `${periodo}-15` : fecha
    const params = { curso_id: cursoId, tipo, fecha: fechaParam }
    if (tipo === 'cuatrimestre') params.cuatrimestre = cuatrimestre
    setLoading(true)
    try {
      const res = await api.get('/reportes', { params })
      setData(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const curso = cursos.find(c => String(c.curso_id) === String(cursoId))

  return (
    <div>
      <h1>Reportes</h1>

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
        <div className="form-group">
          <label>Forma de reporte</label>
          <div className="segmented">
            <button
              type="button"
              className={modo === 'general' ? 'active' : ''}
              onClick={() => setModo('general')}
            >
              En general
            </button>
            <button
              type="button"
              className={modo === 'materia' ? 'active' : ''}
              onClick={() => setModo('materia')}
            >
              Por materia
            </button>
          </div>
        </div>
      </div>

      {modo === 'general' && (
        <div className="filters">
          <div className="form-group">
            <label>Período</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {tipo === 'cuatrimestre' ? (
            <div className="form-group">
              <label>Cuatrimestre</label>
              <select value={cuatrimestre} onChange={e => setCuatrimestre(e.target.value)}>
                <option value="1">1er cuatrimestre</option>
                <option value="2">2do cuatrimestre</option>
              </select>
            </div>
          ) : usaMes ? (
            <div className="form-group">
              <label>Mes</label>
              <select value={periodo} onChange={e => setPeriodo(e.target.value)}>
                {OPCIONES_MESES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          ) : (
            <div className="form-group">
              <label>{tipo === 'dia' ? 'Fecha' : 'Semana del'}</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required />
            </div>
          )}
          <div className="form-group">
            <label>&nbsp;</label>
            <button className="btn-primary" onClick={buscar} disabled={loading}>
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>
      )}

      {modo === 'general' && data && (
        <>
          <div className="report-header">
            <h2>{tituloReporte(data, tipo)}</h2>
            <span className="muted">{curso ? `${curso.nombre} · ${curso.especialidad}` : ''}</span>
          </div>

          <div className="tabla report-table">
            <div className="table-header">
              <span>Alumno</span>
              <span className="col-num" title="Presentes">P</span>
              <span className="col-num" title="Tardanzas">T</span>
              <span className="col-num" title="Justificados">J</span>
              <span className="col-num" title="Ausentes">A</span>
              <span className="col-num" title="% de asistencia">% Asist.</span>
            </div>
            {data.resumen.map(r => {
              const pct = r.total > 0 ? Math.round(((r.presentes + r.tardanzas) / r.total) * 100) : 0
              return (
                <div key={r.alumno_id} className="tabla-fila">
                  <span className="col-nombre">{r.apellido}, {r.nombre}</span>
                  <span className="col-num">{r.presentes || '-'}</span>
                  <span className="col-num">{r.tardanzas || '-'}</span>
                  <span className="col-num">{r.justificados || '-'}</span>
                  <span className="col-num">{r.ausencias || '-'}</span>
                  <span className={`col-num ${pct < 75 ? 'danger' : ''}`}>{pct}%</span>
                </div>
              )
            })}
            {data.resumen.length === 0 && <p className="empty">Sin registros en el período</p>}
          </div>
        </>
      )}

      {modo === 'materia' && cursoId && loadingMatriz && <p className="loading">Cargando...</p>}

      {modo === 'materia' && matriz && (
        <>
          <div className="report-header">
            <h2>Porcentaje de asistencia por materia</h2>
            <span className="muted">{curso ? `${curso.nombre} · ${curso.especialidad}` : ''} — todo el historial registrado</span>
          </div>

          {matriz.alumnos.length === 0 || matriz.materias.length === 0 ? (
            <p className="empty">No hay datos para este curso</p>
          ) : (
            <div className="matriz-wrap">
              <table className="matriz">
                <thead>
                  <tr>
                    <th>Alumno</th>
                    {matriz.materias.map(m => (
                      <th key={m.materia_id}>{m.nombre_materia}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matriz.alumnos.map(a => (
                    <tr key={a.alumno_id}>
                      <td className="matriz-nombre">{a.apellido}, {a.nombre}</td>
                      {matriz.materias.map(m => {
                        const c = a.celdas[m.materia_id]
                        return (
                          <td
                            key={m.materia_id}
                            className={c && c.porcentaje !== null && c.porcentaje < 75 ? 'danger' : ''}
                            title={c ? `${c.presentes}/${c.total} registros` : 'Sin registros'}
                          >
                            {c ? `${c.porcentaje}%` : '-'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!cursoId && modo === 'materia' && (
        <p className="empty">Seleccioná un curso para ver el reporte por materia</p>
      )}
    </div>
  )
}