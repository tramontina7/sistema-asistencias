import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DDL, seedCurso, seedMateria, seedDocente } from '../helpers/inMemoryDb.js'

vi.mock('../../src/db/index.js', async () => {
  const Database = (await import('better-sqlite3')).default
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(DDL)
  return { default: db }
})

const mockedDb = (await import('../../src/db/index.js')).default

import { ausenciaService } from '../../src/services/ausenciaService.js'
import { HttpError } from '../../src/utils/http-error.js'

const RESET = [
  'docente_ausencias', 'materia_comisiones', 'previas', 'asistencias', 'docente_suplencias',
  'horarios', 'materias', 'alumnos_tutores', 'alumnos',
  'preceptores_cursos', 'preceptores', 'docente_materias', 'docentes', 'cursos', 'tutores',
]

let cursoId

beforeEach(() => {
  for (const t of RESET) {
    try { mockedDb.prepare(`DELETE FROM ${t}`).run() } catch {}
  }
  cursoId = seedCurso(mockedDb, { anio: 4, division: '1', especialidad: 'Informática' })
})

// 2026-08-24 es lunes
const LUNES = '2026-08-24'

describe('ausenciaService', () => {
  describe('marcar / quitar', () => {
    it('marca una ausencia para un docente en una fecha', () => {
      const d = seedDocente(mockedDb)
      const res = ausenciaService.marcar(d, LUNES)
      expect(res).toEqual({ docente_id: d, fecha: LUNES })
      const rows = mockedDb.prepare('SELECT * FROM docente_ausencias').all()
      expect(rows).toHaveLength(1)
    })

    it('marcar no duplica si ya existe', () => {
      const d = seedDocente(mockedDb)
      ausenciaService.marcar(d, LUNES)
      ausenciaService.marcar(d, LUNES)
      const rows = mockedDb.prepare('SELECT * FROM docente_ausencias').all()
      expect(rows).toHaveLength(1)
    })

    it('lanza 404 si el docente no existe', () => {
      expect(() => ausenciaService.marcar(999, LUNES)).toThrow(new HttpError(404, 'Docente no encontrado'))
    })

    it('lanza 400 con fecha inválida', () => {
      const d = seedDocente(mockedDb)
      expect(() => ausenciaService.marcar(d, '28/08/2026')).toThrow(/Formato de fecha/)
    })

    it('quita una ausencia', () => {
      const d = seedDocente(mockedDb)
      ausenciaService.marcar(d, LUNES)
      const res = ausenciaService.quitar(d, LUNES)
      expect(res.message).toBe('Ausencia quitada')
      expect(mockedDb.prepare('SELECT * FROM docente_ausencias').all()).toHaveLength(0)
    })

    it('quitar lanza 404 si no estaba ausente', () => {
      const d = seedDocente(mockedDb)
      expect(() => ausenciaService.quitar(d, LUNES)).toThrow(new HttpError(404, 'El docente no está marcado ausente en esa fecha'))
    })
  })

  describe('listar', () => {
    it('deriva los bloques libres de las materias con horario ese día', () => {
      const d = seedDocente(mockedDb, { nombre: 'Roberto' })
      const materiaId = seedMateria(mockedDb, { cursoId, nombreMateria: 'Laboratorio', tipo: 'Taller', docenteId: d })
      mockedDb.prepare(
        'INSERT INTO horarios (materia_id, dia_semana, hora_entrada, hora_salida) VALUES (?, ?, ?, ?)'
      ).run(materiaId, 'Lunes', '08:00', '09:00')
      mockedDb.prepare(
        'INSERT INTO horarios (materia_id, dia_semana, hora_entrada, hora_salida) VALUES (?, ?, ?, ?)'
      ).run(materiaId, 'Martes', '08:00', '09:00')

      ausenciaService.marcar(d, LUNES)
      const list = ausenciaService.listar({ fecha: LUNES })
      expect(list).toHaveLength(1)
      expect(list[0].docente_id).toBe(d)
      expect(list[0].bloques).toHaveLength(1)
      expect(list[0].bloques[0]).toMatchObject({ materia_id: materiaId, nombre_materia: 'Laboratorio', dia_semana: 'Lunes', hora_entrada: '08:00', hora_salida: '09:00' })
    })

    it('devuelve vacío si no hay ausentes', () => {
      expect(ausenciaService.listar({ fecha: LUNES })).toEqual([])
    })

    it('lanza 400 en fin de semana', () => {
      const d = seedDocente(mockedDb)
      ausenciaService.marcar(d, '2026-08-23') // domingo
      expect(() => ausenciaService.listar({ fecha: '2026-08-23' })).toThrow(/no hay clases/)
    })

    it('lanza 400 si falta fecha', () => {
      expect(() => ausenciaService.listar({})).toThrow(/fecha requerida/)
    })

    it('cuenta a los docentes de licencia como ausentes (motivo licencia)', () => {
      const d = seedDocente(mockedDb, { nombre: 'Ana', estado: 'Licencia' })
      const materiaId = seedMateria(mockedDb, { cursoId, nombreMateria: 'Laboratorio', tipo: 'Taller', docenteId: d })
      mockedDb.prepare(
        'INSERT INTO horarios (materia_id, dia_semana, hora_entrada, hora_salida) VALUES (?, ?, ?, ?)'
      ).run(materiaId, 'Lunes', '08:00', '09:00')

      const list = ausenciaService.listar({ fecha: LUNES })
      expect(list).toHaveLength(1)
      expect(list[0].docente_id).toBe(d)
      expect(list[0].motivo).toBe('licencia')
      expect(list[0].bloques).toHaveLength(1)
    })

    it('excluye de horas libres la materia con reemplazante', () => {
      const d = seedDocente(mockedDb, { nombre: 'Ana', estado: 'Licencia' })
      const materiaId = seedMateria(mockedDb, { cursoId, nombreMateria: 'Laboratorio', tipo: 'Taller', docenteId: d })
      mockedDb.prepare(
        'INSERT INTO horarios (materia_id, dia_semana, hora_entrada, hora_salida) VALUES (?, ?, ?, ?)'
      ).run(materiaId, 'Lunes', '08:00', '09:00')
      const sup = seedDocente(mockedDb, { nombre: 'Luis' })
      mockedDb.prepare(
        'INSERT INTO docente_suplencias (materia_id, comision, suplente_docente_id) VALUES (?, ?, ?)'
      ).run(materiaId, null, sup)

      const list = ausenciaService.listar({ fecha: LUNES })
      expect(list).toHaveLength(1)
      expect(list[0].bloques).toHaveLength(0)
    })

    it('excluye de horas libres la comisión con reemplazante pero no las demás', () => {
      const d = seedDocente(mockedDb, { nombre: 'Ana', estado: 'Licencia' })
      const materiaId = seedMateria(mockedDb, { cursoId, nombreMateria: 'Laboratorio', tipo: 'Taller' })
      // Ana dicta comisión A y B
      mockedDb.prepare(
        'INSERT INTO materia_comisiones (materia_id, comision, docente_id) VALUES (?, ?, ?)'
      ).run(materiaId, 'A', d)
      mockedDb.prepare(
        'INSERT INTO materia_comisiones (materia_id, comision, docente_id) VALUES (?, ?, ?)'
      ).run(materiaId, 'B', d)
      for (const h of [['Lunes', '08:00', '09:00'], ['Lunes', '09:00', '10:00']]) {
        mockedDb.prepare(
          'INSERT INTO horarios (materia_id, dia_semana, hora_entrada, hora_salida) VALUES (?, ?, ?, ?)'
        ).run(materiaId, h[0], h[1], h[2])
      }
      // Comisión A tiene reemplazante
      const sup = seedDocente(mockedDb, { nombre: 'Luis' })
      mockedDb.prepare(
        'INSERT INTO docente_suplencias (materia_id, comision, suplente_docente_id) VALUES (?, ?, ?)'
      ).run(materiaId, 'A', sup)

      const list = ausenciaService.listar({ fecha: LUNES })
      expect(list).toHaveLength(1)
      expect(list[0].bloques).toHaveLength(2)
      expect(list[0].bloques.every(b => b.comision === 'B')).toBe(true)
    })
  })

  describe('listarDocentes', () => {
    it('devuelve todos los docentes con la bandera ausente del día', () => {
      const d1 = seedDocente(mockedDb, { nombre: 'Roberto' })
      seedDocente(mockedDb, { nombre: 'Ana' })
      ausenciaService.marcar(d1, LUNES)
      const docs = ausenciaService.listarDocentes({ fecha: LUNES })
      expect(docs).toHaveLength(2)
      const roberto = docs.find(x => x.docente_id === d1)
      expect(roberto.ausente).toBe(true)
      expect(docs.every(x => x.nombre && x.apellido)).toBe(true)
      expect(docs.filter(x => !x.ausente)).toHaveLength(1)
    })

    it('marca a los docentes de licencia como ausentes con bandera licencia', () => {
      const d1 = seedDocente(mockedDb, { nombre: 'Roberto' })
      const d2 = seedDocente(mockedDb, { nombre: 'Ana', estado: 'Licencia' })
      const docs = ausenciaService.listarDocentes({ fecha: LUNES })
      const roberto = docs.find(x => x.docente_id === d1)
      const ana = docs.find(x => x.docente_id === d2)
      expect(roberto.ausente).toBe(false)
      expect(roberto.licencia).toBe(false)
      expect(ana.ausente).toBe(true)
      expect(ana.licencia).toBe(true)
    })
  })
})
