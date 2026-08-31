import { verifyToken } from '../utils/jwt.js'
import { HttpError } from '../utils/http-error.js'

export function authenticate(req, _res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return next(new HttpError(401, 'Token requerido'))
  }

  let decoded
  try {
    decoded = verifyToken(header.split(' ')[1])
  } catch {
    return next(new HttpError(401, 'Token inválido o expirado'))
  }

  if (decoded.tipo === 'alumno') {
    return next(new HttpError(403, 'Acceso denegado: se requiere cuenta de preceptor'))
  }

  req.usuario = decoded
  next()
}

export function authenticateAlumno(req, _res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return next(new HttpError(401, 'Token requerido'))
  }

  let decoded
  try {
    decoded = verifyToken(header.split(' ')[1])
  } catch {
    return next(new HttpError(401, 'Token inválido o expirado'))
  }

  if (decoded.tipo !== 'alumno') {
    return next(new HttpError(403, 'Acceso denegado: se requiere cuenta de alumno'))
  }

  req.alumno = decoded
  next()
}
