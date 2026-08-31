import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setupTestDb, resetDb, seedCurso, seedAlumno } from '../helpers/inMemoryDb.js'

const mockedDb = setupTestDb()

import { qrService } from '../../src/services/qrService.js'
import { HttpError } from '../../src/utils/http-error.js'

let cursoId, alumnoIds

beforeEach(() => {
  resetDb(mockedDb)
  cursoId = seedCurso(mockedDb, { anio: 7, division: '1', especialidad: 'MMO' })

  alumnoIds = []
  for (let i = 1; i <= 2; i++) {
    const id = seedAlumno(mockedDb, {
      nombre: `Nombre${i}`,
      apellido: `Apellido${i}`,
      dni: String(11111110 + i),
      cursoId,
      comision: 'A',
    })
    alumnoIds.push(id)
  }
})

describe('qrService', () => {
  describe('generarTokens', () => {
    it('genera tokens para alumnos existentes', () => {
      const tokens = qrService.generarTokens([alumnoIds[0], alumnoIds[1]])
      expect(tokens).toHaveLength(2)
      expect(tokens[0].token).toBeTruthy()
    })

    it('acepta un solo id', () => {
      const tokens = qrService.generarTokens(alumnoIds[0])
      expect(tokens).toHaveLength(1)
      expect(tokens[0].token).toBeTruthy()
    })

    it('omite ids inexistentes', () => {
      const tokens = qrService.generarTokens([alumnoIds[0], 999])
      expect(tokens).toHaveLength(1)
    })
  })

  describe('escanear', () => {
    it('valida el token y devuelve el alumno', () => {
      const { token } = qrService.generarTokens(alumnoIds[0])[0]
      const result = qrService.escanear({ token, fecha: undefined })
      expect(result.alumno.alumno_id).toBe(alumnoIds[0])
      expect(result.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('usa la fecha provista', () => {
      const { token } = qrService.generarTokens(alumnoIds[0])[0]
      const result = qrService.escanear({ token, fecha: '2024-09-02' })
      expect(result.fecha).toBe('2024-09-02')
    })

    it('lanza HttpError 400 con token inválido', () => {
      expect(() => qrService.escanear({ token: 'malo', fecha: undefined }))
        .toThrow(new HttpError(400, 'QR inválido'))
    })

    it('lanza HttpError 404 si el alumno no existe', () => {
      const { token } = qrService.generarTokens(alumnoIds[0])[0]
      mockedDb.prepare('DELETE FROM alumnos WHERE alumno_id = ?').run(alumnoIds[0])
      expect(() => qrService.escanear({ token, fecha: undefined }))
        .toThrow(new HttpError(404, 'Alumno no encontrado'))
    })
  })

  describe('tokensPorCurso', () => {
    it('genera tokens para todos los alumnos del curso', () => {
      const tokens = qrService.tokensPorCurso(cursoId)
      expect(tokens.map((t) => t.id).sort()).toEqual([...alumnoIds].sort())
      expect(tokens[0].token).toBeTruthy()
    })
  })
})
