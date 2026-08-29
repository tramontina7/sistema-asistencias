import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api'

export default function Alumnos() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('q') || ''
  const searchInput = useRef(null)
  const [cursos, setCursos] = useState([])
  const [alumnos, setAlumnos] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombre: '', apellido: '', dni: '', curso_id: '', comision: '' })
  const [editId, setEditId] = useState(null)
  const [mensaje, setMensaje] = useState('')

  const [previasOpenId, setPreviasOpenId] = useState(null)
  const [previas, setPrevias] = useState([])
  const [candidatas, setCandidatas] = useState([])
  const [nuevaPrevia, setNuevaPrevia] = useState({ materia_id: '', anio_cursada: '', estado: 'Pendiente' })

  useEffect(() => {
    api.get('/cursos').then(res => setCursos(res.data))
  }, [])

  const cargarAlumnos = async (q) => {
    const params = {}
    if (q) params.q = q
    const res = await api.get('/alumnos', { params })
    setAlumnos(res.data)
  }

  useEffect(() => { cargarAlumnos(search) }, [search])

  const handleSearch = (q) => {
    setSearchParams(q ? { q } : {}, { replace: true })
  }

  const openNew = () => {
    setForm({ nombre: '', apellido: '', dni: '', curso_id: '', comision: '' })
    setEditId(null)
    setShowForm(true)
  }

  const openEdit = (alumno) => {
    setForm({
      nombre: alumno.nombre,
      apellido: alumno.apellido,
      dni: alumno.dni,
      curso_id: alumno.curso_id,
      comision: alumno.comision || '',
    })
    setEditId(alumno.alumno_id)
    setShowForm(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setMensaje('')
    try {
      if (editId) {
        await api.put(`/alumnos/${editId}`, form)
      } else {
        await api.post('/alumnos', form)
      }
      setShowForm(false)
      cargarAlumnos()
      setMensaje(editId ? 'Alumno actualizado' : 'Alumno creado')
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al guardar')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este alumno?')) return
    try {
      await api.delete(`/alumnos/${id}`)
      cargarAlumnos()
      setMensaje('Alumno eliminado')
    } catch {
      setMensaje('Error al eliminar')
    }
  }

  const abrirPrevias = async (alumno) => {
    try {
      const [pRes, mRes] = await Promise.all([
        api.get(`/previas/alumno/${alumno.alumno_id}`),
        api.get('/materias/all'),
      ])
      setPrevias(pRes.data)
      setCandidatas(mRes.data.filter(m => !pRes.data.some(p => p.materia_id === m.materia_id)))
      setNuevaPrevia({ materia_id: '', anio_cursada: new Date().getFullYear(), estado: 'Pendiente' })
      setPreviasOpenId(alumno.alumno_id)
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al cargar previas')
    }
  }

  const cerrarPrevias = () => setPreviasOpenId(null)

  const inscribirPrevia = async () => {
    if (!nuevaPrevia.materia_id) return
    try {
      await api.post('/previas', {
        alumno_id: previasOpenId,
        materia_id: Number(nuevaPrevia.materia_id),
        anio_cursada: Number(nuevaPrevia.anio_cursada),
        estado: nuevaPrevia.estado,
      })
      abrirPrevias({ alumno_id: previasOpenId })
      setMensaje('Previa registrada')
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al inscribir')
    }
  }

  const eliminarPrevia = async (previaId) => {
    if (!confirm('¿Eliminar esta previa?')) return
    try {
      await api.delete(`/previas/${previaId}`)
      abrirPrevias({ alumno_id: previasOpenId })
      setMensaje('Previa eliminada')
    } catch {
      setMensaje('Error al eliminar')
    }
  }

  const cursoForm = cursos.find(c => String(c.curso_id) === String(form.curso_id))

  return (
    <div>
      <h1>Alumnos</h1>

      <div className="filters">
        <div className="form-group">
          <label>Buscar</label>
          <div className="search-row">
            <input
              ref={searchInput}
              type="text"
              defaultValue={search}
              key={search}
              placeholder="Nombre o apellido"
              onKeyDown={e => e.key === 'Enter' && handleSearch(e.target.value)}
            />
            <button className="btn-secondary" onClick={() => searchInput.current && handleSearch(searchInput.current.value)}>Buscar</button>
          </div>
        </div>
      </div>

      <div className="actions">
        <button className="btn-primary" onClick={openNew}>+ Nuevo Alumno</button>
      </div>

      {mensaje && <p className={mensaje.includes('Error') ? 'error' : 'success'}>{mensaje}</p>}

      {showForm && (
        <div className="modal">
          <div className="modal-content">
            <h3>{editId ? 'Editar Alumno' : 'Nuevo Alumno'}</h3>
            <form onSubmit={handleSave}>
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
                <label>Curso</label>
                <select value={form.curso_id} onChange={e => setForm({ ...form, curso_id: e.target.value })} required>
                  <option value="">Seleccionar</option>
                  {cursos.map(c => (
                    <option key={c.curso_id} value={c.curso_id}>{c.nombre} · {c.especialidad}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Comisión</label>
                <input value={form.comision} onChange={e => setForm({ ...form, comision: e.target.value })} placeholder="A, B, C..." required />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn-primary">Guardar</button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="tabla table-alumnos tabla-alumnos-crud">
        <div className="table-header">
          <span>Apellido</span>
          <span>Nombre</span>
          <span>DNI</span>
          <span>Curso</span>
          <span>Comisión</span>
          <span>Acciones</span>
        </div>
        {alumnos.map(a => {
          const curso = cursos.find(c => c.curso_id === a.curso_id)
          return (
            <div key={a.alumno_id} className="tabla-fila">
              <span>{a.apellido}</span>
              <span>{a.nombre}</span>
              <span>{a.dni}</span>
              <span>{curso ? curso.nombre : '-'}</span>
              <span>{a.comision}</span>
              <span className="actions-cell">
                <button className="btn-small" onClick={() => abrirPrevias(a)}>Previas</button>
                <button className="btn-small" onClick={() => openEdit(a)}>Editar</button>
                <button className="btn-elim btn-danger" onClick={() => handleDelete(a.alumno_id)}>Eliminar</button>
              </span>
            </div>
          )
        })}
        {alumnos.length === 0 && <p className="empty">No hay alumnos</p>}
      </div>

      {previasOpenId && (
        <div className="modal">
          <div className="modal-content">
            <h3>Previas del alumno</h3>
            <button className="btn-secondary modal-close" onClick={cerrarPrevias}>✕</button>

            {previas.length > 0 && (
              <div className="tabla">
                {previas.map(p => (
                  <div key={p.previa_id} className="tabla-fila">
                    <span>{p.nombre_materia} — {p.estado}</span>
                    <span className="actions-cell">
                      <button className="btn-small btn-danger" onClick={() => eliminarPrevia(p.previa_id)}>Quitar</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {previas.length === 0 && <p className="empty">El alumno no tiene previas</p>}

            <div className="form-group">
              <label>Agregar previa</label>
              <div className="search-row">
                <select value={nuevaPrevia.materia_id} onChange={e => setNuevaPrevia({ ...nuevaPrevia, materia_id: e.target.value })}>
                  <option value="">Seleccionar materia</option>
                  {candidatas.map(m => (
                    <option key={m.materia_id} value={m.materia_id}>{m.nombre_materia}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={nuevaPrevia.anio_cursada}
                  onChange={e => setNuevaPrevia({ ...nuevaPrevia, anio_cursada: e.target.value })}
                  placeholder="Año"
                  min="2000"
                  max="2100"
                  style={{ width: 80 }}
                />
                <select value={nuevaPrevia.estado} onChange={e => setNuevaPrevia({ ...nuevaPrevia, estado: e.target.value })}>
                  <option value="Pendiente">Pendiente</option>
                  <option value="En Curso">En Curso</option>
                  <option value="Regularizada">Regularizada</option>
                  <option value="Aprobada">Aprobada</option>
                </select>
                <button className="btn-primary" onClick={inscribirPrevia}>Agregar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
