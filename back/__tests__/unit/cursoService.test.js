import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DDL, seedCurso, seedPreceptor } from '../helpers/inMemoryDb.js'

vi.mock('../../src/db/index.js', async () => {
  const Database = (await import('better-sqlite3')).default
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(DDL)
  return { default: db }
})

const mockedDb = (await import('../../src/db/index.js')).default

import { cursoService, formatNombre } from '../../src/services/cursoService.js'

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

function insertCurso(anio, division, especialidad, turno = 'Mañana') {
  const result = mockedDb.prepare(
    'INSERT INTO cursos (anio, division, especialidad, turno) VALUES (?, ?, ?, ?)'
  ).run(anio, division, especialidad || '', turno)
  return result.lastInsertRowid
}

describe('formatNombre', () => {
  it('formato básico', () => {
    expect(formatNombre({ anio: 1, division: '1', especialidad: 'Ciclo Básico', turno: 'Mañana' }))
      .toBe('1ro 1ra')
  })

  it('sin especialidad', () => {
    expect(formatNombre({ anio: 4, division: '1', especialidad: '', turno: 'Tarde' }))
      .toBe('4to 1ra')
  })

  it('adapta el sufijo al número', () => {
    expect(formatNombre({ anio: 2, division: '2' })).toBe('2do 2da')
    expect(formatNombre({ anio: 7, division: '3' })).toBe('7mo 3ra')
  })

  it('divisiones altas del ciclo superior', () => {
    expect(formatNombre({ anio: 4, division: '9' })).toBe('4to 9na')
    expect(formatNombre({ anio: 6, division: '10' })).toBe('6to 10ma')
    expect(formatNombre({ anio: 5, division: '11' })).toBe('5to 11')
  })
})

describe('cursoService', () => {
  describe('list', () => {
    it('devuelve todos los cursos', () => {
      insertCurso(1, '1', 'Ciclo Básico')
      insertCurso(4, '1', 'Informática')

      const rows = cursoService.list()
      expect(rows).toHaveLength(2)
      expect(rows[0]).toMatchObject({ anio: 1, division: '1', turno: 'Mañana' })
    })

    it('preceptor ve todos los cursos', () => {
      insertCurso(1, '1', 'Ciclo Básico')
      insertCurso(2, '1', 'Ciclo Básico')
      seedPreceptor(mockedDb)

      const rows = cursoService.list()
      expect(rows).toHaveLength(2)
    })
  })

  describe('create', () => {
    it('crea un curso y devuelve sus datos', () => {
      const created = cursoService.create({ anio: 4, division: '1', especialidad: 'Informática', turno: 'Tarde' })
      expect(created).toMatchObject({ anio: 4, division: '1', especialidad: 'Informática', turno: 'Tarde' })
      expect(created.curso_id).toBeTruthy()
    })

    it('lanza error sin turno', () => {
      expect(() => cursoService.create({ anio: 4, division: '1', especialidad: 'X' })).toThrow()
    })

    it('lanza error con año inválido', () => {
      expect(() => cursoService.create({ anio: 8, division: '1', turno: 'Mañana' })).toThrow()
    })
  })

  describe('update', () => {
    it('actualiza el turno', () => {
      const id = insertCurso(2, '1', 'Ciclo Básico')
      const updated = cursoService.update(id, { turno: 'Tarde' })
      expect(updated.turno).toBe('Tarde')
      expect(updated.anio).toBe(2)
    })

    it('lanza error sin campos', () => {
      const id = insertCurso(1, '1', 'Ciclo Básico')
      expect(() => cursoService.update(id, {})).toThrow(/No hay campos/)
    })

    it('lanza error si el curso no existe', () => {
      expect(() => cursoService.update(999, { turno: 'Tarde' })).toThrow(/Curso no encontrado/)
    })
  })

  describe('remove', () => {
    it('elimina el curso', () => {
      const id = insertCurso(1, '1', 'Ciclo Básico')
      cursoService.remove(id)
      expect(mockedDb.prepare('SELECT COUNT(*) c FROM cursos').get().c).toBe(0)
    })
  })
})
