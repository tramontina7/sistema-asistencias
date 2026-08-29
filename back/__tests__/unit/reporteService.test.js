import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DDL, seedCurso, seedMateria, seedAlumno } from '../helpers/inMemoryDb.js'

vi.mock('../../src/db/index.js', async () => {
  const Database = (await import('better-sqlite3')).default
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(DDL)
  return { default: db }
})

const mockedDb = (await import('../../src/db/index.js')).default

import { reporteService, buildDateRange } from '../../src/services/reporteService.js'

const RESET = [
  'previas', 'asistencias', 'horarios', 'materias',
  'alumnos_tutores', 'alumnos', 'preceptores_cursos', 'preceptores',
  'docentes', 'cursos', 'tutores',
]

let cursoId, alumnoIds

beforeEach(() => {
  for (const t of RESET) {
    try { mockedDb.prepare(`DELETE FROM ${t}`).run() } catch {}
  }
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

    it('calcula el cuatrimestre', () => {
      expect(buildDateRange('cuatrimestre', '2024-09-15'))
        .toEqual({ desde: '2024-09-01', hasta: '2024-12-30' })
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

  describe('faltasPorMateria', () => {
    it('cuenta ausencias por materia según el horario', () => {
      const materiaId = seedMateria(mockedDb, { cursoId, nombreMateria: 'Matemática' })

      mockedDb.prepare(
        `INSERT INTO horarios (materia_id, dia_semana, hora_entrada, hora_salida)
         VALUES (?, 'Lunes', '08:00', '09:00')`
      ).run(materiaId)

      mockedDb.prepare(
        `INSERT INTO asistencias (alumno_id, materia_id, fecha, estado)
         VALUES (?, ?, '2024-09-03', 'Ausente')`
      ).run(alumnoIds[0], materiaId)

      const report = reporteService.faltasPorMateria({ cursoId, desde: '2024-09-02', hasta: '2024-09-06' })
      const fila = report.find((r) => r.alumno_id === alumnoIds[0] && r.materia_id === materiaId)
      expect(fila.ausencias).toBe(1)
      expect(fila.sesiones).toBe(1)
    })

    it('no cuenta ausencia si el día no pertenece al horario', () => {
      const materiaId = seedMateria(mockedDb, { cursoId, nombreMateria: 'Matemática' })

      mockedDb.prepare(
        `INSERT INTO horarios (materia_id, dia_semana, hora_entrada, hora_salida)
         VALUES (?, 'Miércoles', '08:00', '09:00')`
      ).run(materiaId)

      mockedDb.prepare(
        `INSERT INTO asistencias (alumno_id, materia_id, fecha, estado)
         VALUES (?, ?, '2024-09-03', 'Ausente')`
      ).run(alumnoIds[0], materiaId)

      const report = reporteService.faltasPorMateria({ cursoId, desde: '2024-09-02', hasta: '2024-09-06' })
      const fila = report.find((r) => r.alumno_id === alumnoIds[0] && r.materia_id === materiaId)
      expect(fila.ausencias).toBe(0)
    })
  })
})
