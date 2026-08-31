import { Router } from 'express'
import { qrController } from '../controllers/qrController.js'
import { authenticate } from '../middlewares/auth.js'

const router = Router()

router.post('/token', authenticate, qrController.generarTokens)
router.post('/escanear', authenticate, qrController.escanear)
router.post('/tokens-por-curso', authenticate, qrController.tokensPorCurso)

export default router