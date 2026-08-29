import { Router } from 'express'
import { qrController } from '../controllers/qrController.js'
import { authenticate, authenticateAlumno } from '../middlewares/auth.js'

const router = Router()

router.post('/token', authenticate, qrController.generarTokens)
router.post('/escanear', authenticate, qrController.escanear)
router.post('/tokens-por-curso', authenticate, qrController.tokensPorCurso)
router.get('/alumno', authenticateAlumno, qrController.alumno)

export default router