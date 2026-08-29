import { Router } from 'express'
import { cursoController } from '../controllers/cursoController.js'
import { authenticate } from '../middlewares/auth.js'

const router = Router()

router.get('/', authenticate, cursoController.list)
router.post('/', authenticate, cursoController.create)
router.put('/:id', authenticate, cursoController.update)
router.delete('/:id', authenticate, cursoController.remove)

export default router
