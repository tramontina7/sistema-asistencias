import { qrService } from '../services/qrService.js'
import { asistenciaService } from '../services/asistenciaService.js'
import { env } from '../config/env.js'
import { HttpError } from '../utils/http-error.js'

export const qrController = {
  generarTokens(req, res) {
    const { alumno_id } = req.body
    if (!alumno_id) {
      throw new HttpError(400, 'alumno_id requerido')
    }

    const baseUrl = `${req.protocol}://${req.hostname}:${env.port}`
    const tokens = qrService.generarTokens(alumno_id).map((a) => ({
      id: a.alumno_id,
      nombre: a.nombre,
      apellido: a.apellido,
      token: a.token,
      url: `${baseUrl}/scan?token=${a.token}`,
    }))

    res.json({ tokens })
  },

  escanear(req, res) {
    const { token, fecha, materia_id } = req.body
    if (!token) throw new HttpError(400, 'token requerido')

    const { alumno, fecha: today } = qrService.escanear({ token, fecha })
    const materia = materia_id
      ? { materia_id, nombre_materia: null }
      : asistenciaService.materiaDelMomento({ cursoId: alumno.curso_id })

    const registro = asistenciaService.registrarQr({
      alumnoId: alumno.alumno_id,
      materiaId: materia.materia_id,
      fecha: today,
    })

    res.json({
      mensaje: 'Asistencia registrada',
      alumno: { id: alumno.alumno_id, nombre: alumno.nombre, apellido: alumno.apellido },
      fecha: today,
      estado: registro.estado,
      hora: registro.hora,
      materia_id: materia.materia_id,
      materia_nombre: materia.nombre_materia,
    })
  },

  tokensPorCurso(req, res) {
    const { curso_id } = req.body
    if (!curso_id) throw new HttpError(400, 'curso_id requerido')
    res.json({ tokens: qrService.tokensPorCurso(curso_id) })
  },
}
