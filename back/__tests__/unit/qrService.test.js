import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setupTestDb, resetDb, seedCurso, seedAlumno } from '../helpers/inMemoryDb.js'

const mockedDb = setupTestDb()

import { qrService } from '../../src/services/qrService.js'
import { HttpError } from '../../src/utils/http-error.js'

let cursoId, alumnoId

beforeEach(() => {
  resetDb(mockedDb)
  cursoId = seedCurso(mockedDb, { anio: 7, division: '1', especialidad: 'MMO' })
  alumnoId = seedAlumno(mockedDb, {
    nombre: 'Nombre1',
    apellido: 'Apellido1',
    dni: '11111111',
    cursoId,
    comision: 'A',
  })
})

describe('qrService', () => {
  describe('alumno', () => {
    it('genera un token y lo persiste como vigente', () => {
      const result = qrService.alumno(alumnoId)
      expect(result.token).toBeTruthy()
      expect(result.alumno.alumno_id).toBe(alumnoId)

      const row = mockedDb.prepare('SELECT qr_token_hash FROM alumnos WHERE alumno_id = ?').get(alumnoId)
      expect(row.qr_token_hash).toBeTruthy()
    })

    it('lanza HttpError 404 si el alumno no existe', () => {
      expect(() => qrService.alumno(999)).toThrow(new HttpError(404, 'Alumno no encontrado'))
    })
  })

  describe('escanear', () => {
    it('acepta el token vigente y devuelve el alumno', () => {
      const { token } = qrService.alumno(alumnoId)
      const result = qrService.escanear({ token, fecha: undefined })
      expect(result.alumno.alumno_id).toBe(alumnoId)
      expect(result.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('usa la fecha provista', () => {
      const { token } = qrService.alumno(alumnoId)
      const result = qrService.escanear({ token, fecha: '2024-09-02' })
      expect(result.fecha).toBe('2024-09-02')
    })

    it('rechaza un QR obsoleto tras una nueva rotación', () => {
      const primero = qrService.alumno(alumnoId)
      qrService.alumno(alumnoId)

      expect(() => qrService.escanear({ token: primero.token, fecha: undefined }))
        .toThrow(new HttpError(400, 'QR obsoleto. Pedile al alumno que actualice su código'))
    })

    it('acepta el nuevo token tras la rotación', () => {
      qrService.alumno(alumnoId)
      const { token } = qrService.alumno(alumnoId)
      expect(() => qrService.escanear({ token, fecha: undefined })).not.toThrow()
    })

    it('lanza HttpError 400 con token inválido', () => {
      expect(() => qrService.escanear({ token: 'malo', fecha: undefined }))
        .toThrow(new HttpError(400, 'QR inválido'))
    })

    it('lanza HttpError 404 si el alumno no existe', () => {
      const { token } = qrService.alumno(alumnoId)
      mockedDb.prepare('DELETE FROM alumnos WHERE alumno_id = ?').run(alumnoId)
      expect(() => qrService.escanear({ token, fecha: undefined }))
        .toThrow(new HttpError(404, 'Alumno no encontrado'))
    })
  })
})
