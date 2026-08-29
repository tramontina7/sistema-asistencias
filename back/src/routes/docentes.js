import { Router } from 'express'
import { docenteController } from '../controllers/docenteController.js'
import { ausenciaController } from '../controllers/ausenciaController.js'
import { authenticate } from '../middlewares/auth.js'

const router = Router()

router.get('/', authenticate, docenteController.list)
router.get('/ausencias', authenticate, ausenciaController.listar)
router.get('/ausencias/docentes', authenticate, ausenciaController.listarDocentes)
router.put('/ausencias', authenticate, ausenciaController.marcar)
router.delete('/ausencias', authenticate, ausenciaController.quitar)
router.get('/disponibilidad', authenticate, docenteController.disponibilidad)
router.get('/:id', authenticate, docenteController.getById)
router.get('/:id/materias', authenticate, docenteController.materias)
router.post('/', authenticate, docenteController.create)
router.put('/reemplazos', authenticate, docenteController.asignarReemplazo)
router.put('/:id', authenticate, docenteController.update)
router.put('/:id/estado', authenticate, docenteController.cambiarEstado)
router.delete('/reemplazos/:materia_id', authenticate, docenteController.quitarReemplazo)
router.delete('/:id', authenticate, docenteController.remove)

export default router