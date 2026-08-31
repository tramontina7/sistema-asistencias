import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../api'

const ESTADO_CLASE = {
  Presente: 'presente',
  Ausente: 'ausente',
  Justificado: 'justificado',
  Tarde: 'tardanza',
}

const ESTADO_ETIQUETA = {
  Presente: 'Presente',
  Ausente: 'Ausente',
  Justificado: 'Justificado',
  Tarde: 'Tarde',
}

const formatFecha = (iso) => {
  if (!iso) return '-'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function PerfilAlumno() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const alumnoId = searchParams.get('alumno') || ''
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!alumnoId) {
      setLoading(false)
      setError('Falta el identificador del alumno')
      return
    }
    setLoading(true)
    setError('')
    api.get(`/alumnos/perfil/${alumnoId}`)
      .then(res => setPerfil(res.data))
      .catch(err => setError(err.response?.data?.error || 'Error al cargar el perfil'))
      .finally(() => setLoading(false))
  }, [alumnoId])

  if (loading) return <p className="loading">Cargando...</p>

  if (error || !perfil) {
    return (
      <div>
        <h1>Perfil del Alumno</h1>
        <p className="error">{error || 'No se encontró el alumno'}</p>
        <button className="btn-secondary" onClick={() => navigate('/alumnos')}>Volver a Alumnos</button>
      </div>
    )
  }

  const tardanzas = (perfil.ultimas || []).filter(a => a.estado === 'Tarde')
  const { totales = {} } = perfil

  return (
    <div className="perfil-page">
      <div className="perfil-head">
        <h1>{perfil.apellido}, {perfil.nombre}</h1>
        <button className="btn-secondary" onClick={() => navigate('/alumnos')}>← Volver a Alumnos</button>
      </div>

      <div className="perfil-card">
        <div className="perfil-datos">
          <div className="perfil-fila">
            <span className="perfil-label">Nombre y apellido</span>
            <span className="perfil-valor">{perfil.nombre} {perfil.apellido}</span>
          </div>
          <div className="perfil-fila">
            <span className="perfil-label">DNI</span>
            <span className="perfil-valor">{perfil.dni}</span>
          </div>
          <div className="perfil-fila">
            <span className="perfil-label">Curso</span>
            <span className="perfil-valor">
              {perfil.curso ? `${perfil.curso.nombre} · ${perfil.curso.especialidad}` : '-'}
            </span>
          </div>
          <div className="perfil-fila">
            <span className="perfil-label">Turno</span>
            <span className="perfil-valor">{perfil.curso ? perfil.curso.turno : '-'}</span>
          </div>
          <div className="perfil-fila">
            <span className="perfil-label">Comisión</span>
            <span className="perfil-valor">{perfil.comision || '-'}</span>
          </div>
        </div>

        <div className="perfil-stats">
          <div className="stat stat-total"><span className="stat-num">{totales.total ?? 0}</span><span className="stat-label">Asistencias</span></div>
          <div className="stat stat-presente"><span className="stat-num">{totales.presentes ?? 0}</span><span className="stat-label">Presentes</span></div>
          <div className="stat stat-ausente"><span className="stat-num">{totales.ausencias ?? 0}</span><span className="stat-label">Ausencias</span></div>
          <div className="stat stat-tarde"><span className="stat-num">{totales.tardanzas ?? 0}</span><span className="stat-label">Tardanzas</span></div>
          <div className="stat stat-just"><span className="stat-num">{totales.justificados ?? 0}</span><span className="stat-label">Justificadas</span></div>
        </div>
      </div>

      <h2 className="perfil-seccion">Últimas asistencias</h2>
      {perfil.ultimas && perfil.ultimas.length > 0 ? (
        <div className="tabla table-alumnos tabla-ultimas">
          <div className="table-header">
            <span>Fecha</span>
            <span>Materia</span>
            <span>Estado</span>
            <span>Ingreso</span>
          </div>
          {perfil.ultimas.map(a => (
            <div key={a.asistencia_id} className="tabla-fila">
              <span>{formatFecha(a.fecha)}</span>
              <span>{a.nombre_materia}</span>
              <span>
                <span className={`badge ${ESTADO_CLASE[a.estado] || 'sin-asistencia'}`}>
                  {ESTADO_ETIQUETA[a.estado] || a.estado}
                </span>
              </span>
              <span>{a.hora_ingreso || '-'}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty">El alumno aún no tiene asistencias registradas.</p>
      )}

      <h2 className="perfil-seccion">Llegadas tarde</h2>
      {tardanzas.length > 0 ? (
        <ul className="tardanzas-list">
          {tardanzas.map(a => (
            <li key={a.asistencia_id}>
              Ingresó tarde el <strong>{formatFecha(a.fecha)}</strong> a las{' '}
              <strong>{a.hora_ingreso || 'hora no registrada'}</strong> en {a.nombre_materia}.
              {a.motivo_tarde ? ` Motivo: ${a.motivo_tarde}.` : ''}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">Sin llegadas tarde registradas.</p>
      )}
    </div>
  )
}
