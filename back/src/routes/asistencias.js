import { Router } from 'express'
import { asistenciaController } from '../controllers/asistenciaController.js'
import { authenticate } from '../middlewares/auth.js'

const router = Router()

router.post('/tomar', authenticate, asistenciaController.tomar)
router.get('/', authenticate, asistenciaController.list)
router.put('/:id', authenticate, asistenciaController.updateEstado)

export default router
