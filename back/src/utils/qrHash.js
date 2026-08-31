import crypto from 'crypto'

/** SHA-256 en hex del token QR. Se usa para comparar el QR vigente sin guardar el JWT plano. */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex')
}
