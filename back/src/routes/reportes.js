import { Router } from 'express'
import { reporteController } from '../controllers/reporteController.js'
import { authenticate } from '../middlewares/auth.js'

const router = Router()

router.get('/', authenticate, reporteController.generar)
router.get('/materia', authenticate, reporteController.faltasPorMateria)

export default router