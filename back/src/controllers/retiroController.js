import { retiroService } from '../services/retiroService.js'
import { tutorService } from '../services/tutorService.js'

export const retiroController = {
  listarPresentes(req, res) {
    res.json(retiroService.listarPresentesPorCurso({
      cursoId: req.query.curso_id,
      fecha: req.query.fecha,
    }))
  },

  registrar(req, res) {
    const { alumnoId, nombre, apellido, dni, fecha, hora } = req.body
    const { tutor_id } = tutorService.validarTutorPorAlumno({ alumnoId, nombre, apellido, dni })
    const registro = retiroService.registrar({ alumnoId, tutorId: tutor_id, fecha, hora })
    res.status(201).json(registro)
  },
}
