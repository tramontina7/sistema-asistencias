import { describe, it, expect, beforeEach, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { setupTestDb, resetDb } from '../helpers/inMemoryDb.js'

const mockedDb = setupTestDb()

import { authService } from '../../src/services/authService.js'
import { HttpError } from '../../src/utils/http-error.js'

const hash = bcrypt.hashSync('preceptor123', 4)

beforeEach(() => {
  resetDb(mockedDb)
})

describe('authService', () => {
  describe('login', () => {
    beforeEach(() => {
      mockedDb.prepare(
        `INSERT INTO preceptores (nombre, apellido, dni_hash, dni_cif, telefono, username, password_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run('Carlos', 'Gutiérrez', 'h1', 'e1', '1234-5678', 'preceptor1', hash)
    })

    it('devuelve token y usuario para credenciales válidas', () => {
      const result = authService.login({ username: 'preceptor1', password: 'preceptor123' })
      expect(result.token).toBeTruthy()
      expect(result.usuario).toMatchObject({
        username: 'preceptor1',
        nombre: 'Carlos',
        apellido: 'Gutiérrez',
        rol: 'preceptor',
      })
      expect(result.usuario).not.toHaveProperty('password_hash')
    })

    it('lanza HttpError 401 con contraseña incorrecta', () => {
      expect(() => authService.login({ username: 'preceptor1', password: 'incorrecta' }))
        .toThrowError(HttpError)
    })

    it('lanza HttpError 401 si el usuario no existe', () => {
      expect(() => authService.login({ username: 'ghost', password: 'x' }))
        .toThrow(new HttpError(401, 'Credenciales inválidas'))
    })

    it('incluye el turno asignado en el usuario', () => {
      mockedDb.prepare(
        `INSERT INTO preceptores (nombre, apellido, dni_hash, dni_cif, telefono, username, password_hash, turno)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run('María', 'López', 'h3', 'e3', '1234-5678', 'preceptor-tarde', hash, 'Tarde')
      const result = authService.login({ username: 'preceptor-tarde', password: 'preceptor123' })
      expect(result.usuario).toMatchObject({ turno: 'Tarde' })
    })
  })

  describe('me', () => {
    it('devuelve el usuario por id', () => {
      const id = mockedDb.prepare(
        `INSERT INTO preceptores (nombre, apellido, dni_hash, dni_cif, telefono, username, password_hash)
         VALUES ('Ana', 'López', 'h2', 'e2', '1234-5678', 'u1', 'x')`
      ).run().lastInsertRowid

      const user = authService.me(id)
      expect(user).toMatchObject({ username: 'u1', rol: 'preceptor', turno: null })
    })

    it('lanza HttpError 401 si el usuario no existe', () => {
      expect(() => authService.me(999)).toThrow(new HttpError(401, 'Usuario no encontrado'))
    })
  })
})
