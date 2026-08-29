import { Router } from 'express'
import { previaController } from '../controllers/previaController.js'
import { authenticate } from '../middlewares/auth.js'

const router = Router()

router.get('/curso/:cursoId', authenticate, previaController.listPorCurso)
router.get('/alumno/:alumnoId', authenticate, previaController.listPorAlumno)
router.post('/', authenticate, previaController.create)
router.put('/:id', authenticate, previaController.update)
router.delete('/:id', authenticate, previaController.remove)

export default router
