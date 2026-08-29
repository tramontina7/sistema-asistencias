import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api'
import { fechaLocal } from '../utils/fechas'

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
  const [cambios, setCambios] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [ausentesHoy, setAusentesHoy] = useState(new Set())

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
  const franjaDeHoy = m => (m.horarios || []).find(h => h.dia_semana === hoyDia)
  const enFranjaAhora = m => {
    const f = franjaDeHoy(m)
    return f && f.hora_entrada <= horaActual && horaActual <= f.hora_salida
  }
  const materiaAutodet = materiasDelDia.find(enFranjaAhora) || materiasDelDia[0]

  useEffect(() => {
    api.get('/cursos').then(res => setCursos(res.data))
  }, [])

  useEffect(() => {
    api.get('/docentes/ausencias', { params: { fecha: hoy } })
      .then(res => setAusentesHoy(new Set(res.data.map(a => a.docente_id))))
      .catch(() => setAusentesHoy(new Set()))
  }, [hoy])

  useEffect(() => {
    api.get('/materias/all')
      .then(res => setMaterias(res.data))
      .catch(() => setMaterias([]))
  }, [])

  const materiasDiaKey = materiasDelDia.map(m => String(m.materia_id)).join(',')
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
    } else if (!materiasDiaKey.split(',').includes(String(params.materia))) {
      if (autodetId) next.materia = autodetId
      else delete next.materia
      delete next.comision
      changed = true
    }
    if (changed) setSearchParams(next, { replace: true })
  }, [cursoId, materiasDiaKey, autodetId, searchParams, setSearchParams])

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
      resAsis.data.forEach(a => {
        map[a.alumno_id] = a.estado
        ids[a.alumno_id] = a.asistencia_id
      })
      setEstados(map)
      setAsistenciaIds(ids)
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
    if (docenteAusenteHoy) return
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

  const guardar = async () => {
    if (!materiaId) return
    const marcados = Object.keys(estados).length
    if (marcados === 0) return
    setSaving(true)
    setMensaje('')
    try {
      const asistencias = Object.entries(estados).map(([alumno_id, estado]) => ({
        alumno_id: Number(alumno_id),
        estado,
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
  const comisionSel = esDivision && comision
    ? (materia.comisiones || []).find(c => String(c.comision) === String(comision))
    : undefined
  const docenteLinea = esDivision && comision
    ? (comisionSel && (comisionSel.docente_nombre || comisionSel.reemplazo_id)
        ? {
            nombre: comisionSel.docente_nombre,
            apellido: comisionSel.docente_apellido,
            estado: comisionSel.docente_estado,
            reemplazo_id: comisionSel.reemplazo_id,
            reemplazo_nombre: comisionSel.reemplazo_nombre,
            reemplazo_apellido: comisionSel.reemplazo_apellido,
          }
        : null)
    : materia
  const alumnosVisibles = esDivision && comision
    ? alumnos.filter(a => a.comision === comision)
    : alumnos

  const titularId = esDivision && comision
    ? (comisionSel && comisionSel.docente_id) || null
    : (materia && materia.docente_id) || null
  const reemplazoId = esDivision && comision
    ? (comisionSel && comisionSel.reemplazo_id) || null
    : (materia && materia.reemplazo_id) || null
  const docenteAusenteHoy = !!(titularId && ausentesHoy.has(titularId) && !reemplazoId)
  const titularMensaje = esDivision && comision
    ? (comisionSel && `${comisionSel.docente_nombre || ''} ${comisionSel.docente_apellido || ''}`.trim())
    : (materia && `${materia.docente_nombre || ''} ${materia.docente_apellido || ''}`.trim())

  return (
    <div>
      <h1>Tomar Asistencia</h1>

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
          <label>Materia</label>
          <select
            value={materiaId}
            onChange={e => cambiarMateria(e.target.value)}
            disabled={!cursoId || materiasDelDia.length === 0}
          >
            <option value="">
              {cursoId && materiasDelDia.length === 0
                ? 'No hay materias con clase hoy'
                : 'Seleccionar materia'}
            </option>
            {materiasDelDia.map(m => (
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
          {docenteLinea?.docente_nombre && <> — {docenteLinea.docente_nombre} {docenteLinea.docente_apellido}</>}
          {docenteLinea && (docenteLinea.reemplazo_nombre || docenteLinea.reemplazo_apellido) &&
            <> · Reemplazo: {docenteLinea.reemplazo_nombre} {docenteLinea.reemplazo_apellido}</>}
        </p>
      )}

      {materia && docenteAusenteHoy && (
        <p className="notice">
          El docente {titularMensaje} está ausente hoy; no se puede tomar asistencia para esta materia.
        </p>
      )}

      {materia && docenteLinea && docenteLinea.docente_estado === 'Licencia' && !docenteLinea.reemplazo_id && (
        <p className="notice">
          El docente está de licencia y esta materia no tiene reemplazante asignado.
        </p>
      )}

      {loading && <p className="loading">Cargando...</p>}

      {!loading && cursoId && materiasDelDia.length === 0 && (
        <p className="notice">
          No hay materias con clase para este curso hoy. No se puede tomar asistencia.
        </p>
      )}

      {!loading && materiaId && (
        <>
          <div className="actions">
            <button
              className="btn-primary"
              onClick={guardar}
              disabled={saving || docenteAusenteHoy || !cambios || Object.keys(estados).length === 0}
            >
              {saving ? 'Guardando...' : 'Guardar Asistencia'}
            </button>
          </div>

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
            ? (materiasDelDia.length === 0 ? 'No hay materias con clase para hoy.' : 'Seleccioná una materia para comenzar')
            : 'Seleccioná un curso para comenzar'}
        </p>
      )}
    </div>
  )
}
