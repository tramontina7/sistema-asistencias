import { ausenciaService } from '../services/ausenciaService.js'

export const ausenciaController = {
  listar(req, res) {
    res.json(ausenciaService.listar({ fecha: req.query.fecha }))
  },

  listarDocentes(req, res) {
    res.json(ausenciaService.listarDocentes({ fecha: req.query.fecha }))
  },

  marcar(req, res) {
    res.status(201).json(ausenciaService.marcar(req.body.docente_id, req.body.fecha))
  },

  quitar(req, res) {
    res.json(ausenciaService.quitar(req.query.docente_id, req.query.fecha))
  },
}
