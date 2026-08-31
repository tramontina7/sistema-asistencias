import { Router } from 'express'
import { qrController } from '../controllers/qrController.js'
import { authenticate, authenticateAlumno } from '../middlewares/auth.js'

const router = Router()

router.get('/alumno', authenticateAlumno, qrController.alumno)
router.post('/escanear', authenticate, qrController.escanear)

export default router