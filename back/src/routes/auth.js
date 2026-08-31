import { Router } from 'express'
import { authController } from '../controllers/authController.js'
import { authenticate } from '../middlewares/auth.js'

const router = Router()

router.post('/login', authController.login)
router.post('/alumno/login', authController.loginAlumno)
router.get('/me', authenticate, authController.me)

export default router