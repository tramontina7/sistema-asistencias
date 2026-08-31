import { asistenciaService } from '../services/asistenciaService.js'
import { fechaLocal } from '../utils/fecha.js'
import { HttpError } from '../utils/http-error.js'

export const asistenciaController = {
  tomar(req, res) {
    const { materia_id, fecha, asistencias } = req.body
    if (!materia_id || !fecha || !Array.isArray(asistencias)) {
      throw new HttpError(400, 'materia_id, fecha y asistencias requeridos')
    }

    const hoy = fechaLocal()
    if (fecha !== hoy) {
      throw new HttpError(400, 'Solo se puede tomar la asistencia del día actual')
    }

    asistenciaService.tomar({ materiaId: materia_id, fecha, asistencias })
    res.json({ mensaje: 'Asistencia registrada' })
  },

  list(req, res) {
    const { materia_id, fecha } = req.query
    if (!materia_id || !fecha) {
      throw new HttpError(400, 'materia_id y fecha requeridos')
    }
    res.json(asistenciaService.list({ materiaId: materia_id, fecha }))
  },

  updateEstado(req, res) {
    const { estado, motivo, hora_ingreso, motivo_tarde } = req.body
    if (!estado) throw new HttpError(400, 'Estado requerido')
    asistenciaService.updateEstado(req.params.id, {
      estado,
      motivo,
      horaIngreso: hora_ingreso,
      motivoTarde: motivo_tarde,
    })
    res.json({ mensaje: 'Asistencia actualizada' })
  },
}
