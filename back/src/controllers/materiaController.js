import { materiaService } from '../services/materiaService.js'
import { HttpError } from '../utils/http-error.js'

export const materiaController = {
  list(req, res) {
    const { curso_id } = req.query
    if (!curso_id) throw new HttpError(400, 'curso_id requerido')
    res.json(materiaService.list({ cursoId: curso_id }))
  },

  listAll(_req, res) {
    res.json(materiaService.listAll())
  },

  catalogo(_req, res) {
    res.json(materiaService.catalogo())
  },

  getById(req, res) {
    res.json(materiaService.getById(req.params.id))
  },

  create(req, res) {
    const { curso_id, nombre_materia, especialidad, tipo } = req.body
    if (!curso_id || !nombre_materia) throw new HttpError(400, 'curso_id y nombre_materia requeridos')
    res.status(201).json(
      materiaService.create({ cursoId: curso_id, nombreMateria: nombre_materia, especialidad, tipo })
    )
  },

  update(req, res) {
    const { nombre_materia, especialidad, tipo } = req.body
    if (nombre_materia === undefined && especialidad === undefined && tipo === undefined) {
      throw new HttpError(400, 'No hay campos para actualizar')
    }
    res.json(materiaService.update(req.params.id, { nombreMateria: nombre_materia, especialidad, tipo }))
  },

  setHorarios(req, res) {
    const { horarios } = req.body
    if (!Array.isArray(horarios)) throw new HttpError(400, 'horarios debe ser un arreglo')
    res.json(materiaService.setHorarios(req.params.id, horarios))
  },

  setComisiones(req, res) {
    const { comisiones } = req.body
    if (!Array.isArray(comisiones)) throw new HttpError(400, 'comisiones debe ser un arreglo')
    res.json(materiaService.setComisiones(req.params.id, comisiones))
  },

  remove(req, res) {
    materiaService.remove(req.params.id)
    res.json({ mensaje: 'Materia eliminada' })
  },
}
