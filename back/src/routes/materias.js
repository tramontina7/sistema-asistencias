import { Router } from 'express'
import { materiaController } from '../controllers/materiaController.js'
import { authenticate } from '../middlewares/auth.js'
import { validateListMaterias, validateCreateMateria, validateUpdateMateria, validateSetHorarios, validateSetComisiones, validateIdParam } from '../middlewares/validate.js'

const router = Router()

router.get('/', authenticate, validateListMaterias, materiaController.list)
router.get('/all', authenticate, materiaController.listAll)
router.get('/catalogo', authenticate, materiaController.catalogo)
router.get('/:id', authenticate, validateIdParam, materiaController.getById)
router.post('/', authenticate, validateCreateMateria, materiaController.create)
router.put('/:id', authenticate, validateUpdateMateria, materiaController.update)
router.put('/:id/horarios', authenticate, validateSetHorarios, materiaController.setHorarios)
router.put('/:id/comisiones', authenticate, validateSetComisiones, materiaController.setComisiones)
router.delete('/:id', authenticate, validateIdParam, materiaController.remove)

export default router
