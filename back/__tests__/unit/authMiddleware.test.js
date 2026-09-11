import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setupTestDb, resetDb, seedPreceptor } from '../helpers/inMemoryDb.js'

const mockedDb = setupTestDb()

vi.mock('../../src/utils/jwt.js', () => ({
  verifyToken: vi.fn(),
}))

import { authenticate } from '../../src/middlewares/auth.js'
import { verifyToken } from '../../src/utils/jwt.js'
import { HttpError } from '../../src/utils/http-error.js'

const mockedVerify = verifyToken

beforeEach(() => {
  resetDb(mockedDb)
  mockedVerify.mockReset()
})

function llamar() {
  const req = { headers: { authorization: 'Bearer token' } }
  let resultado
  authenticate(req, {}, (err) => {
    resultado = err || 'ok'
  })
  return { req, resultado }
}

describe('authenticate', () => {
  it('acepta un preceptor activo y deja req.usuario', () => {
    const id = seedPreceptor(mockedDb, { username: 'activo' })
    mockedVerify.mockReturnValue({ id, tipo: 'preceptor', username: 'activo' })
    const { req, resultado } = llamar()
    expect(resultado).toBe('ok')
    expect(req.usuario.username).toBe('activo')
  })

  it('rechaza inmediatamente un preceptor desactivado (revocación)', () => {
    const id = seedPreceptor(mockedDb, { username: 'inactivo', activo: 0 })
    mockedVerify.mockReturnValue({ id, tipo: 'preceptor', username: 'inactivo' })
    const { resultado } = llamar()
    expect(resultado).toBeInstanceOf(HttpError)
    expect(resultado.statusCode).toBe(401)
  })

  it('rechaza si el preceptor ya no existe en la base', () => {
    mockedVerify.mockReturnValue({ id: 999, tipo: 'preceptor', username: 'x' })
    const { resultado } = llamar()
    expect(resultado).toBeInstanceOf(HttpError)
    expect(resultado.statusCode).toBe(401)
  })

  it('rechaza tokens de tipo alumno', () => {
    mockedVerify.mockReturnValue({ tipo: 'alumno', alumno_id: 1 })
    const { resultado } = llamar()
    expect(resultado).toBeInstanceOf(HttpError)
    expect(resultado.statusCode).toBe(403)
  })

  it('requiere token', () => {
    const req = { headers: {} }
    let resultado
    authenticate(req, {}, (err) => { resultado = err })
    expect(resultado).toBeInstanceOf(HttpError)
    expect(resultado.statusCode).toBe(401)
  })
})
