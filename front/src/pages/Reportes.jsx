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
    case 'cuatrimestre': return `Reporte del cuatrimestre: ${desde} al ${hasta}`
    default: return `Reporte: ${desde} al ${hasta}`
  }
}

const OPCIONES_MESES = (() => {
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${capitalize(MESES[d.getMonth()])} ${d.getFullYear()}`,
    }
  })
})()

export default function Reportes() {
  const [searchParams, setSearchParams] = useSearchParams()
  const cursoId = searchParams.get('curso') || ''
  const [cursos, setCursos] = useState([])
  const [tipo, setTipo] = useState('dia')
  const [fecha, setFecha] = useState(fechaLocal())
  const [periodo, setPeriodo] = useState(mesLocal())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const [matDesde, setMatDesde] = useState(`${mesLocal()}-01`)
  const [matHasta, setMatHasta] = useState(fechaLocal())
  const [matData, setMatData] = useState(null)

  const cambiarCurso = (id) => {
    setSearchParams(id ? { curso: id } : {}, { replace: true })
  }

  const usaMes = tipo === 'mes' || tipo === 'cuatrimestre'

  useEffect(() => {
    api.get('/cursos').then(res => setCursos(res.data))
  }, [])

  const buscar = async () => {
    if (!cursoId) return
    const fechaParam = usaMes ? `${periodo}-15` : fecha
    setLoading(true)
    try {
      const res = await api.get('/reportes', {
        params: { curso_id: cursoId, tipo, fecha: fechaParam },
      })
      setData(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const buscarMaterias = async () => {
    if (!cursoId || !matDesde || !matHasta) return
    setLoading(true)
    try {
      const res = await api.get('/reportes/materia', {
        params: { curso_id: cursoId, desde: matDesde, hasta: matHasta },
      })
      setMatData(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const tablaMateria = (filas) => (
    <div className="tabla report-table">
      <div className="table-header">
        <span>Alumno</span>
        <span>Materia</span>
        <span className="col-num">Ausencias</span>
        <span className="col-num">Sesiones</span>
        <span className="col-num">%</span>
      </div>
      {filas.map((r, i) => {
        const pct = r.porcentaje
        return (
          <div key={`${r.alumno_id}-${r.materia_id}-${i}`} className="tabla-fila">
            <span className="col-nombre">{r.apellido}, {r.nombre}</span>
            <span>{r.materia_nombre}</span>
            <span className="col-num">{r.ausencias || '-'}</span>
            <span className="col-num">{r.sesiones || '-'}</span>
            <span className={`col-num ${pct > 30 ? 'danger' : ''}`}>{pct}%</span>
          </div>
        )
      })}
      {filas.length === 0 && <p className="empty">Sin registros en el período</p>}
    </div>
  )

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
          <label>Período</label>
          <select value={tipo} onChange={e => setTipo(e.target.value)}>
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        {usaMes ? (
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

      {data && (
        <>
          <div className="report-header">
            <h2>{tituloReporte(data, tipo)}</h2>
          </div>

          <div className="tabla report-table">
            <div className="table-header">
              <span>Alumno</span>
              <span className="col-num" title="Presentes">P</span>
              <span className="col-num" title="Ausentes">A</span>
              <span className="col-num" title="Justificados">J</span>
              <span className="col-num" title="Tardanzas">T</span>
              <span className="col-num" title="% de asistencia">% Asist.</span>
            </div>
            {data.resumen.map(r => {
              const pct = r.total > 0 ? Math.round((r.presentes / r.total) * 100) : 0
              return (
                <div key={r.alumno_id} className="tabla-fila">
                  <span className="col-nombre">{r.apellido}, {r.nombre}</span>
                  <span className="col-num">{r.presentes || '-'}</span>
                  <span className="col-num">{r.ausencias || '-'}</span>
                  <span className="col-num">{r.justificados || '-'}</span>
                  <span className="col-num">{r.tardanzas || '-'}</span>
                  <span className={`col-num ${pct < 75 ? 'danger' : ''}`}>{pct}%</span>
                </div>
              )
            })}
          </div>

          <p className="leyenda">
            Presente &nbsp; Ausente &nbsp; Justificado &nbsp; Tardanza
          </p>
        </>
      )}

      <hr className="separador" style={{ margin: '24px 0', border: '0', borderTop: '1px solid #ddd' }} />

      <h2>Faltas por materia</h2>
      <div className="filters">
        <div className="form-group">
          <label>Desde</label>
          <input type="date" value={matDesde} onChange={e => setMatDesde(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Hasta</label>
          <input type="date" value={matHasta} onChange={e => setMatHasta(e.target.value)} />
        </div>
        <div className="form-group">
          <label>&nbsp;</label>
          <button className="btn-primary" onClick={buscarMaterias} disabled={loading}>
            {loading ? 'Buscando...' : 'Ver faltas'}
          </button>
        </div>
      </div>

      {matData && tablaMateria(matData)}
    </div>
  )
}
