import { Router } from 'express'
import { cursoController } from '../controllers/cursoController.js'
import { authenticate } from '../middlewares/auth.js'
import { validateCreateCurso, validateUpdateCurso, validateIdParam } from '../middlewares/validate.js'

const router = Router()

router.get('/', authenticate, cursoController.list)
router.post('/', authenticate, validateCreateCurso, cursoController.create)
router.put('/:id', authenticate, validateUpdateCurso, cursoController.update)
router.delete('/:id', authenticate, validateIdParam, cursoController.remove)

export default router
