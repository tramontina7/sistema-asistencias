import { Router } from 'express'
import { materiaController } from '../controllers/materiaController.js'
import { authenticate } from '../middlewares/auth.js'

const router = Router()

router.get('/', authenticate, materiaController.list)
router.get('/all', authenticate, materiaController.listAll)
router.get('/catalogo', authenticate, materiaController.catalogo)
router.get('/:id', authenticate, materiaController.getById)
router.post('/', authenticate, materiaController.create)
router.put('/:id', authenticate, materiaController.update)
router.put('/:id/horarios', authenticate, materiaController.setHorarios)
router.put('/:id/comisiones', authenticate, materiaController.setComisiones)
router.delete('/:id', authenticate, materiaController.remove)

export default router
