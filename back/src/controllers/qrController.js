import { qrService } from '../services/qrService.js'
import { asistenciaService } from '../services/asistenciaService.js'
import { HttpError } from '../utils/http-error.js'

export const qrController = {
  alumno(req, res) {
    res.json(qrService.alumno(req.alumno.alumno_id))
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
}
