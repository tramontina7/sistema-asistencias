import { Router } from 'express'
import { reporteController } from '../controllers/reporteController.js'
import { authenticate } from '../middlewares/auth.js'
import { validateGenerarReporte, validateMatrizPorMateria } from '../middlewares/validate.js'

const router = Router()

router.get('/', authenticate, validateGenerarReporte, reporteController.generar)
router.get('/materia', authenticate, validateMatrizPorMateria, reporteController.matrizPorMateria)

export default router