import { Router } from 'express'
import { alumnoController } from '../controllers/alumnoController.js'
import { authenticate } from '../middlewares/auth.js'
import { validateCreateAlumno, validateUpdateAlumno, validateListAlumnos, validateIdParam } from '../middlewares/validate.js'

const router = Router()

router.get('/', authenticate, validateListAlumnos, alumnoController.list)
router.get('/perfil/:id', authenticate, validateIdParam, alumnoController.perfil)
router.get('/:id', authenticate, validateIdParam, alumnoController.getById)
router.post('/', authenticate, validateCreateAlumno, alumnoController.create)
router.put('/:id', authenticate, validateUpdateAlumno, alumnoController.update)
router.delete('/:id', authenticate, validateIdParam, alumnoController.remove)

export default router