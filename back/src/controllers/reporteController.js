import { reporteService } from '../services/reporteService.js'
import { HttpError } from '../utils/http-error.js'

export const reporteController = {
  generar(req, res) {
    const { curso_id, tipo = 'dia', fecha } = req.query
    if (!curso_id || !fecha) {
      throw new HttpError(400, 'curso_id y fecha requeridos')
    }
    res.json(reporteService.generar({ cursoId: curso_id, tipo, fecha }))
  },

  faltasPorMateria(req, res) {
    const { curso_id, desde, hasta } = req.query
    if (!curso_id || !desde || !hasta) {
      throw new HttpError(400, 'curso_id, desde y hasta requeridos')
    }
    res.json(reporteService.faltasPorMateria({ cursoId: curso_id, desde, hasta }))
  },
}
