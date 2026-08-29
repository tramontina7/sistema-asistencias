import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DDL, seedCurso, seedAlumno, seedTutor, seedAlumnoTutor } from '../helpers/inMemoryDb.js'

vi.mock('../../src/db/index.js', async () => {
  const Database = (await import('better-sqlite3')).default
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(DDL)
  return { default: db }
})

const mockedDb = (await import('../../src/db/index.js')).default

import { tutorService } from '../../src/services/tutorService.js'
import { HttpError } from '../../src/utils/http-error.js'

const RESET = [
  'retiros', 'previas', 'asistencias', 'docente_suplencias', 'horarios', 'materias',
  'docente_materias', 'alumnos_tutores', 'alumnos', 'preceptores_cursos', 'preceptores',
  'docentes', 'cursos', 'tutores',
]

let cursoId

beforeEach(() => {
  for (const t of RESET) {
    try { mockedDb.prepare(`DELETE FROM ${t}`).run() } catch {}
  }
  cursoId = seedCurso(mockedDb, { anio: 1, division: '1' })
})

describe('tutorService.validarTutorPorAlumno', () => {
  it('devuelve el tutor_id si coincide nombre, apellido y dni y es tutor del alumno', () => {
    const alumno = seedAlumno(mockedDb, { cursoId })
    const tutor = seedTutor(mockedDb, { nombre: 'Pedro', apellido: 'Pérez', dni: '30000000' })
    seedAlumnoTutor(mockedDb, { alumnoId: alumno, tutorId: tutor })

    const res = tutorService.validarTutorPorAlumno({
      alumnoId: alumno, nombre: 'Pedro', apellido: 'Pérez', dni: '30000000',
    })
    expect(res).toEqual({ tutor_id: tutor })
  })

  it('ignora acentos y mayúsculas del nombre', () => {
    const alumno = seedAlumno(mockedDb, { cursoId })
    const tutor = seedTutor(mockedDb, { nombre: 'Pedro', apellido: 'Pérez', dni: '30000000' })
    seedAlumnoTutor(mockedDb, { alumnoId: alumno, tutorId: tutor })

    const res = tutorService.validarTutorPorAlumno({
      alumnoId: alumno, nombre: 'PEDRO', apellido: 'Perez', dni: '30000000',
    })
    expect(res).toEqual({ tutor_id: tutor })
  })

  it('lanza 404 si el DNI no coincide', () => {
    const alumno = seedAlumno(mockedDb, { cursoId })
    const tutor = seedTutor(mockedDb, { nombre: 'Pedro', apellido: 'Pérez', dni: '30000000' })
    seedAlumnoTutor(mockedDb, { alumnoId: alumno, tutorId: tutor })

    expect(() => tutorService.validarTutorPorAlumno({
      alumnoId: alumno, nombre: 'Pedro', apellido: 'Pérez', dni: '99999999',
    })).toThrow(new HttpError(404, 'Persona no Autorizada'))
  })

  it('lanza 404 si el tutor no está vinculado a ese alumno', () => {
    const alumno = seedAlumno(mockedDb, { dni: '1', cursoId })
    const otroAlumno = seedAlumno(mockedDb, { dni: '2', cursoId })
    const tutor = seedTutor(mockedDb, { nombre: 'Pedro', apellido: 'Pérez', dni: '30000000' })
    seedAlumnoTutor(mockedDb, { alumnoId: otroAlumno, tutorId: tutor })

    expect(() => tutorService.validarTutorPorAlumno({
      alumnoId: alumno, nombre: 'Pedro', apellido: 'Pérez', dni: '30000000',
    })).toThrow(new HttpError(404, 'Persona no Autorizada'))
  })

  it('lanza 400 si faltan campos', () => {
    expect(() => tutorService.validarTutorPorAlumno({ alumnoId: 1, nombre: '', apellido: '', dni: '' }))
      .toThrow(/Debe completar Nombre, Apellido y DNI/)
  })
})

describe('tutorService CRUD', () => {
  it('crea un tutor con vínculos a alumnos', () => {
    const a1 = seedAlumno(mockedDb, { dni: '1', cursoId })
    const a2 = seedAlumno(mockedDb, { dni: '2', cursoId })
    const creado = tutorService.create({
      nombre: 'Ana', apellido: 'López', dni: '55555555', telefono: '1234',
      vinculos: [
        { alumno_id: a1, parentesco: 'Madre', es_principal: 1 },
        { alumno_id: a2, parentesco: 'Tutora', es_principal: 0 },
      ],
    })
    expect(creado.tutor_id).toBeTruthy()
    expect(creado.dni).toBe('55555555')
    expect(creado.vinculos).toHaveLength(2)
    expect(creado.vinculos[0].parentesco).toBe('Madre')
    expect(mockedDb.prepare('SELECT COUNT(*) c FROM alumnos_tutores WHERE tutor_id = ?').get(creado.tutor_id).c).toBe(2)
  })

  it('lanza 409 si el DNI ya existe', () => {
    seedTutor(mockedDb, { nombre: 'Pedro', apellido: 'Pérez', dni: '30000000' })
    expect(() => tutorService.create({ nombre: 'Otro', apellido: 'Perez', dni: '30000000' }))
      .toThrow(new HttpError(409, 'Ya existe un tutor con ese DNI'))
  })

  it('lanza 400 si falta un campo requerido', () => {
    expect(() => tutorService.create({ nombre: 'Ana', apellido: '', dni: '555' }))
      .toThrow(/nombre, apellido y dni son requeridos/)
  })

  it('lanza 400 si el alumno del vínculo no existe', () => {
    expect(() => tutorService.create({
      nombre: 'Ana', apellido: 'López', dni: '55555555', vinculos: [{ alumno_id: 999, parentesco: 'Madre' }],
    })).toThrow(/no existe/)
  })

  it('list devuelve los tutores con sus vínculos y DNI descifrado', () => {
    const tutor = seedTutor(mockedDb, { nombre: 'Pedro', apellido: 'Pérez', dni: '30000000' })
    const a1 = seedAlumno(mockedDb, { dni: '1', cursoId })
    seedAlumnoTutor(mockedDb, { alumnoId: a1, tutorId: tutor, parentesco: 'Padre' })
    const list = tutorService.list()
    expect(list).toHaveLength(1)
    expect(list[0].dni).toBe('30000000')
    expect(list[0].vinculos[0].parentesco).toBe('Padre')
  })

  it('getById lanza 404 si no existe', () => {
    expect(() => tutorService.getById(999)).toThrow(new HttpError(404, 'Tutor no encontrado'))
  })

  it('update reemplaza los vínculos', () => {
    const tutor = seedTutor(mockedDb, { nombre: 'Pedro', apellido: 'Pérez', dni: '30000000' })
    const a1 = seedAlumno(mockedDb, { dni: '1', cursoId })
    seedAlumnoTutor(mockedDb, { alumnoId: a1, tutorId: tutor, parentesco: 'Padre' })
    const a2 = seedAlumno(mockedDb, { dni: '2', cursoId })

    const updated = tutorService.update(tutor, {
      nombre: 'Pedro Pablo',
      vinculos: [{ alumno_id: a2, parentesco: 'Tío' }],
    })
    expect(updated.nombre).toBe('Pedro Pablo')
    expect(updated.vinculos).toHaveLength(1)
    expect(updated.vinculos[0].alumno_id).toBe(a2)
  })

  it('remove elimina el tutor y sus vínculos', () => {
    const tutor = seedTutor(mockedDb, { nombre: 'Pedro', apellido: 'Pérez', dni: '30000000' })
    const a1 = seedAlumno(mockedDb, { dni: '1', cursoId })
    seedAlumnoTutor(mockedDb, { alumnoId: a1, tutorId: tutor })
    tutorService.remove(tutor)
    expect(mockedDb.prepare('SELECT COUNT(*) c FROM tutores').get().c).toBe(0)
    expect(mockedDb.prepare('SELECT COUNT(*) c FROM alumnos_tutores').get().c).toBe(0)
  })

  it('remove lanza 404 si el tutor no existe', () => {
    expect(() => tutorService.remove(999)).toThrow(new HttpError(404, 'Tutor no encontrado'))
  })

  it('remove lanza 409 si el tutor tiene retiros registrados', () => {
    const tutor = seedTutor(mockedDb, { nombre: 'Pedro', apellido: 'Pérez', dni: '30000000' })
    const a1 = seedAlumno(mockedDb, { dni: '1', cursoId })
    seedAlumnoTutor(mockedDb, { alumnoId: a1, tutorId: tutor })
    mockedDb.prepare('INSERT INTO retiros (alumno_id, tutor_id, fecha, hora) VALUES (?, ?, ?, ?)')
      .run(a1, tutor, '2026-08-28', '10:00')
    expect(() => tutorService.remove(tutor))
      .toThrow(new HttpError(409, 'No se puede eliminar: el tutor tiene retiros registrados'))
  })
})
