import { Router } from 'express'
import { asistenciaController } from '../controllers/asistenciaController.js'
import { authenticate } from '../middlewares/auth.js'
import { validateTomarAsistencia, validateListAsistencias, validateUpdateEstadoAsistencia } from '../middlewares/validate.js'

const router = Router()

router.post('/tomar', authenticate, validateTomarAsistencia, asistenciaController.tomar)
router.get('/', authenticate, validateListAsistencias, asistenciaController.list)
router.put('/:id', authenticate, validateUpdateEstadoAsistencia, asistenciaController.updateEstado)

export default router
