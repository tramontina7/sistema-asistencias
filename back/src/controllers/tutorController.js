import { tutorService } from '../services/tutorService.js'

export const tutorController = {
  list(req, res) {
    if (req.query.alumno_id) {
      res.json(tutorService.listarPorAlumno(Number(req.query.alumno_id)))
      return
    }
    res.json(tutorService.list())
  },

  getById(req, res) {
    res.json(tutorService.getById(Number(req.params.id)))
  },

  create(req, res) {
    const { nombre, apellido, dni, telefono, vinculos } = req.body
    res.status(201).json(tutorService.create({ nombre, apellido, dni, telefono, vinculos }))
  },

  update(req, res) {
    const { nombre, apellido, dni, telefono, vinculos } = req.body
    res.json(tutorService.update(Number(req.params.id), { nombre, apellido, dni, telefono, vinculos }))
  },

  remove(req, res) {
    res.json(tutorService.remove(Number(req.params.id)))
  },
}
