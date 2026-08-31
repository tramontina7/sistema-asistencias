import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setupTestDb, resetDb, seedCurso } from '../helpers/inMemoryDb.js'

const mockedDb = setupTestDb()

import { materiaService } from '../../src/services/materiaService.js'
import { HttpError } from '../../src/utils/http-error.js'

let cursoId

beforeEach(() => {
  resetDb(mockedDb)
  cursoId = seedCurso(mockedDb, { anio: 4, division: '1', especialidad: 'Informática' })
})

describe('materiaService', () => {
  describe('create', () => {
    it('crea una materia y devuelve sus datos', () => {
      const m = materiaService.create({ cursoId, nombreMateria: 'Matemática', especialidad: 'Informática' })
      expect(m.materia_id).toBeTruthy()
      expect(m.curso_id).toBe(cursoId)
      expect(m.nombre_materia).toBe('Matemática')
      expect(m.tipo).toBe('Teoría')
    })

    it('guarda el tipo taller/laboratorio', () => {
      const m = materiaService.create({ cursoId, nombreMateria: 'Programación', especialidad: 'Informática', tipo: 'Taller' })
      expect(m.tipo).toBe('Taller')
    })

    it('lanza 400 con tipo inválido', () => {
      expect(() => materiaService.create({ cursoId, nombreMateria: 'X', especialidad: 'Y', tipo: 'Práctica' }))
        .toThrow(/Tipo inválido/)
    })

    it('lanza 404 si el curso no existe', () => {
      expect(() => materiaService.create({ cursoId: 999, nombreMateria: 'X', especialidad: 'Y' }))
        .toThrow(new HttpError(404, 'Curso no encontrado'))
    })

    it('lanza 400 sin nombre', () => {
      expect(() => materiaService.create({ cursoId, nombreMateria: '  ', especialidad: 'X' }))
        .toThrow(new HttpError(400, 'nombre_materia requerido'))
    })
  })

  describe('list', () => {
    it('lista materias de un curso', () => {
      materiaService.create({ cursoId, nombreMateria: 'Matemática', especialidad: 'Info' })
      materiaService.create({ cursoId, nombreMateria: 'Lengua', especialidad: 'Info' })
      const list = materiaService.list({ cursoId })
      expect(list).toHaveLength(2)
    })
  })

  describe('listAll', () => {
    it('incluye curso_nombre y horarios por materia', () => {
      const m = materiaService.create({ cursoId, nombreMateria: 'Matemática', especialidad: 'Informática' })
      materiaService.setHorarios(m.materia_id, [
        { dia_semana: 'Lunes', hora_entrada: '08:00', hora_salida: '09:00' },
      ])
      const found = materiaService.listAll().find(x => x.materia_id === m.materia_id)
      expect(found).toBeTruthy()
      expect(found.curso_nombre).toBe('4to 1ra')
      expect(found.horarios).toHaveLength(1)
      expect(found.horarios[0].dia_semana).toBe('Lunes')
    })
  })

  describe('setHorarios', () => {
    it('reemplaza los horarios de una materia', () => {
      const m = materiaService.create({ cursoId, nombreMateria: 'Matemática', especialidad: 'Info' })
      materiaService.setHorarios(m.materia_id, [
        { dia_semana: 'Lunes', hora_entrada: '08:00', hora_salida: '09:00' },
        { dia_semana: 'Miércoles', hora_entrada: '08:00', hora_salida: '09:00' },
      ])
      const result = materiaService.getById(m.materia_id)
      expect(result.horarios).toHaveLength(2)
    })

    it('lanza 400 con día inválido', () => {
      const m = materiaService.create({ cursoId, nombreMateria: 'X', especialidad: 'Y' })
      expect(() => materiaService.setHorarios(m.materia_id, [
        { dia_semana: 'Domingo', hora_entrada: '08:00', hora_salida: '09:00' },
      ])).toThrow(/Día inválido/)
    })

    it('asocia un horario con comisión', () => {
      const m = materiaService.create({ cursoId, nombreMateria: 'Programación', especialidad: 'Info', tipo: 'Taller' })
      materiaService.setHorarios(m.materia_id, [
        { dia_semana: 'Lunes', hora_entrada: '08:00', hora_salida: '09:00', comision: 'A' },
      ])
      const result = materiaService.getById(m.materia_id)
      expect(result.horarios[0].comision).toBe('A')
    })

    it('lanza 400 con comisión inválida', () => {
      const m = materiaService.create({ cursoId, nombreMateria: 'Programación', especialidad: 'Info', tipo: 'Taller' })
      expect(() => materiaService.setHorarios(m.materia_id, [
        { dia_semana: 'Lunes', hora_entrada: '08:00', hora_salida: '09:00', comision: 'C' },
      ])).toThrow(/Comisión inválida/)
    })
  })

  describe('update / remove', () => {
    it('actualiza el nombre', () => {
      const m = materiaService.create({ cursoId, nombreMateria: 'Matemática', especialidad: 'X' })
      const updated = materiaService.update(m.materia_id, { nombreMateria: 'Mat. Avanzada' })
      expect(updated.nombre_materia).toBe('Mat. Avanzada')
    })

    it('no permite modificar el tipo', () => {
      const m = materiaService.create({ cursoId, nombreMateria: 'Matemática', especialidad: 'X' })
      expect(() => materiaService.update(m.materia_id, { tipo: 'Laboratorio' }))
        .toThrow(/El tipo de una materia es inmutable/)
    })

    it('lanza 404 si la materia no existe', () => {
      expect(() => materiaService.update(999, { nombreMateria: 'X' }))
        .toThrow(new HttpError(404, 'Materia no encontrada'))
    })

    it('elimina la materia', () => {
      const m = materiaService.create({ cursoId, nombreMateria: 'X', especialidad: 'Y' })
      materiaService.remove(m.materia_id)
      expect(materiaService.list({ cursoId })).toHaveLength(0)
    })
  })

  describe('setComisiones', () => {
    it('rechaza comisiones para materias de Teoría', () => {
      const m = materiaService.create({ cursoId, nombreMateria: 'Matemática', especialidad: 'Info' })
      expect(() => materiaService.setComisiones(m.materia_id, [{ comision: 'A' }]))
        .toThrow(new HttpError(400, 'Solo las materias de Taller o Laboratorio admiten comisiones'))
    })

    it('asigna comisiones A/B en una materia de Taller', () => {
      const m = materiaService.create({ cursoId, nombreMateria: 'Programación', especialidad: 'Info', tipo: 'Taller' })
      const result = materiaService.setComisiones(m.materia_id, [
        { comision: 'A' },
        { comision: 'B' },
      ])
      expect(result.comisiones).toHaveLength(2)
      expect(result.comisiones.map(c => c.comision)).toEqual(['A', 'B'])
    })

    it('rechaza comisiones duplicadas', () => {
      const m = materiaService.create({ cursoId, nombreMateria: 'Programación', especialidad: 'Info', tipo: 'Taller' })
      expect(() => materiaService.setComisiones(m.materia_id, [
        { comision: 'A' },
        { comision: 'A' },
      ])).toThrow(/Comisión duplicada/)
    })

    it('rechaza comisiones con nombre distinto de A/B', () => {
      const m = materiaService.create({ cursoId, nombreMateria: 'Programación', especialidad: 'Info', tipo: 'Taller' })
      expect(() => materiaService.setComisiones(m.materia_id, [{ comision: 'Comisión C' }]))
        .toThrow(/Comisión inválida/)
    })
  })
})