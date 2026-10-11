import { Router } from 'express'
import { authController } from '../controllers/authController.js'
import { authenticate } from '../middlewares/auth.js'
import { validateLoginPreceptor, validateLoginAlumno } from '../middlewares/validate.js'

const router = Router()

router.post('/login', validateLoginPreceptor, authController.login)
router.post('/alumno/login', validateLoginAlumno, authController.loginAlumno)
router.get('/me', authenticate, authController.me)

export default router