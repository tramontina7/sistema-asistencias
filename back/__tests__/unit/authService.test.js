import { describe, it, expect, beforeEach, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { setupTestDb, resetDb, seedCurso } from '../helpers/inMemoryDb.js'
import { encrypt } from '../../src/utils/crypto.js'

const mockedDb = setupTestDb()

import { authService } from '../../src/services/authService.js'
import { HttpError } from '../../src/utils/http-error.js'

const hash = bcrypt.hashSync('preceptor123', 4)

function seedAlumnoCifrado({ nombre, apellido, dni, cursoId, comision = 'A' }) {
  const dniHash = bcrypt.hashSync(String(dni), 10)
  return mockedDb.prepare(
    `INSERT INTO alumnos (nombre, apellido, dni_hash, dni_cif, curso_id, comision)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(nombre, apellido, dniHash, encrypt(String(dni)), cursoId, comision).lastInsertRowid
}

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

    it('rechaza el login de un preceptor desactivado', () => {
      mockedDb.prepare(
        `INSERT INTO preceptores (nombre, apellido, dni_hash, dni_cif, telefono, username, password_hash, turno, activo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run('In', 'Activo', 'h4', 'e4', '1234-5678', 'inactivo', hash, 'Mañana', 0)
      expect(() => authService.login({ username: 'inactivo', password: 'preceptor123' }))
        .toThrow(new HttpError(401, 'Cuenta desactivada'))
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

  describe('loginAlumno', () => {
    let cursoId

    beforeEach(() => {
      cursoId = seedCurso(mockedDb, { anio: 7, division: '1', especialidad: 'MMO' })
    })

    it('devuelve token de alumno para datos correctos (case-insensitive)', () => {
      seedAlumnoCifrado({ nombre: 'Ana', apellido: 'López', dni: '40000001', cursoId })
      const result = authService.loginAlumno({ nombre: 'ana', apellido: 'lópez', dni: '40000001' })
      expect(result.token).toBeTruthy()
      expect(result.alumno).toMatchObject({ nombre: 'Ana', apellido: 'López', curso_id: cursoId })
    })

    it('lanza HttpError 401 si no coincide el DNI', () => {
      seedAlumnoCifrado({ nombre: 'Ana', apellido: 'López', dni: '40000001', cursoId })
      expect(() => authService.loginAlumno({ nombre: 'Ana', apellido: 'López', dni: '999999' }))
        .toThrow(new HttpError(401, 'Datos incorrectos. Verificá tu nombre, apellido y DNI.'))
    })

    it('lanza HttpError 401 si el nombre o apellido no existen', () => {
      expect(() => authService.loginAlumno({ nombre: 'No', apellido: 'Existe', dni: '40000001' }))
        .toThrow(new HttpError(401, 'Datos incorrectos. Verificá tu nombre, apellido y DNI.'))
    })
  })
})
