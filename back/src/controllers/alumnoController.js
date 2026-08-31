import { alumnoService } from '../services/alumnoService.js'
import { HttpError } from '../utils/http-error.js'

export const alumnoController = {
  list(req, res) {
    const { curso_id, comision, q } = req.query
    res.json(alumnoService.list({ cursoId: curso_id, comision, q }))
  },

  getById(req, res) {
    res.json(alumnoService.getById(req.params.id))
  },

  perfil(req, res) {
    res.json(alumnoService.perfil(req.params.id))
  },

  create(req, res) {
    const { nombre, apellido, dni, curso_id, comision } = req.body
    if (!nombre || !apellido || !dni || !curso_id || !comision) {
      throw new HttpError(400, 'Todos los campos son requeridos')
    }
    res.status(201).json(
      alumnoService.create({ nombre, apellido, dni, cursoId: curso_id, comision })
    )
  },

  update(req, res) {
    const { nombre, apellido, dni, curso_id, comision } = req.body
    alumnoService.update(req.params.id, {
      nombre,
      apellido,
      dni,
      cursoId: curso_id,
      comision,
    })
    res.json({ mensaje: 'Alumno actualizado' })
  },

  remove(req, res) {
    alumnoService.remove(req.params.id)
    res.json({ mensaje: 'Alumno eliminado' })
  },
}
