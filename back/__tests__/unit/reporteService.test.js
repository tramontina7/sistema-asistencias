import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setupTestDb, resetDb, seedCurso, seedMateria, seedAlumno } from '../helpers/inMemoryDb.js'

const mockedDb = setupTestDb()

import { reporteService, buildDateRange } from '../../src/services/reporteService.js'

let cursoId, alumnoIds

beforeEach(() => {
  resetDb(mockedDb)
  cursoId = seedCurso(mockedDb, { anio: 7, division: '1', especialidad: 'MMO' })

  alumnoIds = []
  for (let i = 1; i <= 2; i++) {
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

describe('reporteService', () => {
  describe('buildDateRange', () => {
    it('calcula rango de día', () => {
      expect(buildDateRange('dia', '2024-09-05')).toEqual({ desde: '2024-09-05', hasta: '2024-09-05' })
    })

    it('calcula la semana que contiene el jueves', () => {
      expect(buildDateRange('semana', '2024-09-05'))
        .toEqual({ desde: '2024-09-02', hasta: '2024-09-08' })
    })

    it('calcula el mes', () => {
      expect(buildDateRange('mes', '2024-09-15'))
        .toEqual({ desde: '2024-09-01', hasta: '2024-09-30' })
    })

    it('calcula el primer cuatrimestre (Mar-Jul, enero no es hábil)', () => {
      expect(buildDateRange('cuatrimestre', '2024-05-15', 1))
        .toEqual({ desde: '2024-03-01', hasta: '2024-07-30' })
    })

    it('calcula el segundo cuatrimestre (Ago-Nov)', () => {
      expect(buildDateRange('cuatrimestre', '2024-05-15', 2))
        .toEqual({ desde: '2024-08-01', hasta: '2024-11-30' })
    })

    it('asume el primer cuatrimestre si no se indica índice', () => {
      expect(buildDateRange('cuatrimestre', '2024-09-15'))
        .toEqual({ desde: '2024-03-01', hasta: '2024-07-30' })
    })

    it('usa el día por defecto para tipos no conocidos', () => {
      expect(buildDateRange('raro', '2024-09-05')).toEqual({ desde: '2024-09-05', hasta: '2024-09-05' })
    })
  })

  describe('generar', () => {
    it('devuelve detalle, resumen y días del rango', () => {
      const materiaId = seedMateria(mockedDb, { cursoId, nombreMateria: 'Lengua' })

      const upsert = mockedDb.prepare(
        `INSERT INTO asistencias (alumno_id, materia_id, fecha, estado) VALUES (?, ?, ?, ?)`
      )
      upsert.run(alumnoIds[0], materiaId, '2024-09-02', 'Presente')
      upsert.run(alumnoIds[0], materiaId, '2024-09-03', 'Ausente')
      upsert.run(alumnoIds[1], materiaId, '2024-09-02', 'Presente')

      const report = reporteService.generar({ cursoId, tipo: 'semana', fecha: '2024-09-03' })

      expect(report.desde).toBe('2024-09-02')
      expect(report.dias).toEqual(['2024-09-02', '2024-09-03'])
      expect(report.detalle).toHaveLength(3)
      expect(report.resumen).toHaveLength(2)

      const a1 = report.resumen.find((r) => r.alumno_id === alumnoIds[0])
      expect(a1.presentes).toBe(1)
      expect(a1.ausencias).toBe(1)
      expect(a1.total).toBe(2)
    })

    it('devuelve resumen en cero cuando no hay asistencias', () => {
      const report = reporteService.generar({ cursoId, tipo: 'dia', fecha: '2024-09-02' })
      expect(report.resumen).toHaveLength(2)
      expect(report.resumen[0].presentes).toBe(0)
      expect(report.resumen[0].total).toBe(0)
      expect(report.dias).toEqual([])
    })
  })

  describe('matrizPorMateria', () => {
    it('calcula el porcentaje de asistencia por alumno y materia sobre el historial', () => {
      const mateId = seedMateria(mockedDb, { cursoId, nombreMateria: 'Matemática' })
      const lenguaId = seedMateria(mockedDb, { cursoId, nombreMateria: 'Lengua' })

      const upsert = mockedDb.prepare(
        `INSERT INTO asistencias (alumno_id, materia_id, fecha, estado) VALUES (?, ?, ?, ?)`
      )
      upsert.run(alumnoIds[0], mateId, '2024-09-02', 'Presente')
      upsert.run(alumnoIds[0], mateId, '2024-09-03', 'Tarde')
      upsert.run(alumnoIds[0], mateId, '2024-09-04', 'Ausente')
      upsert.run(alumnoIds[0], lenguaId, '2024-09-02', 'Ausente')
      upsert.run(alumnoIds[1], mateId, '2024-09-02', 'Justificado')

      const report = reporteService.matrizPorMateria({ cursoId })

      expect(report.materias.map((m) => m.nombre_materia)).toEqual(['Lengua', 'Matemática'])
      expect(report.alumnos).toHaveLength(2)

      const mateRow = report.alumnos[0].celdas[mateId]
      const lenguaRow = report.alumnos[0].celdas[lenguaId]
      // Presente + Tarde = 2 de 3 en Matemática
      expect(mateRow).toEqual({ presentes: 2, total: 3, porcentaje: 67 })
      expect(lenguaRow).toEqual({ presentes: 0, total: 1, porcentaje: 0 })

      const mateRow2 = report.alumnos[1].celdas[mateId]
      expect(mateRow2).toEqual({ presentes: 0, total: 1, porcentaje: 0 })
    })

    it('omite la materia en las celdas si el alumno no tiene registros', () => {
      const mateId = seedMateria(mockedDb, { cursoId, nombreMateria: 'Matemática' })
      const report = reporteService.matrizPorMateria({ cursoId })

      expect(report.materias).toHaveLength(1)
      expect(report.alumnos[0].celdas[mateId]).toBeUndefined()
    })
  })
})
