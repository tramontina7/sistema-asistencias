import { reporteService } from '../services/reporteService.js'
import { HttpError } from '../utils/http-error.js'

export const reporteController = {
  generar(req, res) {
    const { curso_id, tipo = 'dia', fecha, cuatrimestre } = req.query
    if (!curso_id || !fecha) {
      throw new HttpError(400, 'curso_id y fecha requeridos')
    }
    res.json(reporteService.generar({ cursoId: curso_id, tipo, fecha, cuatrimestre }))
  },

  matrizPorMateria(req, res) {
    const { curso_id } = req.query
    if (!curso_id) {
      throw new HttpError(400, 'curso_id requerido')
    }
    res.json(reporteService.matrizPorMateria({ cursoId: curso_id }))
  },
}
