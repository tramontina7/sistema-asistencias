import { Router } from 'express'
import { qrController } from '../controllers/qrController.js'
import { authenticate, authenticateAlumno } from '../middlewares/auth.js'
import { validateEscanearQr } from '../middlewares/validate.js'

const router = Router()

router.get('/alumno', authenticateAlumno, qrController.alumno)
router.post('/escanear', authenticate, validateEscanearQr, qrController.escanear)

export default router