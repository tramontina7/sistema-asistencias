import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DDL, seedCurso } from '../helpers/inMemoryDb.js'

vi.mock('../../src/db/index.js', async () => {
  const Database = (await import('better-sqlite3')).default
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(DDL)
  return { default: db }
})

const mockedDb = (await import('../../src/db/index.js')).default

import { alumnoService } from '../../src/services/alumnoService.js'
import { HttpError } from '../../src/utils/http-error.js'
import { decrypt } from '../../src/utils/crypto.js'

const RESET = [
  'previas', 'asistencias', 'horarios', 'materias',
  'alumnos_tutores', 'alumnos', 'preceptores_cursos', 'preceptores',
  'docentes', 'cursos', 'tutores',
]

let cursoId

beforeEach(() => {
  for (const t of RESET) {
    try { mockedDb.prepare(`DELETE FROM ${t}`).run() } catch {}
  }
  cursoId = seedCurso(mockedDb, { anio: 7, division: '1', especialidad: 'MMO' })
})

describe('alumnoService', () => {
  describe('create', () => {
    it('cifra el DNI', () => {
      const created = alumnoService.create({ nombre: 'Ana', apellido: 'López', dni: '40213456', cursoId, comision: 'A' })
      expect(created.alumno_id).toBeTruthy()
      expect(created.dni).toBe('40213456')

      const row = mockedDb.prepare('SELECT * FROM alumnos WHERE alumno_id = ?').get(created.alumno_id)
      expect(decrypt(row.dni_cif)).toBe('40213456')
    })

    it('lanza HttpError 409 si el DNI ya existe', () => {
      alumnoService.create({ nombre: 'Ana', apellido: 'López', dni: '40213456', cursoId, comision: 'A' })
      expect(() => alumnoService.create({ nombre: 'Otra', apellido: 'Persona', dni: '40213456', cursoId, comision: 'A' }))
        .toThrow(new HttpError(409, 'Ya existe un alumno con ese DNI'))
    })
  })

  describe('getById / list', () => {
    it('getById descifra el DNI', () => {
      const created = alumnoService.create({ nombre: 'Ana', apellido: 'López', dni: '40213456', cursoId, comision: 'A' })
      const found = alumnoService.getById(created.alumno_id)
      expect(found.dni).toBe('40213456')
      expect(found.dni_cif).toBeUndefined()
    })

    it('getById lanza HttpError 404 si no existe', () => {
      expect(() => alumnoService.getById(999)).toThrow(new HttpError(404, 'Alumno no encontrado'))
    })

    it('list filtra por curso y texto', () => {
      alumnoService.create({ nombre: 'Ana', apellido: 'López', dni: '1', cursoId, comision: 'A' })
      alumnoService.create({ nombre: 'Bruno', apellido: 'Díaz', dni: '2', cursoId, comision: 'A' })

      const rows = alumnoService.list({ cursoId, q: 'bruno' })
      expect(rows).toHaveLength(1)
      expect(rows[0].nombre).toBe('Bruno')
    })

    it('list filtra por comision', () => {
      alumnoService.create({ nombre: 'Ana', apellido: 'López', dni: '100', cursoId, comision: 'A' })
      alumnoService.create({ nombre: 'Bruno', apellido: 'Díaz', dni: '200', cursoId, comision: 'B' })

      const rows = alumnoService.list({ cursoId, comision: 'A' })
      expect(rows).toHaveLength(1)
      expect(rows[0].comision).toBe('A')
    })
  })

  describe('update', () => {
    it('actualiza solo los campos provistos y re-cifra el DNI', () => {
      const created = alumnoService.create({ nombre: 'Ana', apellido: 'López', dni: '40213456', cursoId, comision: 'A' })
      alumnoService.update(created.alumno_id, { nombre: 'Ana María', dni: '12345678' })

      const row = mockedDb.prepare('SELECT * FROM alumnos WHERE alumno_id = ?').get(created.alumno_id)
      expect(row.nombre).toBe('Ana María')
      expect(row.apellido).toBe('López')
      expect(decrypt(row.dni_cif)).toBe('12345678')
    })

    it('lanza HttpError 404 si el alumno no existe', () => {
      expect(() => alumnoService.update(999, { nombre: 'X' }))
        .toThrow(new HttpError(404, 'Alumno no encontrado'))
    })

    it('lanza HttpError 400 si no hay campos para actualizar', () => {
      const created = alumnoService.create({ nombre: 'Ana', apellido: 'López', dni: '40213456', cursoId, comision: 'A' })
      expect(() => alumnoService.update(created.alumno_id, {}))
        .toThrow(new HttpError(400, 'Sin campos para actualizar'))
    })
  })

  describe('remove', () => {
    it('elimina el alumno', () => {
      const created = alumnoService.create({ nombre: 'Ana', apellido: 'López', dni: '40213456', cursoId, comision: 'A' })
      expect(() => alumnoService.remove(created.alumno_id)).not.toThrow()
      expect(mockedDb.prepare('SELECT COUNT(*) c FROM alumnos').get().c).toBe(0)
    })
  })
})
