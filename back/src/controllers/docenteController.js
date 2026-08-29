import { docenteService } from '../services/docenteService.js'

export const docenteController = {
  list(_req, res) {
    res.json(docenteService.list())
  },

  getById(req, res) {
    res.json(docenteService.getById(req.params.id))
  },

  create(req, res) {
    res.status(201).json(
      docenteService.create({
        nombre: req.body.nombre,
        apellido: req.body.apellido,
        dni: req.body.dni,
        correo: req.body.correo,
        telefono: req.body.telefono,
        puedeDictar: req.body.puede_dictar,
        estado: req.body.estado,
      })
    )
  },

  update(req, res) {
    res.json(
      docenteService.update(req.params.id, {
        nombre: req.body.nombre,
        apellido: req.body.apellido,
        dni: req.body.dni,
        correo: req.body.correo,
        telefono: req.body.telefono,
        puedeDictar: req.body.puede_dictar,
        estado: req.body.estado,
      })
    )
  },

  remove(req, res) {
    docenteService.remove(req.params.id)
    res.json({ mensaje: 'Docente eliminado' })
  },

  materias(req, res) {
    res.json(docenteService.materias(req.params.id))
  },

  disponibilidad(_req, res) {
    res.json(docenteService.disponibilidad())
  },

  cambiarEstado(req, res) {
    res.json(docenteService.cambiarEstado(req.params.id, req.body.estado))
  },

  asignarReemplazo(req, res) {
    res.status(201).json(
      docenteService.asignarReemplazo(req.body.materia_id, req.body.suplente_id, req.body.comision)
    )
  },

  quitarReemplazo(req, res) {
    res.json(docenteService.quitarReemplazo(req.params.materia_id, req.query.comision))
  },
}