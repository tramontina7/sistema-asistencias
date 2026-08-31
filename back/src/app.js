import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import apiRoutes from './routes/index.js'
import { notFound, errorHandler } from './middlewares/errorHandler.js'
import { HttpError } from './utils/http-error.js'

/**
 * Configura y devuelve la aplicación de Express.
 * Se mantiene separada del inicio del servidor (server.js) para
 * poder instanciarla y testearla con Supertest sin abrir un puerto.
 */
export function createApp() {
  const app = express()

  // Detrás de Nginx/reverse proxy: usa la IP real del cliente para el rate limiter.
  app.set('trust proxy', 1)

  // Lista blanca de orígenes para CORS (separados por coma en ALLOWED_ORIGINS).
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  // Seguridad y parsing
  app.use(helmet())
  app.use(cors({
    origin(origin, callback) {
      // Requests sin header Origin (same-origin, curl, tests) se permiten.
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) return callback(null, true)
      return callback(new HttpError(403, 'CORS: origen no permitido'))
    },
  }))
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

  // Rutas de la API
  app.use('/api', apiRoutes)

  // Manejo de errores y rutas no encontradas
  app.use(notFound)
  app.use(errorHandler)

  return app
}

export default createApp