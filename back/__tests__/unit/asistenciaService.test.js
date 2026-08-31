import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setupTestDb, resetDb, seedCurso, seedMateria, seedAlumno, seedHorario } from '../helpers/inMemoryDb.js'

const mockedDb = setupTestDb()

import { asistenciaService } from '../../src/services/asistenciaService.js'
import { HttpError } from '../../src/utils/http-error.js'

const FECHA = '2024-09-02'

let cursoId, materiaId, alumnoIds

beforeEach(() => {
  resetDb(mockedDb)
  cursoId = seedCurso(mockedDb, { anio: 7, division: '1', especialidad: 'MMO' })
  materiaId = seedMateria(mockedDb, { cursoId, nombreMateria: 'Matemática' })

  alumnoIds = []
  for (let i = 1; i <= 3; i++) {
    const id = seedAlumno(mockedDb, {
      nombre: 'Alumno',
      apellido: `A${i}`,
      dni: String(50000000 + i),
      cursoId,
      comision: 'A',
    })
    alumnoIds.push(id)
  }
})

describe('asistenciaService', () => {
  describe('tomar', () => {
    it('registra asistencias cuando están todos marcados', () => {
      asistenciaService.tomar({
        materiaId,
        fecha: FECHA,
        asistencias: [
          { alumno_id: alumnoIds[0], estado: 'Presente' },
          { alumno_id: alumnoIds[1], estado: 'Ausente' },
          { alumno_id: alumnoIds[2], estado: 'Presente' },
        ],
      })
      const rows = mockedDb.prepare('SELECT alumno_id, estado FROM asistencias ORDER BY alumno_id').all()
      expect(rows).toHaveLength(3)
      expect(rows).toEqual([
        { alumno_id: alumnoIds[0], estado: 'Presente' },
        { alumno_id: alumnoIds[1], estado: 'Ausente' },
        { alumno_id: alumnoIds[2], estado: 'Presente' },
      ])
    })

    it('lanza error con estado no permitido', () => {
      expect(() =>
        asistenciaService.tomar({
          materiaId,
          fecha: FECHA,
          asistencias: [{ alumno_id: alumnoIds[0], estado: 'justificado' }],
        })
      ).toThrow(/Estado no permitido/)
    })

    it('acepta estado Tarde para modificar un ausente después de guardar', () => {
      asistenciaService.tomar({
        materiaId,
        fecha: FECHA,
        asistencias: [
          { alumno_id: alumnoIds[0], estado: 'Presente' },
          { alumno_id: alumnoIds[1], estado: 'Ausente' },
        ],
      })

      asistenciaService.tomar({
        materiaId,
        fecha: FECHA,
        asistencias: [{ alumno_id: alumnoIds[1], estado: 'Tarde' }],
      })

      const row = mockedDb.prepare('SELECT estado FROM asistencias WHERE alumno_id = ?').get(alumnoIds[1])
      expect(row.estado).toBe('Tarde')
    })

    it('registra hora_ingreso al marcar Tarde y la conserva al sobrescribir', () => {
      asistenciaService.tomar({
        materiaId,
        fecha: FECHA,
        asistencias: [{ alumno_id: alumnoIds[0], estado: 'Tarde' }],
      })

      const row = mockedDb.prepare('SELECT hora_ingreso FROM asistencias WHERE alumno_id = ?').get(alumnoIds[0])
      expect(row.hora_ingreso).toMatch(/^\d{2}:\d{2}:\d{2}$/)

      // Re-marcar a Presente conserva la hora (se pierde referencia de llegada).
      asistenciaService.tomar({
        materiaId,
        fecha: FECHA,
        asistencias: [{ alumno_id: alumnoIds[0], estado: 'Presente' }],
      })
      const row2 = mockedDb.prepare('SELECT hora_ingreso FROM asistencias WHERE alumno_id = ?').get(alumnoIds[0])
      expect(row2.hora_ingreso).not.toBeNull()
    })

    it('guarda el motivo opcional de la tarde y lo conserva al cambiar de estado', () => {
      asistenciaService.tomar({
        materiaId,
        fecha: FECHA,
        asistencias: [{ alumno_id: alumnoIds[0], estado: 'Tarde', motivo: 'colectivo' }],
      })

      const row = mockedDb.prepare('SELECT * FROM asistencias WHERE alumno_id = ?').get(alumnoIds[0])
      expect(row.estado).toBe('Tarde')
      expect(row.hora_ingreso).toMatch(/^\d{2}:\d{2}:\d{2}$/)
      expect(row.motivo_tarde).toBe('colectivo')

      // Al pasar a Presente se conservan hora_ingreso y motivo_tarde.
      asistenciaService.tomar({
        materiaId,
        fecha: FECHA,
        asistencias: [{ alumno_id: alumnoIds[0], estado: 'Presente' }],
      })
      const row2 = mockedDb.prepare('SELECT * FROM asistencias WHERE alumno_id = ?').get(alumnoIds[0])
      expect(row2.estado).toBe('Presente')
      expect(row2.motivo_tarde).toBe('colectivo')
    })

    it('hace upsert al repetir la fecha/alumno/materia', () => {
      asistenciaService.tomar({
        materiaId,
        fecha: FECHA,
        asistencias: [
          { alumno_id: alumnoIds[0], estado: 'Presente' },
          { alumno_id: alumnoIds[1], estado: 'Ausente' },
          { alumno_id: alumnoIds[2], estado: 'Presente' },
        ],
      })
      asistenciaService.tomar({
        materiaId,
        fecha: FECHA,
        asistencias: [
          { alumno_id: alumnoIds[0], estado: 'Ausente' },
          { alumno_id: alumnoIds[1], estado: 'Presente' },
          { alumno_id: alumnoIds[2], estado: 'Ausente' },
        ],
      })

      const rows = mockedDb.prepare('SELECT alumno_id, estado FROM asistencias ORDER BY alumno_id').all()
      expect(rows).toHaveLength(3)
      expect(rows[0]).toMatchObject({ alumno_id: alumnoIds[0], estado: 'Ausente' })
    })
  })

  describe('list', () => {
    it('list devuelve las asistencias de la materia y fecha', () => {
      asistenciaService.tomar({
        materiaId,
        fecha: FECHA,
        asistencias: [
          { alumno_id: alumnoIds[0], estado: 'Presente' },
          { alumno_id: alumnoIds[1], estado: 'Ausente' },
          { alumno_id: alumnoIds[2], estado: 'Presente' },
        ],
      })
      const rows = asistenciaService.list({ materiaId, fecha: FECHA })
      expect(rows).toHaveLength(3)
      expect(rows[0].nombre).toBe('Alumno')
    })
  })

  describe('updateEstado', () => {
    it('actualiza el estado', () => {
      asistenciaService.tomar({
        materiaId,
        fecha: FECHA,
        asistencias: [
          { alumno_id: alumnoIds[0], estado: 'Presente' },
          { alumno_id: alumnoIds[1], estado: 'Presente' },
          { alumno_id: alumnoIds[2], estado: 'Presente' },
        ],
      })
      const row = mockedDb.prepare('SELECT asistencia_id FROM asistencias WHERE alumno_id = ?').get(alumnoIds[0])
      asistenciaService.updateEstado(row.asistencia_id, { estado: 'Justificado', motivo: 'certificado' })

      const updated = mockedDb.prepare('SELECT * FROM asistencias WHERE asistencia_id = ?').get(row.asistencia_id)
      expect(updated.estado).toBe('Justificado')
      expect(updated.motivo).toBe('certificado')
    })

    it('no guarda motivo cuando el estado no es Justificado', () => {
      asistenciaService.tomar({
        materiaId,
        fecha: FECHA,
        asistencias: [
          { alumno_id: alumnoIds[0], estado: 'Presente' },
          { alumno_id: alumnoIds[1], estado: 'Presente' },
          { alumno_id: alumnoIds[2], estado: 'Presente' },
        ],
      })
      const row = mockedDb.prepare('SELECT asistencia_id FROM asistencias WHERE alumno_id = ?').get(alumnoIds[0])
      asistenciaService.updateEstado(row.asistencia_id, { estado: 'Ausente', motivo: 'no importa' })

      const updated = mockedDb.prepare('SELECT * FROM asistencias WHERE asistencia_id = ?').get(row.asistencia_id)
      expect(updated.estado).toBe('Ausente')
      expect(updated.motivo).toBeNull()
    })

    it('registra hora_ingreso al pasar a Tarde', () => {
      asistenciaService.tomar({
        materiaId,
        fecha: FECHA,
        asistencias: [
          { alumno_id: alumnoIds[0], estado: 'Presente' },
          { alumno_id: alumnoIds[1], estado: 'Presente' },
          { alumno_id: alumnoIds[2], estado: 'Presente' },
        ],
      })
      const row = mockedDb.prepare('SELECT asistencia_id FROM asistencias WHERE alumno_id = ?').get(alumnoIds[0])
      asistenciaService.updateEstado(row.asistencia_id, { estado: 'Tarde' })

      const updated = mockedDb.prepare('SELECT * FROM asistencias WHERE asistencia_id = ?').get(row.asistencia_id)
      expect(updated.estado).toBe('Tarde')
      expect(updated.hora_ingreso).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    })

    it('guarda el motivo opcional de la tarde en updateEstado y lo conserva', () => {
      asistenciaService.tomar({
        materiaId,
        fecha: FECHA,
        asistencias: [
          { alumno_id: alumnoIds[0], estado: 'Presente' },
          { alumno_id: alumnoIds[1], estado: 'Presente' },
          { alumno_id: alumnoIds[2], estado: 'Presente' },
        ],
      })
      const row = mockedDb.prepare('SELECT asistencia_id FROM asistencias WHERE alumno_id = ?').get(alumnoIds[0])
      asistenciaService.updateEstado(row.asistencia_id, { estado: 'Tarde', motivoTarde: 'problema familiar' })

      const updated = mockedDb.prepare('SELECT * FROM asistencias WHERE asistencia_id = ?').get(row.asistencia_id)
      expect(updated.estado).toBe('Tarde')
      expect(updated.hora_ingreso).toMatch(/^\d{2}:\d{2}:\d{2}$/)
      expect(updated.motivo_tarde).toBe('problema familiar')
    })
  })

  describe('materiaDelMomento', () => {
    it('detecta la materia en la franja horaria actual', () => {
      seedHorario(mockedDb, { materiaId, dia: 'Miércoles', entrada: '08:00', salida: '09:00' })
      const res = asistenciaService.materiaDelMomento({
        cursoId,
        ahora: new Date('2024-09-04T08:30:00'),
      })
      expect(res).toEqual({ materia_id: materiaId, nombre_materia: 'Matemática' })
    })

    it('toma la primera materia del día fuera de la franja', () => {
      seedHorario(mockedDb, { materiaId, dia: 'Miércoles', entrada: '10:00', salida: '11:00' })
      const res = asistenciaService.materiaDelMomento({
        cursoId,
        ahora: new Date('2024-09-04T08:30:00'),
      })
      expect(res.materia_id).toBe(materiaId)
    })

    it('usa la primera materia del curso si ese día no hay horarios (fallback)', () => {
      const res = asistenciaService.materiaDelMomento({
        cursoId,
        ahora: new Date('2024-09-05T10:00:00'),
      })
      expect(res).toEqual({ materia_id: materiaId, nombre_materia: 'Matemática' })
    })

    it('lanza 400 si el curso no tiene materias', () => {
      mockedDb.prepare('DELETE FROM materias').run()
      expect(() => asistenciaService.materiaDelMomento({
        cursoId,
        ahora: new Date('2024-09-05T10:00:00'),
      })).toThrow(/no cursa ninguna materia/)
    })
  })

  describe('registrarQr', () => {
    it('marca SIEMPRE Tarde y guarda el motivo con hora', () => {
      const resultado = asistenciaService.registrarQr({
        alumnoId: alumnoIds[0],
        materiaId,
        fecha: FECHA,
        ahora: new Date('2024-09-02T07:55:00'),
      })
      const row = mockedDb.prepare('SELECT * FROM asistencias WHERE alumno_id = ?').get(alumnoIds[0])
      expect(resultado.estado).toBe('Tarde')
      expect(resultado.hora).toBe('07:55:00')
      expect(row.estado).toBe('Tarde')
      expect(row.motivo).toContain('QR escaneado')
      expect(row.hora_ingreso).toBe('07:55:00')
    })

    it('lanza 404 si el alumno no existe', () => {
      expect(() => asistenciaService.registrarQr({
        alumnoId: 999,
        materiaId,
        fecha: FECHA,
      })).toThrow(new HttpError(404, 'Alumno no encontrado'))
    })

    it('lanza 404 si la materia no existe', () => {
      expect(() => asistenciaService.registrarQr({
        alumnoId: alumnoIds[0],
        materiaId: 999,
        fecha: FECHA,
      })).toThrow(new HttpError(404, 'Materia no encontrada'))
    })
  })
})
