import { previaService } from '../services/previaService.js'
import { HttpError } from '../utils/http-error.js'

export const previaController = {
  listPorCurso(req, res) {
    res.json(previaService.listPorCurso({ cursoId: req.params.cursoId }))
  },

  listPorAlumno(req, res) {
    res.json(previaService.listPorAlumno({ alumnoId: req.params.alumnoId }))
  },

  create(req, res) {
    const { alumno_id, materia_id, docente_id, anio_cursada, estado } = req.body
    if (!alumno_id || !materia_id || !anio_cursada || !estado) {
      throw new HttpError(400, 'alumno_id, materia_id, anio_cursada y estado requeridos')
    }
    res.status(201).json(
      previaService.create({ alumnoId: alumno_id, materiaId: materia_id, docenteId: docente_id, anioCursada: anio_cursada, estado })
    )
  },

  update(req, res) {
    const { estado, nota, fecha_evaluacion, docente_id } = req.body
    res.json(previaService.update(req.params.id, { estado, nota, fechaEvaluacion: fecha_evaluacion, docenteId: docente_id }))
  },

  remove(req, res) {
    previaService.remove(req.params.id)
    res.json({ mensaje: 'Previa eliminada' })
  },
}
