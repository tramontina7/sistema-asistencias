import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import apiRoutes from './routes/index.js'
import { notFound, errorHandler } from './middlewares/errorHandler.js'

/**
 * Configura y devuelve la aplicación de Express.
 * Se mantiene separada del inicio del servidor (server.js) para
 * poder instanciarla y testearla con Supertest sin abrir un puerto.
 */
export function createApp() {
  const app = express()

  // Seguridad y parsing
  app.use(helmet())
  app.use(cors())
  app.use(express.json({ limit: '10mb' }))

  // Límite global de solicitudes a la API
  app.use(
    '/api/',
    rateLimit({
      windowMs: 60 * 1000,
      max: 5000,
      message: { error: 'Demasiadas solicitudes, intente de nuevo en un minuto' },
    })
  )

  // Límites específicos de los endpoints de login
  app.use(
    '/api/auth/login',
    rateLimit({
      windowMs: 60 * 1000,
      max: 5,
      message: { error: 'Demasiados intentos de login, espere un minuto' },
    })
  )
  app.use(
    '/api/auth/alumno/login',
    rateLimit({
      windowMs: 60 * 1000,
      max: 10,
      message: { error: 'Demasiados intentos, espere un minuto' },
    })
  )

  // Rutas de la API
  app.use('/api', apiRoutes)

  // Manejo de errores y rutas no encontradas
  app.use(notFound)
  app.use(errorHandler)

  return app
}

export default createApp