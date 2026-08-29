import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DDL, seedCurso, seedMateria, seedAlumno, seedDocente } from '../helpers/inMemoryDb.js'

vi.mock('../../src/db/index.js', async () => {
  const Database = (await import('better-sqlite3')).default
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(DDL)
  return { default: db }
})

const mockedDb = (await import('../../src/db/index.js')).default

import { previaService } from '../../src/services/previaService.js'
import { HttpError } from '../../src/utils/http-error.js'

const RESET = [
  'previas', 'asistencias', 'horarios', 'materias',
  'alumnos_tutores', 'alumnos', 'preceptores_cursos', 'preceptores',
  'docentes', 'cursos', 'tutores',
]

let cursoId, materiaId, alumnoId, docenteId

beforeEach(() => {
  for (const t of RESET) {
    try { mockedDb.prepare(`DELETE FROM ${t}`).run() } catch {}
  }
  cursoId = seedCurso(mockedDb, { anio: 7, division: '1', especialidad: 'MMO' })
  materiaId = seedMateria(mockedDb, { cursoId, nombreMateria: 'Matemática' })
  alumnoId = seedAlumno(mockedDb, { nombre: 'Ana', apellido: 'López', dni: '40213456', cursoId, comision: 'A' })
  docenteId = seedDocente(mockedDb, { nombre: 'Roberto', apellido: 'Fernández' })
})

describe('previaService', () => {
  describe('create', () => {
    it('crea una previa y devuelve sus datos', () => {
      const p = previaService.create({ alumnoId, materiaId, anioCursada: 2023, estado: 'Pendiente' })
      expect(p.previa_id).toBeTruthy()
      expect(p.alumno_id).toBe(alumnoId)
      expect(p.materia_id).toBe(materiaId)
      expect(p.estado).toBe('Pendiente')
      expect(p.nombre_materia).toBe('Matemática')
    })

    it('lanza 400 si falta alumno_id o materia_id', () => {
      expect(() => previaService.create({ materiaId, anioCursada: 2023, estado: 'Pendiente' }))
        .toThrow(new HttpError(400, 'alumno_id y materia_id requeridos'))
    })

    it('lanza 400 si el estado es inválido', () => {
      expect(() => previaService.create({ alumnoId, materiaId, anioCursada: 2023, estado: 'Rechazada' }))
        .toThrow(/Estado inválido/)
    })

    it('lanza 404 si el alumno no existe', () => {
      expect(() => previaService.create({ alumnoId: 999, materiaId, anioCursada: 2023, estado: 'Pendiente' }))
        .toThrow(new HttpError(404, 'Alumno no encontrado'))
    })

    it('lanza 404 si la materia no existe', () => {
      expect(() => previaService.create({ alumnoId, materiaId: 999, anioCursada: 2023, estado: 'Pendiente' }))
        .toThrow(new HttpError(404, 'Materia no encontrada'))
    })

    it('acepta docente_id opcional', () => {
      const p = previaService.create({ alumnoId, materiaId, docenteId, anioCursada: 2023, estado: 'Pendiente' })
      expect(p.docente_id).toBe(docenteId)
    })
  })

  describe('listPorCurso / listPorAlumno', () => {
    it('lista las previas por curso', () => {
      previaService.create({ alumnoId, materiaId, anioCursada: 2023, estado: 'Pendiente' })
      const list = previaService.listPorCurso({ cursoId })
      expect(list).toHaveLength(1)
      expect(list[0].nombre_materia).toBe('Matemática')
    })

    it('lista las previas por alumno', () => {
      previaService.create({ alumnoId, materiaId, anioCursada: 2023, estado: 'Pendiente' })
      const list = previaService.listPorAlumno({ alumnoId })
      expect(list).toHaveLength(1)
      expect(list[0].nombre_materia).toBe('Matemática')
    })
  })

  describe('update', () => {
    it('actualiza el estado y nota', () => {
      const p = previaService.create({ alumnoId, materiaId, anioCursada: 2023, estado: 'Pendiente' })
      const updated = previaService.update(p.previa_id, { estado: 'Aprobada', nota: 8 })
      expect(updated.estado).toBe('Aprobada')
      expect(updated.nota).toBe(8)
    })

    it('lanza 404 si la previa no existe', () => {
      expect(() => previaService.update(999, { estado: 'Aprobada' }))
        .toThrow(new HttpError(404, 'Previa no encontrada'))
    })

    it('lanza 400 sin campos', () => {
      const p = previaService.create({ alumnoId, materiaId, anioCursada: 2023, estado: 'Pendiente' })
      expect(() => previaService.update(p.previa_id, {}))
        .toThrow(new HttpError(400, 'Sin campos para actualizar'))
    })
  })

  describe('remove', () => {
    it('elimina la previa', () => {
      const p = previaService.create({ alumnoId, materiaId, anioCursada: 2023, estado: 'Pendiente' })
      previaService.remove(p.previa_id)
      expect(previaService.listPorAlumno({ alumnoId })).toHaveLength(0)
    })
  })
})
