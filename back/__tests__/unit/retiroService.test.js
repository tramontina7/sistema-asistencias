import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DDL, seedCurso, seedMateria, seedAlumno, seedTutor, seedAlumnoTutor, seedAsistencia } from '../helpers/inMemoryDb.js'

vi.mock('../../src/db/index.js', async () => {
  const Database = (await import('better-sqlite3')).default
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(DDL)
  return { default: db }
})

const mockedDb = (await import('../../src/db/index.js')).default

import { retiroService } from '../../src/services/retiroService.js'
import { HttpError } from '../../src/utils/http-error.js'

const RESET = [
  'retiros', 'previas', 'asistencias', 'docente_suplencias', 'horarios', 'materias',
  'docente_materias', 'alumnos_tutores', 'alumnos', 'preceptores_cursos', 'preceptores',
  'docentes', 'cursos', 'tutores',
]

let cursoId
let materiaId

beforeEach(() => {
  for (const t of RESET) {
    try { mockedDb.prepare(`DELETE FROM ${t}`).run() } catch {}
  }
  cursoId = seedCurso(mockedDb, { anio: 1, division: '1', especialidad: 'Ciclo Básico' })
  materiaId = seedMateria(mockedDb, { cursoId })
})

const FECHA = '2026-08-28' // viernes

describe('retiroService.listarPresentesPorCurso', () => {
  it('devuelve alumnos del curso con asistencia Presente o Tarde en la fecha', () => {
    const a1 = seedAlumno(mockedDb, { nombre: 'Lucía', apellido: 'Pérez', dni: '1', cursoId })
    const a2 = seedAlumno(mockedDb, { nombre: 'Mateo', apellido: 'García', dni: '2', cursoId })
    const a3 = seedAlumno(mockedDb, { nombre: 'Sofía', apellido: 'Rodríguez', dni: '3', cursoId })
    seedAsistencia(mockedDb, { alumnoId: a1, materiaId, fecha: FECHA, estado: 'Presente' })
    seedAsistencia(mockedDb, { alumnoId: a2, materiaId, fecha: FECHA, estado: 'Tarde' })
    seedAsistencia(mockedDb, { alumnoId: a3, materiaId, fecha: FECHA, estado: 'Ausente' })

    const presentes = retiroService.listarPresentesPorCurso({ cursoId, fecha: FECHA })
    expect(presentes.map(p => p.nombre).sort()).toEqual(['Lucía', 'Mateo'])
    expect(presentes[0].curso_nombre).toContain('Ciclo Básico')
  })

  it('no excluye alumnos presentes en otras fechas', () => {
    const a1 = seedAlumno(mockedDb, { nombre: 'Lucía', apellido: 'Pérez', cursoId })
    seedAsistencia(mockedDb, { alumnoId: a1, materiaId, fecha: '2026-08-27', estado: 'Presente' })
    expect(retiroService.listarPresentesPorCurso({ cursoId, fecha: FECHA })).toEqual([])
  })

  it('ignora alumnos presentes de otro curso', () => {
    const otroCurso = seedCurso(mockedDb, { anio: 2, division: '1' })
    const a = seedAlumno(mockedDb, { cursoId: otroCurso })
    seedAsistencia(mockedDb, { alumnoId: a, materiaId: seedMateria(mockedDb, { cursoId: otroCurso }), fecha: FECHA, estado: 'Presente' })
    expect(retiroService.listarPresentesPorCurso({ cursoId, fecha: FECHA })).toEqual([])
  })

  it('lanza 400 si faltan curso_id o fecha', () => {
    expect(() => retiroService.listarPresentesPorCurso({ fecha: FECHA })).toThrow(/curso_id requerido/)
    expect(() => retiroService.listarPresentesPorCurso({ cursoId })).toThrow(/fecha requerida/)
  })
})

describe('retiroService.registrar', () => {
  it('registra un retiro y devuelve el id', () => {
    const alumno = seedAlumno(mockedDb, { cursoId })
    const tutor = seedTutor(mockedDb)
    const res = retiroService.registrar({ alumnoId: alumno, tutorId: tutor, fecha: FECHA, hora: '10:30' })
    expect(res.retiro_id).toBeTruthy()
    expect(res.alumno_id).toBe(alumno)
    const row = mockedDb.prepare('SELECT * FROM retiros WHERE retiro_id = ?').get(res.retiro_id)
    expect(row.tutor_id).toBe(tutor)
    expect(row.hora).toBe('10:30')
  })

  it('lanza 404 si el alumno o tutor no existen', () => {
    expect(() => retiroService.registrar({ alumnoId: 999, tutorId: 1, fecha: FECHA, hora: '10:00' }))
      .toThrow(new HttpError(404, 'Alumno no encontrado'))
    const alumno = seedAlumno(mockedDb, { cursoId })
    expect(() => retiroService.registrar({ alumnoId: alumno, tutorId: 999, fecha: FECHA, hora: '10:00' }))
      .toThrow(new HttpError(404, 'Tutor no encontrado'))
  })

  it('lanza 400 con fecha inválida', () => {
    const alumno = seedAlumno(mockedDb, { cursoId })
    const tutor = seedTutor(mockedDb)
    expect(() => retiroService.registrar({ alumnoId: alumno, tutorId: tutor, fecha: '28/08/2026', hora: '10:00' }))
      .toThrow(/Formato de fecha/)
  })
})
