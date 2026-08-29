import { useState, useEffect, useRef, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import api from '../api'

export default function QrEscanear() {
  const [activo, setActivo] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [historial, setHistorial] = useState([])
  const scannerRef = useRef(null)
  const timeoutRef = useRef(null)
  const readerId = 'qr-reader-element'

  const limpiar = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (scannerRef.current) {
      try { scannerRef.current.stop().catch(() => {}); scannerRef.current.clear().catch(() => {}) } catch {}
      scannerRef.current = null
    }
  }, [])

  useEffect(() => limpiar, [limpiar])

  const feedbackTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setFeedback(null)
      if (scannerRef.current) {
        try { scannerRef.current.resume() } catch {}
      }
    }, 2500)
  }, [])

  const onScan = useCallback(async (decodedText) => {
    if (scannerRef.current) {
      try { scannerRef.current.pause() } catch {}
    }
    try {
      const res = await api.post('/qr/escanear', { token: decodedText })
      const a = res.data.alumno
      const esTarde = res.data.estado === 'Tarde'
      const materia = res.data.materia_nombre ? ` en ${res.data.materia_nombre}` : ''
      setFeedback({
        tipo: 'success',
        data: {
          ...a,
          esTarde,
          hora: res.data.hora,
          mensaje: esTarde ? `Marcado como TARDE${materia}` : `Marcado como presente${materia}`,
        },
      })
      setHistorial(prev => [{
        ...a,
        hora: res.data.hora || new Date().toLocaleTimeString('es-AR'),
        esTarde,
      }, ...prev].slice(0, 50))
      feedbackTimeout()
    } catch (err) {
      setFeedback({ tipo: 'error', data: { msg: err.response?.data?.error || 'QR inválido' } })
      feedbackTimeout()
    }
  }, [feedbackTimeout])

  const iniciar = async () => {
    setMensaje('')
    setFeedback(null)
    setActivo(true)

    requestAnimationFrame(async () => {
      try {
        const el = document.getElementById(readerId)
        if (!el) throw new Error('Elemento no encontrado')

        const scanner = new Html5Qrcode(readerId)
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          onScan,
          () => {}
        )
      } catch (err) {
        setMensaje('Error al acceder a la cámara: ' + err.message)
        setActivo(false)
      }
    })
  }

  const detener = () => {
    limpiar()
    setActivo(false)
    setFeedback(null)
  }

  return (
    <div className="qr-scan-page">
      <h1>Escanear QR</h1>
      <p className="subtitle">Apunta la cámara al código QR del alumno para marcar su asistencia al instante.</p>
      <p className="notice">La materia se detecta automáticamente según el curso y el horario del alumno.</p>

      {!activo && !mensaje && (
        <div className="scan-start">
          <button className="btn-primary btn-large" onClick={iniciar}>
            📷 Iniciar Cámara
          </button>
        </div>
      )}

      <div className={`scanner-container ${activo ? '' : 'hidden'}`}>
        <div id={readerId}></div>
      </div>

      {activo && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <button className="btn-secondary" onClick={detener}>Detener Cámara</button>
        </div>
      )}

      {feedback?.tipo === 'success' && (
        <div className={`scan-feedback ${feedback.data.esTarde ? 'error' : 'success'}`}>
          <span className="feedback-icon">{feedback.data.esTarde ? '🕐' : '✅'}</span>
          <div>
            <strong>{feedback.data.apellido}, {feedback.data.nombre}</strong>
            <p>{feedback.data.mensaje}{feedback.data.hora ? ` · ${feedback.data.hora}` : ''}</p>
          </div>
        </div>
      )}

      {feedback?.tipo === 'error' && (
        <div className="scan-feedback error">
          <span className="feedback-icon">❌</span>
          <div>
            <strong>Error</strong>
            <p>{feedback.data.msg}</p>
          </div>
        </div>
      )}

      {mensaje && <p className="error">{mensaje}</p>}

      {historial.length > 0 && (
        <div className="scan-historial">
          <h3>Últimos escaneos</h3>
          <div className="historial-list">
            {historial.map((h, i) => (
              <div key={i} className="historial-item">
                <span className="historial-hora">{h.hora}</span>
                <span className="historial-nombre">{h.apellido}, {h.nombre}</span>
                <span className="historial-estado">{h.esTarde ? '🕐' : '✅'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}