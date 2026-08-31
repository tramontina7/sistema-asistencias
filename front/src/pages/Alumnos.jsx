import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../api'

export default function Alumnos() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const search = searchParams.get('q') || ''
  const searchInput = useRef(null)
  const [cursos, setCursos] = useState([])
  const [alumnos, setAlumnos] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombre: '', apellido: '', dni: '', curso_id: '', comision: '' })
  const [editId, setEditId] = useState(null)
  const [mensaje, setMensaje] = useState('')

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
            <div key={a.alumno_id} className="tabla-fila" onClick={() => navigate(`/alumnos/perfil?alumno=${a.alumno_id}`)}>
              <span>{a.apellido}</span>
              <span>{a.nombre}</span>
              <span>{a.dni}</span>
              <span>{curso ? curso.nombre : '-'}</span>
              <span>{a.comision}</span>
              <span className="actions-cell" onClick={e => e.stopPropagation()}>
                <button className="btn-small" onClick={() => openEdit(a)}>Editar</button>
                <button className="btn-elim btn-danger" onClick={() => handleDelete(a.alumno_id)}>Eliminar</button>
              </span>
            </div>
          )
        })}
        {alumnos.length === 0 && <p className="empty">No hay alumnos</p>}
      </div>
    </div>
  )
}
