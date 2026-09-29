import { describe, it, expect } from 'vitest'
import jwt from 'jsonwebtoken'
import { signToken, verifyToken, signQrToken, verifyQrToken } from '../../src/utils/jwt.js'
import { env } from '../../src/config/env.js'

const SECRET = env.jwtSecret
const QR_SECRET = env.qrSecret

describe('jwt iss/aud', () => {
  describe('signToken / verifyToken', () => {
    it('firma con los claims iss y aud esperados', () => {
      const decoded = verifyToken(signToken({ id: 1 }))
      expect(decoded.iss).toBe(env.jwtIssuer)
      expect(decoded.aud).toBe(env.jwtAudience)
    })

    it('rechaza un token firmado con el mismo secret pero otro issuer', () => {
      // Simula un token emitido por otro despliegue (staging) que comparte JWT_SECRET.
      const tokenDeOtroEntorno = jwt.sign({ id: 1 }, SECRET, {
        expiresIn: '8h',
        issuer: 'sistema-asistencias:staging',
        audience: env.jwtAudience,
      })
      expect(() => verifyToken(tokenDeOtroEntorno)).toThrow()
    })

    it('rechaza un token firmado con el mismo secret pero otra audience', () => {
      const tokenDeOtraAudience = jwt.sign({ id: 1 }, SECRET, {
        expiresIn: '8h',
        issuer: env.jwtIssuer,
        audience: 'otra-api',
      })
      expect(() => verifyToken(tokenDeOtraAudience)).toThrow()
    })

    it('rechaza un token legacy sin iss ni aud', () => {
      // Tokens emitidos antes de agregar los claims: deben dejar de ser aceptados.
      const tokenLegacy = jwt.sign({ id: 1 }, SECRET, { expiresIn: '8h' })
      expect(() => verifyToken(tokenLegacy)).toThrow()
    })

    it('rechaza un token con otro secret', () => {
      const tokenAjeno = jwt.sign({ id: 1 }, 'otro-secret-distinto', {
        expiresIn: '8h',
        ...{ issuer: env.jwtIssuer, audience: env.jwtAudience },
      })
      expect(() => verifyToken(tokenAjeno)).toThrow()
    })
  })

  describe('signQrToken / verifyQrToken', () => {
    it('firma con los claims iss y aud esperados', () => {
      const decoded = verifyQrToken(signQrToken({ alumno_id: 7 }))
      expect(decoded.tipo).toBe('qr')
      expect(decoded.iss).toBe(env.jwtIssuer)
      expect(decoded.aud).toBe(env.jwtAudience)
    })

    it('rechaza un token QR con otro issuer', () => {
      const tokenDeOtroEntorno = jwt.sign({ alumno_id: 7, tipo: 'qr' }, QR_SECRET, {
        expiresIn: '10m',
        issuer: 'sistema-asistencias:staging',
        audience: env.jwtAudience,
      })
      expect(() => verifyQrToken(tokenDeOtroEntorno)).toThrow()
    })

    it('rechaza un token QR sin iss ni aud', () => {
      const tokenLegacy = jwt.sign({ alumno_id: 7, tipo: 'qr' }, QR_SECRET, { expiresIn: '10m' })
      expect(() => verifyQrToken(tokenLegacy)).toThrow()
    })

    it('no acepta un token de acceso como si fuera un token QR', () => {
      // Un token de acceso lleva aud/iss correctos pero se firma con jwtSecret.
      expect(() => verifyQrToken(signToken({ id: 1 }))).toThrow()
    })

    it('genera un jti distinto en cada emision (rotacion del QR)', () => {
      const a = verifyQrToken(signQrToken({ alumno_id: 7 }))
      const b = verifyQrToken(signQrToken({ alumno_id: 7 }))
      expect(a.jti).not.toBe(b.jti)
    })
  })
})
