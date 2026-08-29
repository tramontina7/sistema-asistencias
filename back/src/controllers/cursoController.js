import { cursoService } from '../services/cursoService.js'
import { HttpError } from '../utils/http-error.js'

export const cursoController = {
  list(req, res) {
    res.json(cursoService.list())
  },

  create(req, res) {
    const { anio, division, especialidad, turno } = req.body
    if (anio === undefined || !division || !turno) {
      throw new HttpError(400, 'anio, division y turno requeridos')
    }
    res.status(201).json(cursoService.create({ anio, division, especialidad, turno }))
  },

  update(req, res) {
    const { anio, division, especialidad, turno } = req.body
    if (anio === undefined && division === undefined && especialidad === undefined && turno === undefined) {
      throw new HttpError(400, 'No hay campos para actualizar')
    }
    res.json(cursoService.update(req.params.id, { anio, division, especialidad, turno }))
  },

  remove(req, res) {
    cursoService.remove(req.params.id)
    res.json({ mensaje: 'Curso eliminado' })
  },
}
