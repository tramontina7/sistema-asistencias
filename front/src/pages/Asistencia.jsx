import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { fechaLocal } from '../utils/fechas'
import { turnoDeHora } from '../utils/turnos'

const ESTADOS = ['Presente', 'Ausente']

const ETIQUETA = {
  Presente: 'Presente',
  Ausente: 'Ausente',
  Justificado: 'Justificado',
  Tarde: 'Tarde',
}

const formatFecha = (iso) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const claseEstado = (estado) => {
  if (!estado) return 'sin-asistencia'
  if (estado === 'Tarde') return 'tardanza'
  return estado.toLowerCase()
}

export default function Asistencia() {
  const { usuario } = useAuth()
  const turno = usuario?.turno
  const [searchParams, setSearchParams] = useSearchParams()
  const cursoId = searchParams.get('curso') || ''
  const materiaId = searchParams.get('materia') || ''
  const comision = searchParams.get('comision') || ''
  const [cursos, setCursos] = useState([])
  const [materias, setMaterias] = useState([])
  const [alumnos, setAlumnos] = useState([])
  const [comisiones, setComisiones] = useState([])
  const [estados, setEstados] = useState({})
  const [asistenciaIds, setAsistenciaIds] = useState({})
  const [motivos, setMotivos] = useState({})
  const [cambios, setCambios] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const cambiarCurso = (id) => {
    setSearchParams(id ? { curso: id } : {}, { replace: true })
  }

  const cambiarMateria = (id) => {
    const params = Object.fromEntries(searchParams.entries())
    if (id) {
      params.materia = id
      delete params.comision
    } else {
      delete params.materia
      delete params.comision
    }
    setSearchParams(params, { replace: true })
  }

  const cambiarComision = (id) => {
    const params = Object.fromEntries(searchParams.entries())
    if (id) params.comision = id
    else delete params.comision
    setSearchParams(params, { replace: true })
  }

  const hoy = fechaLocal()

  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const hoyDia = DIAS[new Date().getDay()]
  const ahora = new Date()
  const horaActual = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`

  const materiasDelCurso = cursoId ? materias.filter(m => String(m.curso_id) === String(cursoId)) : []
  const materiaConDia = m => (m.horarios || []).some(h => h.dia_semana === hoyDia)
  const materiasDelDia = materiasDelCurso.filter(materiaConDia)
  const materiaEnTurno = m => (m.horarios || []).some(h => h.dia_semana === hoyDia && turnoDeHora(h.hora_entrada) === turno)
  const materiasDelTurno = materiasDelDia.filter(materiaEnTurno)
  // Con turno asignado solo se ofrecen materias de ese turno; sin turno se ven todas (modo admin/prueba).
  const materiasDisponibles = turno
    ? (materiasDelTurno.length > 0 ? materiasDelTurno : materiasDelDia)
    : (materiasDelDia.length > 0 ? materiasDelDia : materiasDelCurso)
  const cursoEnTurno = c => materias.some(m => String(m.curso_id) === String(c.curso_id) && materiaEnTurno(m))
  const cursosDisponibles = turno ? cursos.filter(cursoEnTurno) : cursos
  const franjaDeHoy = m => (m.horarios || []).find(h => h.dia_semana === hoyDia)
  const enFranjaAhora = m => {
    const f = franjaDeHoy(m)
    return f && f.hora_entrada <= horaActual && horaActual <= f.hora_salida
  }
  const materiaAutodet = materiasDisponibles.find(enFranjaAhora) || materiasDisponibles[0]

  useEffect(() => {
    api.get('/cursos').then(res => setCursos(res.data))
  }, [])

  useEffect(() => {
    api.get('/materias/all')
      .then(res => setMaterias(res.data))
      .catch(() => setMaterias([]))
  }, [])

  const materiasDiaKey = materiasDisponibles.map(m => String(m.materia_id)).join(',')
  const cursoDisponibleKey = cursosDisponibles.map(c => String(c.curso_id)).join(',')
  const autodetId = materiaAutodet ? String(materiaAutodet.materia_id) : ''

  useEffect(() => {
    const params = Object.fromEntries(searchParams.entries())
    const next = { ...params }
    let changed = false
    if (!cursoId) {
      if (params.materia || params.comision) {
        delete next.materia
        delete next.comision
        changed = true
      }
    } else if (turno && !cursosDisponibles.some(c => String(c.curso_id) === String(cursoId))) {
      delete next.curso
      delete next.materia
      delete next.comision
      changed = true
    } else if (!materiasDiaKey.split(',').includes(String(params.materia))) {
      if (autodetId) next.materia = autodetId
      else delete next.materia
      delete next.comision
      changed = true
    }
    if (changed) setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursoId, materiasDiaKey, cursoDisponibleKey, autodetId, searchParams, setSearchParams, turno])

  const cargarDatos = useCallback(async () => {
    if (!materiaId) return
    setLoading(true)
    setMensaje('')
    try {
      const [resAlumnos, resAsis] = await Promise.all([
        api.get('/alumnos', { params: { curso_id: cursoId } }),
        api.get('/asistencias', { params: { materia_id: materiaId, fecha: hoy } }),
      ])
      setAlumnos(resAlumnos.data)
      setComisiones([...new Set(resAlumnos.data.map(a => a.comision).filter(Boolean))])
      const map = {}
      const ids = {}
      const m = {}
      resAsis.data.forEach(a => {
        map[a.alumno_id] = a.estado
        ids[a.alumno_id] = a.asistencia_id
        if (a.estado === 'Tarde' && a.motivo_tarde) m[a.alumno_id] = a.motivo_tarde
      })
      setEstados(map)
      setAsistenciaIds(ids)
      setMotivos(m)
      setCambios(false)
    } catch {
      setMensaje('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [materiaId, cursoId, hoy])

  useEffect(() => {
    if (!materiaId) { setAlumnos([]); return }
    cargarDatos()
  }, [materiaId, cargarDatos])

  const toggleEstado = (alumnoId) => {
    setEstados(prev => {
      const actual = prev[alumnoId]
      let next
      if (asistenciaIds[alumnoId]) {
        if (actual === 'Ausente') next = 'Tarde'
        else if (actual === 'Tarde') next = 'Ausente'
        else return prev
      } else {
        const idx = actual ? ESTADOS.indexOf(actual) : -1
        if (idx === -1) next = ESTADOS[0]
        else if (idx < ESTADOS.length - 1) next = ESTADOS[idx + 1]
        else next = null
      }
      const result = { ...prev }
      if (next) result[alumnoId] = next
      else delete result[alumnoId]
      return result
    })
    setCambios(true)
  }

  const cambiarMotivo = (alumnoId, texto) => {
    setMotivos(prev => ({ ...prev, [alumnoId]: texto }))
    setCambios(true)
  }

  const guardar = async () => {
    if (!materiaId) return
    const marcados = Object.keys(estados).length
    if (marcados === 0) return
    if (faltantes > 0) {
      setMensaje(`Faltan marcar ${faltantes} alumno(s) para poder guardar`)
      return
    }
    setSaving(true)
    setMensaje('')
    try {
      const asistencias = Object.entries(estados).map(([alumno_id, estado]) => ({
        alumno_id: Number(alumno_id),
        estado,
        ...(estado === 'Tarde' ? { motivo: (motivos[alumno_id] || '').trim() || undefined } : {}),
      }))
      await api.post('/asistencias/tomar', { materia_id: materiaId, fecha: hoy, asistencias })
      setMensaje('Asistencia guardada')
      setCambios(false)
      await cargarDatos()
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const materia = materias.find(m => String(m.materia_id) === String(materiaId))
  const esDivision = materia && materia.tipo && materia.tipo !== 'Teoría'
  const alumnosVisibles = esDivision && comision
    ? alumnos.filter(a => a.comision === comision)
    : alumnos
  const sinMarcar = alumnosVisibles.filter(a => !estados[a.alumno_id])
  const faltantes = sinMarcar.length
  const marcadosVisibles = alumnosVisibles.filter(a => !!estados[a.alumno_id]).length

  return (
    <div>
      <h1>Tomar Asistencia</h1>

      <div className="filters">
        <div className="form-group">
          <label>Curso {turno && <span className="muted">(turno {turno})</span>}</label>
          <select value={cursoId} onChange={e => cambiarCurso(e.target.value)}>
            <option value="">Seleccionar curso</option>
            {cursosDisponibles.map(c => (
              <option key={c.curso_id} value={c.curso_id}>{c.nombre} · {c.especialidad}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Materia</label>
          <select
            value={materiaId}
            onChange={e => cambiarMateria(e.target.value)}
            disabled={!cursoId || materiasDisponibles.length === 0}
          >
            <option value="">
              {cursoId && materiasDisponibles.length === 0
                ? (turno ? 'No hay materias de este turno hoy' : 'Seleccionar materia (hoy sin horario)')
                : 'Seleccionar materia'}
            </option>
            {materiasDisponibles.map(m => (
              <option key={m.materia_id} value={m.materia_id}>{m.nombre_materia}</option>
            ))}
          </select>
        </div>
        {esDivision && comisiones.length > 0 && (
          <div className="form-group">
            <label>Comisión</label>
            <select value={comision} onChange={e => cambiarComision(e.target.value)}>
              <option value="">Seleccionar comisión</option>
              {comisiones.map(c => (
                <option key={c} value={c}>Comisión {c}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {materia && (
        <p className="subtitle">
          Fecha: <strong>{formatFecha(hoy)}</strong>
          {' · '}{materia.nombre_materia}
          {(() => { const f = franjaDeHoy(materia); return f ? ` (${hoyDia} ${f.hora_entrada}–${f.hora_salida}${enFranjaAhora(materia) ? ' · ahora' : ''})` : '' })()}
        </p>
      )}

      {loading && <p className="loading">Cargando...</p>}

      {!loading && turno && cursosDisponibles.length === 0 && (
        <p className="notice">Hoy no hay cursos con clases en el turno {turno}. Sin turno asignado se verían todos los cursos.</p>
      )}

      {!loading && cursoId && !turno && materiasDelDia.length === 0 && (
        <p className="notice">
          Hoy ({hoyDia.toLowerCase()}) no hay materias con horario cargado; se muestran todas las materias del curso (modo prueba).
        </p>
      )}

      {!loading && materiaId && (
        <>
          <div className="actions">
            <button
              className="btn-primary"
              onClick={guardar}
              disabled={saving || !cambios || marcadosVisibles === 0 || faltantes > 0}
            >
              {saving ? 'Guardando...' : 'Guardar Asistencia'}
            </button>
          </div>

          {alumnosVisibles.length > 0 && faltantes > 0 && (
            <p className="error">
              Faltan marcar {faltantes} alumno(s) para poder guardar.
            </p>
          )}

          <div className="toma-lista">
            {alumnosVisibles.map(alumno => {
              const estado = estados[alumno.alumno_id]
              const registrado = !!asistenciaIds[alumno.alumno_id]
              return (
                <div key={alumno.alumno_id} className={`toma-fila ${claseEstado(estado)} ${registrado && estado !== 'Ausente' && estado !== 'Tarde' ? 'readonly' : ''}`}>
                  <div
                    className="toma-fila-main"
                    onClick={() => toggleEstado(alumno.alumno_id)}
                  >
                    <span className="toma-nombre">{alumno.apellido}, {alumno.nombre}</span>
                    <span className={`badge ${claseEstado(estado)}`}>
                      {estado ? ETIQUETA[estado] : (registrado ? ETIQUETA[asistenciaIds[alumno.alumno_id] ? estado : ''] || '-' : 'Sin marcar')}
                    </span>
                  </div>
                  {estado === 'Tarde' && (
                    <div className="toma-motivo-wrap">
                      <input
                        className="toma-motivo"
                        type="text"
                        placeholder="Motivo de la llegada tarde (opcional)"
                        value={motivos[alumno.alumno_id] || ''}
                        onClick={e => e.stopPropagation()}
                        onChange={e => cambiarMotivo(alumno.alumno_id, e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {mensaje && <p className={mensaje.includes('Error') ? 'error' : 'success'}>{mensaje}</p>}

      {!loading && materiaId && alumnosVisibles.length === 0 && (
        <p className="empty">
          {esDivision && comisiones.length > 0 && !comision
            ? 'Seleccioná una comisión para tomar asistencia'
            : `No hay alumnos${esDivision ? ' en esta comisión' : ' en este curso'}`}
        </p>
      )}

      {!materiaId && (
        <p className="empty">
          {cursoId
            ? (materiasDisponibles.length === 0 ? 'Este curso no tiene materias.' : 'Seleccioná una materia para comenzar')
            : 'Seleccioná un curso para comenzar'}
        </p>
      )}
    </div>
  )
}
