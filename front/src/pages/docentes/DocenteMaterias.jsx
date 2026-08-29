import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import api from '../../api'

export default function DocenteMaterias() {
  const [searchParams] = useSearchParams()
  const docenteId = searchParams.get('docente') || ''
  const [docente, setDocente] = useState(null)
  const [grupos, setGrupos] = useState({})
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    if (!docenteId) return
    const fetchData = async () => {
      try {
        const [resDocente, resCatalogo] = await Promise.all([
          api.get(`/docentes/${docenteId}`),
          api.get('/materias/catalogo'),
        ])
        const competencias = new Set(resDocente.data.puede_dictar || [])
        const grupos = {}
        for (const m of resCatalogo.data) {
          if (competencias.has(m.nombre_materia)) {
            if (!grupos[m.especialidad]) grupos[m.especialidad] = []
            grupos[m.especialidad].push(m.nombre_materia)
          }
        }
        const ordenado = {}
        Object.keys(grupos).sort().forEach(e => { ordenado[e] = grupos[e].sort() })
        setGrupos(ordenado)
        setDocente(resDocente.data)
      } catch (err) {
        setMensaje(err.response?.data?.error || 'Error al cargar las competencias')
      }
    }
    fetchData()
  }, [docenteId])

  if (!docenteId) {
    return (
      <div>
        <h1>Competencias del Docente</h1>
        <p className="empty">No se indicó un docente</p>
        <Link to="/docentes" className="btn-secondary">Volver</Link>
      </div>
    )
  }

  const total = (docente?.puede_dictar || []).length

  return (
    <div>
      <h1>Competencias del Docente</h1>

      <div className="curso-titulo">
        {docente ? `${docente.apellido}, ${docente.nombre}` : 'Cargando...'}
        {mensaje && <p className={mensaje.includes('Error') ? 'error' : 'success'}>{mensaje}</p>}
      </div>

      {docente && (
        <p className="muted">Materias que este docente puede dictar ({total})</p>
      )}

      {Object.keys(grupos).length === 0 ? (
        <p className="empty">{docente ? 'Este docente no tiene materias asignadas' : 'Cargando...'}</p>
      ) : (
        <div className="competencias-grid">
          {Object.entries(grupos).map(([esp, materias]) => (
            <fieldset key={esp}>
              <legend>{esp}</legend>
              {materias.map(m => (
                <div key={m} className="materia-tag">{m}</div>
              ))}
            </fieldset>
          ))}
        </div>
      )}

      <div className="actions">
        <Link to="/docentes" className="btn-secondary">Volver</Link>
      </div>
    </div>
  )
}
