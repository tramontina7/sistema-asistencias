import { Router } from 'express'
import { retiroController } from '../controllers/retiroController.js'
import { tutorController } from '../controllers/tutorController.js'
import { authenticate } from '../middlewares/auth.js'

const router = Router()

router.get('/presentes', authenticate, retiroController.listarPresentes)
router.post('/', authenticate, retiroController.registrar)

const tutores = Router()
tutores.get('/', authenticate, tutorController.list)
tutores.post('/', authenticate, tutorController.create)
tutores.get('/:id', authenticate, tutorController.getById)
tutores.put('/:id', authenticate, tutorController.update)
tutores.delete('/:id', authenticate, tutorController.remove)
router.use('/tutores', tutores)

export default router
