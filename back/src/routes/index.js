import { Router } from 'express'
import authRoutes from './auth.js'
import cursosRoutes from './cursos.js'
import alumnosRoutes from './alumnos.js'
import asistenciasRoutes from './asistencias.js'
import reportesRoutes from './reportes.js'
import qrRoutes from './qr.js'
import materiasRoutes from './materias.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/cursos', cursosRoutes)
router.use('/alumnos', alumnosRoutes)
router.use('/asistencias', asistenciasRoutes)
router.use('/reportes', reportesRoutes)
router.use('/qr', qrRoutes)
router.use('/materias', materiasRoutes)

export default router
