import db from '../db/index.js'
import { signQrToken, verifyQrToken } from '../utils/jwt.js'
import { fechaLocal } from '../utils/fecha.js'
import { HttpError } from '../utils/http-error.js'

export const qrService = {
  generarTokens(alumnoIds) {
    const ids = Array.isArray(alumnoIds) ? alumnoIds : [alumnoIds]

    return ids
      .map((id) => {
        const alumno = db.prepare(
          'SELECT alumno_id, nombre, apellido FROM alumnos WHERE alumno_id = ?'
        ).get(id)
        if (!alumno) return null
        return { ...alumno, token: signQrToken({ alumno_id: alumno.alumno_id }) }
      })
      .filter(Boolean)
  },

  escanear({ token, fecha }) {
    let decoded
    try {
      decoded = verifyQrToken(token)
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new HttpError(400, 'QR expirado, genere uno nuevo')
      }
      throw new HttpError(400, 'QR inválido')
    }

    if (decoded.tipo !== 'qr') {
      throw new HttpError(400, 'Token inválido')
    }

    const alumno = db.prepare(
      'SELECT alumno_id, nombre, apellido, curso_id FROM alumnos WHERE alumno_id = ?'
    ).get(decoded.alumno_id)
    if (!alumno) throw new HttpError(404, 'Alumno no encontrado')

    const today = fecha || fechaLocal()

    return { alumno, fecha: today }
  },

  tokensPorCurso(cursoId) {
    return db.prepare(
      'SELECT alumno_id, nombre, apellido FROM alumnos WHERE curso_id = ? ORDER BY apellido, nombre'
    ).all(cursoId).map((a) => ({
      id: a.alumno_id,
      nombre: a.nombre,
      apellido: a.apellido,
      token: signQrToken({ alumno_id: a.alumno_id }),
    }))
  },

  alumno(alumnoId) {
    const alumno = db.prepare(
      'SELECT alumno_id, nombre, apellido, curso_id FROM alumnos WHERE alumno_id = ?'
    ).get(alumnoId)
    if (!alumno) throw new HttpError(404, 'Alumno no encontrado')

    return { token: signQrToken({ alumno_id: alumno.alumno_id }), alumno }
  },
}
