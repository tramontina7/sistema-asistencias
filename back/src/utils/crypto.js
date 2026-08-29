import crypto from 'crypto'
import { env } from '../config/env.js'

const ALGORITHM = 'aes-256-cbc'

function getKey() {
  return crypto.createHash('sha256').update(env.encryptionKey).digest()
}

/** Cifra una cadena (ej. DNI) con AES-256-CBC. Devuelve IV:payload en hex. */
export function encrypt(text) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

/** Descifra una cadena producida por encrypt(). */
export function decrypt(encryptedText) {
  const parts = encryptedText.split(':')
  const iv = Buffer.from(parts.shift(), 'hex')
  const encrypted = parts.join(':')
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}