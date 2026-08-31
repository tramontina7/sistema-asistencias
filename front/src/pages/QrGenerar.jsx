import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { turnoDeHora } from '../utils/turnos'

export default function QrGenerar() {
  const { usuario } = useAuth()
  const turno = usuario?.turno
  const [searchParams, setSearchParams] = useSearchParams()
  const cursoId = searchParams.get('curso') || ''
  const [cursos, setCursos] = useState([])
  const [materias, setMaterias] = useState([])
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const printRef = useRef()

  const cambiarCurso = (id) => {
    setSearchParams(id ? { curso: id } : {}, { replace: true })
  }

  useEffect(() => {
    api.get('/cursos').then(res => setCursos(res.data))
  }, [])

  useEffect(() => {
    api.get('/materias/all')
      .then(res => setMaterias(res.data))
      .catch(() => setMaterias([]))
  }, [])

  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const hoyDia = DIAS[new Date().getDay()]
  const cursoEnTurno = c => turno && materias.some(m =>
    String(m.curso_id) === String(c.curso_id) &&
    (m.horarios || []).some(h => h.dia_semana === hoyDia && turnoDeHora(h.hora_entrada) === turno)
  )
  const cursosDisponibles = turno ? cursos.filter(cursoEnTurno) : cursos

  const generar = async () => {
    if (!cursoId) return
    setLoading(true)
    setMensaje('')
    try {
      const res = await api.post('/qr/tokens-por-curso', { curso_id: Number(cursoId) })
      setTokens(res.data.tokens)
    } catch {
      setMensaje('Error al generar códigos')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    const curso = cursos.find(c => c.curso_id === Number(cursoId))
    const content = `
      <html>
        <head>
          <title>QR Alumnos - ${curso?.nombre}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Segoe UI', sans-serif; }
            h1 { text-align: center; font-size: 20px; margin-bottom: 20px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
            .card { text-align: center; border: 1px solid #ccc; border-radius: 8px; padding: 12px; page-break-inside: avoid; }
            .card canvas, .card svg { display: block; margin: 0 auto; }
            .nombre { font-size: 13px; font-weight: 600; margin-top: 8px; }
            .dni { font-size: 11px; color: #666; }
            .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #999; }
            @media print {
              .card { border: 1px solid #999; }
              .footer { position: fixed; bottom: 10mm; width: 100%; }
            }
          </style>
        </head>
        <body>
          <h1>${curso?.nombre}</h1>
          <div class="grid">
            ${tokens.map(t => `
              <div class="card">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(t.token)}" width="120" height="120" alt="QR" />
                <div class="nombre">${t.apellido}, ${t.nombre}</div>
                <div class="dni">${t.id}</div>
              </div>
            `).join('')}
          </div>
          <div class="footer">Generado el ${new Date().toLocaleDateString('es-AR')}</div>
          <script>window.print()</script>
        </body>
      </html>
    `
    printWindow.document.write(content)
    printWindow.document.close()
  }

  return (
    <div>
      <h1>Generar Códigos QR</h1>
      <p className="subtitle">Generá códigos QR únicos para cada alumno y los imprimís para pegar en sus carpetas o credenciales.</p>

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
          <label>&nbsp;</label>
          <button className="btn-primary" onClick={generar} disabled={loading || !cursoId}>
            {loading ? 'Generando...' : 'Generar QR'}
          </button>
        </div>
      </div>

      {mensaje && <p className="error">{mensaje}</p>}

      {turno && cursosDisponibles.length === 0 && (
        <p className="notice">Hoy no hay cursos con clases en el turno {turno}.</p>
      )}

      {tokens.length > 0 && (
        <>
          <div className="qr-actions">
            <span className="stats-summary">{tokens.length} alumnos</span>
            <button className="btn-secondary" onClick={handlePrint}>🖨️ Imprimir</button>
          </div>

          <div className="qr-grid" ref={printRef}>
            {tokens.map(t => (
              <div key={t.id} className="qr-card">
                <QRCodeCanvas value={t.token} size={120} level="M" />
                <div className="qr-nombre">{t.apellido}, {t.nombre}</div>
                <div className="qr-dni">ID: {t.id}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {tokens.length === 0 && cursoId && !loading && (
        <p className="empty">Seleccioná un curso y hacé clic en "Generar QR"</p>
      )}
    </div>
  )
}
