import { Router } from 'express'
import { alumnoController } from '../controllers/alumnoController.js'
import { authenticate } from '../middlewares/auth.js'

const router = Router()

router.get('/', authenticate, alumnoController.list)
router.get('/perfil/:id', authenticate, alumnoController.perfil)
router.get('/:id', authenticate, alumnoController.getById)
router.post('/', authenticate, alumnoController.create)
router.put('/:id', authenticate, alumnoController.update)
router.delete('/:id', authenticate, alumnoController.remove)

export default router