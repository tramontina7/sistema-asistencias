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
  // En producción, ALLOWED_ORIGINS es obligatorio; en desarrollo se permite localhost por defecto.
  const isProd = process.env.NODE_ENV === 'production'
  let allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  if (isProd && allowedOrigins.length === 0) {
    throw new Error('[config] ALLOWED_ORIGINS debe configurarse en producción')
  }

  if (!isProd && allowedOrigins.length === 0) {
    allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173']
  }

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

  // Rate limit para login de alumnos (DNI)
  app.use(
    '/api/auth/alumno/login',
    rateLimit({
      windowMs: 60 * 1000,
      max: 10,
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