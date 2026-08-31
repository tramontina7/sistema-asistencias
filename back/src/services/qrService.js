import db from '../db/index.js'
import { signQrToken, verifyQrToken } from '../utils/jwt.js'
import { hashToken } from '../utils/qrHash.js'
import { fechaLocal } from '../utils/fecha.js'
import { HttpError } from '../utils/http-error.js'

export const qrService = {
  /**
   * Genera un nuevo token QR para un alumno y lo persiste como el vigente.
   * Cada llamada rota el hash almacenado, por lo que el token previo deja de
   * poder escanearse (rotación con invalidez real).
   */
  alumno(alumnoId) {
    const alumno = db.prepare(
      'SELECT alumno_id, nombre, apellido, curso_id FROM alumnos WHERE alumno_id = ?'
    ).get(alumnoId)
    if (!alumno) throw new HttpError(404, 'Alumno no encontrado')

    const token = signQrToken({ alumno_id: alumno.alumno_id })
    db.prepare('UPDATE alumnos SET qr_token_hash = ? WHERE alumno_id = ?')
      .run(hashToken(token), alumno.alumno_id)

    return { token, alumno }
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
      'SELECT alumno_id, nombre, apellido, curso_id, qr_token_hash FROM alumnos WHERE alumno_id = ?'
    ).get(decoded.alumno_id)
    if (!alumno) throw new HttpError(404, 'Alumno no encontrado')

    // Rotación estricta: solo el QR vigente (el último generado) es válido.
    if (!alumno.qr_token_hash || hashToken(token) !== alumno.qr_token_hash) {
      throw new HttpError(400, 'QR obsoleto. Pedile al alumno que actualice su código')
    }

    const today = fecha || fechaLocal()

    return { alumno, fecha: today }
  },
}
