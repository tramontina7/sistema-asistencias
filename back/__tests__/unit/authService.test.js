import { describe, it, expect, beforeEach, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { DDL, seedCurso } from '../helpers/inMemoryDb.js'

vi.mock('../../src/db/index.js', async () => {
  const Database = (await import('better-sqlite3')).default
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(DDL)
  return { default: db }
})

const mockedDb = (await import('../../src/db/index.js')).default

import { authService } from '../../src/services/authService.js'
import { HttpError } from '../../src/utils/http-error.js'
import { encrypt } from '../../src/utils/crypto.js'

const hash = bcrypt.hashSync('preceptor123', 4)

const RESET = [
  'previas', 'asistencias', 'horarios', 'materias',
  'alumnos_tutores', 'alumnos', 'preceptores_cursos', 'preceptores',
  'docentes', 'cursos', 'tutores',
]

beforeEach(() => {
  for (const t of RESET) {
    try { mockedDb.prepare(`DELETE FROM ${t}`).run() } catch {}
  }
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
  })

  describe('me', () => {
    it('devuelve el usuario por id', () => {
      const id = mockedDb.prepare(
        `INSERT INTO preceptores (nombre, apellido, dni_hash, dni_cif, telefono, username, password_hash)
         VALUES ('Ana', 'López', 'h2', 'e2', '1234-5678', 'u1', 'x')`
      ).run().lastInsertRowid

      const user = authService.me(id)
      expect(user).toMatchObject({ username: 'u1', rol: 'preceptor' })
    })

    it('lanza HttpError 401 si el usuario no existe', () => {
      expect(() => authService.me(999)).toThrow(new HttpError(401, 'Usuario no encontrado'))
    })
  })

  describe('loginAlumno', () => {
    beforeEach(() => {
      const cursoId = seedCurso(mockedDb, { anio: 7, division: '1', especialidad: 'MMO' })
      mockedDb.prepare(
        `INSERT INTO alumnos (nombre, apellido, dni_hash, dni_cif, curso_id, comision)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run('Juan', 'Pérez', encrypt('40213456'), encrypt('40213456'), cursoId, 'A')
    })

    it('devuelve token y datos del alumno con DNI correcto', () => {
      const result = authService.loginAlumno({ nombre: 'Juan', apellido: 'Pérez', dni: '40213456' })
      expect(result.token).toBeTruthy()
      expect(result.alumno).toMatchObject({ nombre: 'Juan', apellido: 'Pérez' })
      expect(result.alumno.id).toBeTruthy()
    })

    it('lanza HttpError 401 con datos incorrectos', () => {
      expect(() => authService.loginAlumno({ nombre: 'Juan', apellido: 'Pérez', dni: '9999' }))
        .toThrow(new HttpError(401, 'Datos incorrectos. Verificá tu nombre, apellido y DNI.'))
    })
  })
})
