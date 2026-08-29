import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../../api'

export default function FormDocente() {
  const { id } = useParams()
  const navegar = useNavigate()
  const editId = id || null
  const [catalogo, setCatalogo] = useState([])
  const [form, setForm] = useState({ nombre: '', apellido: '', dni: '', correo: '', telefono: '', puede_dictar: [] })
  const [cargando, setCargando] = useState(!!editId)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    api.get('/materias/catalogo').then(res => setCatalogo(res.data)).catch(() => {})
    if (editId) {
      api.get(`/docentes/${editId}`)
        .then(res => {
          setForm({
            nombre: res.data.nombre,
            apellido: res.data.apellido,
            dni: res.data.dni,
            correo: res.data.correo || '',
            telefono: res.data.telefono || '',
            puede_dictar: res.data.puede_dictar || [],
          })
          setCargando(false)
        })
        .catch(err => {
          setMensaje(err.response?.data?.error || 'No se pudo cargar el docente')
          setCargando(false)
        })
    }
  }, [editId])

  const toggleMateria = (nombre) => {
    const actual = form.puede_dictar || []
    setForm({
      ...form,
      puede_dictar: actual.includes(nombre)
        ? actual.filter(m => m !== nombre)
        : [...actual, nombre],
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setMensaje('')
    try {
      if (editId) {
        await api.put(`/docentes/${editId}`, form)
      } else {
        await api.post('/docentes', form)
      }
      navegar('/docentes')
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al guardar')
    }
  }

  const grupos = catalogo.reduce((acc, m) => {
    if (!acc[m.especialidad]) acc[m.especialidad] = []
    acc[m.especialidad].push(m.nombre_materia)
    return acc
  }, {})

  return (
    <div>
      <h1>{editId ? 'Editar Docente' : 'Nuevo Docente'}</h1>

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
            <label>Correo</label>
            <input value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })} placeholder="opcional" />
          </div>
          <div className="form-group">
            <label>Teléfono</label>
            <input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="opcional" />
          </div>
          <div className="form-group">
            <label>Puede dictar</label>
            {Object.keys(grupos).length === 0 ? (
              <p className="empty">No hay materias cargadas</p>
            ) : (
              <div className="competencias-grid">
                {Object.entries(grupos).map(([esp, materias]) => (
                  <fieldset key={esp}>
                    <legend>{esp}</legend>
                    {materias.map(m => (
                      <label key={m} className="check-item">
                        <input
                          type="checkbox"
                          checked={(form.puede_dictar || []).includes(m)}
                          onChange={() => toggleMateria(m)}
                        />
                        {m}
                      </label>
                    ))}
                  </fieldset>
                ))}
              </div>
            )}
          </div>
          <div className="actions">
            <button type="submit" className="btn-primary">Guardar</button>
            <Link to="/docentes" className="btn-secondary">Cancelar</Link>
          </div>
        </form>
      )}
    </div>
  )
}
