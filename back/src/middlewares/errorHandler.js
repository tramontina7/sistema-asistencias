import { HttpError } from '../utils/http-error.js'

/** Middleware para rutas no encontradas. */
export function notFound(req, _res, next) {
  next(new HttpError(404, 'Ruta no encontrada'))
}

/**
 * Middleware central de manejo de errores.
 * Traduce los HttpError lanzados por servicios/controladores a su código de estado
 * y devuelve 500 para cualquier error inesperado.
 */
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({ error: err.message })
  }

  console.error(err)
  return res.status(500).json({ error: 'Error interno del servidor' })
}