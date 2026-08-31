import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import { env } from '../config/env.js'

/** Firma un token de acceso para usuarios (preceptor/admin). */
export function signToken(payload, expiresIn = '8h') {
  return jwt.sign(payload, env.jwtSecret, { expiresIn })
}

/** Verifica un token de acceso de usuario. Devuelve el payload decodificado. */
export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret)
}

/** Firma un token de QR para alumnos.
 *  TTL corto (10 min): el QR se genera bajo demanda y se escanea en segundos,
 *  reduciendo la ventana de reuso de un QR capturado o fotografiado.
 *  Cada invocación recibe un jti único, garantizando que dos emisiones en el
 *  mismo segundo produzcan tokens distintos (clave para la rotación del QR). */
export function signQrToken(payload, expiresIn = '10m') {
  return jwt.sign({ ...payload, tipo: 'qr', jti: randomUUID() }, env.qrSecret, { expiresIn })
}

/** Verifica un token de QR. */
export function verifyQrToken(token) {
  return jwt.verify(token, env.qrSecret)
}