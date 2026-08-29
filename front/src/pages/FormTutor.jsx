import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../api'

export default function FormTutor() {
  const { id } = useParams()
  const navegar = useNavigate()
  const editId = id || null
  const [form, setForm] = useState({ nombre: '', apellido: '', dni: '', telefono: '' })
  const [vinculos, setVinculos] = useState([])
  const [alumnos, setAlumnos] = useState([])
  const [cursos, setCursos] = useState([])
  const [cargando, setCargando] = useState(!!editId)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    api.get('/cursos').then(res => setCursos(res.data)).catch(() => {})
    api.get('/alumnos').then(res => setAlumnos(res.data)).catch(() => {})

    if (editId) {
      api.get(`/retiros/tutores/${editId}`)
        .then(res => {
          setForm({
            nombre: res.data.nombre,
            apellido: res.data.apellido,
            dni: res.data.dni,
            telefono: res.data.telefono || '',
          })
          setVinculos((res.data.vinculos || []).map(v => ({
            alumno_id: String(v.alumno_id),
            parentesco: v.parentesco || '',
            es_principal: v.es_principal ? 1 : 0,
          })))
          setCargando(false)
        })
        .catch(err => {
          setMensaje(err.response?.data?.error || 'No se pudo cargar el tutor')
          setCargando(false)
        })
    }
  }, [editId])

  const nombreAlumno = (alumnoId) => {
    const a = alumnos.find(x => String(x.alumno_id) === String(alumnoId))
    if (!a) return ''
    const curso = cursos.find(c => String(c.curso_id) === String(a.curso_id))
    return `${a.apellido}, ${a.nombre}${curso ? ` — ${curso.nombre} · ${curso.especialidad}` : ''}`
  }

  const agregarVinculo = () => {
    setVinculos([...vinculos, { alumno_id: '', parentesco: '', es_principal: 0 }])
  }

  const actualizarVinculo = (idx, campo, valor) => {
    const nuevos = vinculos.map((v, i) => i === idx ? { ...v, [campo]: valor } : v)
    setVinculos(nuevos)
  }

  const quitarVinculo = (idx) => {
    setVinculos(vinculos.filter((_, i) => i !== idx))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setMensaje('')
    const payload = {
      nombre: form.nombre,
      apellido: form.apellido,
      dni: form.dni,
      telefono: form.telefono,
      vinculos: vinculos
        .filter(v => v.alumno_id && v.parentesco)
        .map(v => ({
          alumno_id: Number(v.alumno_id),
          parentesco: v.parentesco,
          es_principal: Number(v.es_principal),
        })),
    }
    try {
      if (editId) {
        await api.put(`/retiros/tutores/${editId}`, payload)
      } else {
        await api.post('/retiros/tutores', payload)
      }
      navegar('/retiro/tutores')
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al guardar')
    }
  }

  return (
    <div>
      <h1>{editId ? 'Editar Tutor' : 'Nuevo Tutor'}</h1>

      {mensaje && <p className="error">{mensaje}</p>}

      {cargando ? (
        <p className="loading">Cargando...</p>
      ) : (
        <form onSubmit={handleSave} className="form-docente-page">
          <div className="form-group">
            <label>Nombre</label>
            <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Apellido</label>
            <input value={form.apellido} onChange={e => setForm({ ...form, apellido: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>DNI</label>
            <input value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Teléfono</label>
            <input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="opcional" />
          </div>

          <div className="form-group">
            <label>Alumnos a cargo</label>
            {vinculos.length === 0 && <p className="empty">No hay alumnos vinculados.</p>}
            {vinculos.map((v, idx) => (
              <div key={idx} className="search-row" style={{ marginBottom: 8 }}>
                <select
                  value={v.alumno_id}
                  onChange={e => actualizarVinculo(idx, 'alumno_id', e.target.value)}
                  required
                >
                  <option value="">Seleccionar alumno</option>
                  {alumnos.filter(a => {
                    const usados = vinculos.filter((x, i) => i !== idx).map(x => String(x.alumno_id))
                    return !usados.includes(String(a.alumno_id))
                  }).map(a => (
                    <option key={a.alumno_id} value={a.alumno_id}>{nombreAlumno(a.alumno_id)}</option>
                  ))}
                </select>
                <input
                  value={v.parentesco}
                  onChange={e => actualizarVinculo(idx, 'parentesco', e.target.value)}
                  placeholder="Parentesco (Madre, Padre...)"
                  required
                />
                <label className="check-item" style={{ margin: 0, whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={v.es_principal === 1}
                    onChange={e => actualizarVinculo(idx, 'es_principal', e.target.checked ? 1 : 0)}
                  />
                  Principal
                </label>
                <button type="button" className="btn-elim btn-danger" onClick={() => quitarVinculo(idx)}>Quitar</button>
              </div>
            ))}
            <button type="button" className="btn-secondary" onClick={agregarVinculo}>+ Agregar alumno</button>
          </div>

          <div className="actions">
            <button type="submit" className="btn-primary">Guardar</button>
            <Link to="/retiro/tutores" className="btn-secondary">Cancelar</Link>
          </div>
        </form>
      )}
    </div>
  )
}
