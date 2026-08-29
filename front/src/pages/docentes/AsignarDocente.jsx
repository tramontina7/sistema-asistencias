import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../../api'

const COMISIONES = [
  { value: 'A', label: 'Comisión A' },
  { value: 'B', label: 'Comisión B' },
]

export default function AsignarDocente() {
  const { materiaId } = useParams()
  const [materia, setMateria] = useState(null)
  const [docenteId, setDocenteId] = useState('')
  const [docentesComision, setDocentesComision] = useState({ A: '', B: '' })
  const [original, setOriginal] = useState('')
  const [cambios, setCambios] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    api.get(`/materias/${materiaId}`)
      .then(res => {
        setMateria(res.data)
        setDocenteId(res.data.docente_id ?? '')
        const porComision = {}
        for (const c of (res.data.comisiones || [])) {
          porComision[c.comision] = c.docente_id ?? ''
        }
        setDocentesComision({ A: porComision['A'] ?? '', B: porComision['B'] ?? '' })
        setOriginal(JSON.stringify({ A: porComision['A'] ?? '', B: porComision['B'] ?? '' }))
      })
      .catch(err => setMensaje(err.response?.data?.error || 'Materia no encontrada'))
  }, [materiaId])

  if (!materia) {
    return (
      <div>
        <h1>Asignación de Docentes</h1>
        {mensaje && <p className="error">{mensaje}</p>}
        <Link to="/docentes/asignacion" className="btn-secondary">Volver</Link>
      </div>
    )
  }

  const esDivision = materia.tipo && materia.tipo !== 'Teoría'

  const guardar = async () => {
    setSaving(true)
    setMensaje('')
    try {
      if (esDivision) {
        const payload = COMISIONES.map(({ value }) => ({
          comision: value,
          docente_id: docentesComision[value] ? Number(docentesComision[value]) : null,
        }))
        const res = await api.put(`/materias/${materiaId}/comisiones`, { comisiones: payload })
        setMateria(res.data)
        const porComision = {}
        for (const c of (res.data.comisiones || [])) {
          porComision[c.comision] = c.docente_id ?? ''
        }
        setDocentesComision({ A: porComision['A'] ?? '', B: porComision['B'] ?? '' })
        setOriginal(JSON.stringify({ A: porComision['A'] ?? '', B: porComision['B'] ?? '' }))
      } else {
        await api.put(`/materias/${materiaId}`, { docente_id: docenteId || null })
      }
      setCambios(false)
      setMensaje('Asignación guardada')
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const actualizarComision = (value, docente) => {
    setDocentesComision(prev => ({ ...prev, [value]: docente }))
    setCambios(true)
    setMensaje('')
  }

  const hayCambios = esDivision
    ? JSON.stringify(docentesComision) !== original
    : cambios

  const cambiarDocenteTeoria = (e) => {
    setDocenteId(e.target.value)
    setCambios(true)
    setMensaje('')
  }

  return (
    <div>
      <h1>Asignación de Docentes</h1>

      <div className="curso-titulo">
        {materia.nombre_materia}
        <span className="muted"> · {materia.curso_nombre} · {materia.tipo}</span>
      </div>

      {mensaje && <p className={mensaje.includes('Error') ? 'error' : 'success'}>{mensaje}</p>}

      {hayCambios && <p className="notice">Hay cambios sin guardar</p>}

      {!esDivision ? (
        <div className="form-group">
          <label>Docente</label>
          <select value={docenteId} onChange={cambiarDocenteTeoria}>
            <option value="">Sin docente</option>
            {materia.docentes_disponibles?.map(d => (
              <option key={d.docente_id} value={d.docente_id}>{d.apellido}, {d.nombre}</option>
            ))}
          </select>
          {(!materia.docentes_disponibles || materia.docentes_disponibles.length === 0) && (
            <p className="empty">No hay docentes habilitados para dictar esta materia</p>
          )}
        </div>
      ) : (
        <div>
          <p className="muted">Esta materia se dicta por comisiones fijas (A y B); asigná un docente por comisión (opcional).</p>
          <div className="comisiones-editor">
            {COMISIONES.map(({ value, label }) => (
              <div key={value} className="horario-row">
                <span className="comision-fija">{label}</span>
                <select
                  value={docentesComision[value]}
                  onChange={e => actualizarComision(value, e.target.value)}
                >
                  <option value="">Sin docente</option>
                  {materia.docentes_disponibles?.map(d => (
                    <option key={d.docente_id} value={d.docente_id}>{d.apellido}, {d.nombre}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {(!materia.docentes_disponibles || materia.docentes_disponibles.length === 0) && (
            <p className="empty">No hay docentes habilitados para dictar esta materia</p>
          )}
        </div>
      )}

      <div className="actions">
        <button
          className="btn-primary"
          onClick={guardar}
          disabled={!hayCambios || saving}
        >
          {saving ? 'Guardando...' : 'Guardar asignación'}
        </button>
        <Link to={`/docentes/asignacion${materia.curso_id ? `?curso=${materia.curso_id}` : ''}`} className="btn-secondary">Volver</Link>
      </div>
    </div>
  )
}
