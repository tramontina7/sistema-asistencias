import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

/** Firma un token de acceso para usuarios (preceptor/admin). */
export function signToken(payload, expiresIn = '8h') {
  return jwt.sign(payload, env.jwtSecret, { expiresIn })
}

/** Verifica un token de acceso de usuario. Devuelve el payload decodificado. */
export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret)
}

/** Firma un token de QR para alumnos. */
export function signQrToken(payload, expiresIn = '365d') {
  return jwt.sign({ ...payload, tipo: 'qr' }, env.qrSecret, { expiresIn })
}

/** Verifica un token de QR. */
export function verifyQrToken(token) {
  return jwt.verify(token, env.qrSecret)
}