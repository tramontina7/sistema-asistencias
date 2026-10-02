import { describe, it, expect } from 'vitest'
import { setupTestDb, resetDb, ensureSchema } from '../helpers/inMemoryDb.js'

describe('inMemoryDb: aislamiento y garantias', () => {
  const db = setupTestDb()

  it('devuelve la misma instancia en cada llamada (el mock es unico)', () => {
    expect(setupTestDb()).toBe(db)
  })

  it('tiene el esquema de la app, con FKs activas', () => {
    ensureSchema()
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
    const tablas = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map(r => r.name)
    expect(tablas.sort()).toEqual([
      'alumnos', 'asistencias', 'cursos', 'horarios',
      'materia_comisiones', 'materias', 'preceptores',
    ])
  })

  it('las FKs de verdad rechazan un alumno con curso inexistente', () => {
    ensureSchema()
    expect(() =>
      db.prepare(
        'INSERT INTO alumnos (nombre, apellido, dni_hash, dni_cif, curso_id, comision) VALUES (?,?,?,?,?,?)'
      ).run('Sin', 'Curso', 'h1', 'c1', 999999, 'A')
    ).toThrow(/FOREIGN KEY/i)
  })

  it('resetDb vacia las filas sin romper el esquema', () => {
    ensureSchema()
    const curso = db
      .prepare('INSERT INTO cursos (anio, division, especialidad, turno) VALUES (1, ?, ?, ?)')
      .run('1', 'Tech', 'Mañana').lastInsertRowid
    db.prepare(
      'INSERT INTO alumnos (nombre, apellido, dni_hash, dni_cif, curso_id, comision) VALUES (?,?,?,?,?,?)'
    ).run('Con', 'Curso', 'h2', 'c2', curso, 'A')

    expect(db.prepare('SELECT COUNT(*) c FROM alumnos').get().c).toBeGreaterThan(0)

    resetDb(db)

    expect(db.prepare('SELECT COUNT(*) c FROM alumnos').get().c).toBe(0)
    expect(db.prepare('SELECT COUNT(*) c FROM cursos').get().c).toBe(0)
    // el esquema sigue en pie
    expect(() =>
      db.prepare('INSERT INTO cursos (anio, division, especialidad, turno) VALUES (1, ?, ?, ?)')
        .run('1', 'Tech2', 'Mañana')
    ).not.toThrow()
  })

  it('ensureSchema es idempotente y no destruye datos', () => {
    ensureSchema()
    const curso = db
      .prepare('INSERT INTO cursos (anio, division, especialidad, turno) VALUES (1, ?, ?, ?)')
      .run('1', 'Idem', 'Tarde').lastInsertRowid
    ensureSchema()
    ensureSchema()
    const row = db.prepare('SELECT * FROM cursos WHERE curso_id = ?').get(curso)
    expect(row).toBeTruthy()
  })
})
