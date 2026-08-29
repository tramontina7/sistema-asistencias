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

import { docenteService } from '../../src/services/docenteService.js'
import { HttpError } from '../../src/utils/http-error.js'

const RESET = [
  'materia_comisiones', 'previas', 'asistencias', 'docente_suplencias',
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

describe('docenteService', () => {
  describe('create / list / getById', () => {
    it('crea un docente y lo devuelve con dni en claro', () => {
      const d = docenteService.create({ nombre: 'Ana', apellido: 'García', dni: 55555555, correo: 'ag@edu', telefono: '1234' })
      expect(d.docente_id).toBeTruthy()
      expect(d.dni).toBe('55555555')
      const list = docenteService.list()
      expect(list).toHaveLength(1)
      expect(list[0].dni).toBe('55555555')
      expect(list[0].dni_cif).toBeUndefined()
    })

    it('lanza 409 si el dni ya existe', () => {
      docenteService.create({ nombre: 'Ana', apellido: 'García', dni: 55555555 })
      expect(() => docenteService.create({ nombre: 'Otra', apellido: 'X', dni: 55555555 }))
        .toThrow(new HttpError(409, 'Ya existe un docente con ese DNI'))
    })

    it('lanza 400 si falta dni', () => {
      expect(() => docenteService.create({ nombre: 'Ana', apellido: 'García' }))
        .toThrow(new HttpError(400, 'nombre, apellido y dni son requeridos'))
    })

    it('lanza 404 si el docente no existe', () => {
      expect(() => docenteService.getById(999)).toThrow(new HttpError(404, 'Docente no encontrado'))
    })
  })

  describe('competencias (puede_dictar)', () => {
    it('guarda las materias que puede dictar al crear', () => {
      seedMateria(mockedDb, { cursoId, nombreMateria: 'Matemáticas' })
      seedMateria(mockedDb, { cursoId, nombreMateria: 'Física' })
      const d = docenteService.create({
        nombre: 'Ana', apellido: 'García', dni: 55555555,
        puedeDictar: ['Matemáticas', 'Física'],
      })
      expect(d.puede_dictar).toEqual(['Física', 'Matemáticas'])
      expect(docenteService.list()[0].puede_dictar).toContain('Matemáticas')
    })

    it('reemplaza las competencias al actualizar', () => {
      seedMateria(mockedDb, { cursoId, nombreMateria: 'Química' })
      seedMateria(mockedDb, { cursoId, nombreMateria: 'Matemáticas' })
      const d = docenteService.create({
        nombre: 'Ana', apellido: 'García', dni: 55555555,
        puedeDictar: ['Matemáticas'],
      })
      const updated = docenteService.update(d.docente_id, { puedeDictar: ['Química'] })
      expect(updated.puede_dictar).toEqual(['Química'])
      expect(docenteService.getById(d.docente_id).puede_dictar).not.toContain('Matemáticas')
    })

    it('lanza 400 con una materia inexistente en el catálogo', () => {
      expect(() => docenteService.create({
        nombre: 'Ana', apellido: 'García', dni: 55555555,
        puedeDictar: ['Astrología'],
      })).toThrow(new HttpError(400, "La materia 'Astrología' no existe en el catálogo"))
    })
  })

  describe('update / remove', () => {
    it('actualiza y devuelve datos actualizados', () => {
      const d = docenteService.create({ nombre: 'Ana', apellido: 'García', dni: 55555555 })
      const updated = docenteService.update(d.docente_id, { apellido: 'Pérez' })
      expect(updated.apellido).toBe('Pérez')
    })

    it('lanza 404 al actualizar un docente inexistente', () => {
      expect(() => docenteService.update(999, { nombre: 'X' }))
        .toThrow(new HttpError(404, 'Docente no encontrado'))
    })

    it('elimina un docente', () => {
      const d = docenteService.create({ nombre: 'Ana', apellido: 'García', dni: 55555555 })
      docenteService.remove(d.docente_id)
      expect(docenteService.list()).toHaveLength(0)
    })
  })

  describe('materias', () => {
    it('devuelve las materias asignadas al docente', () => {
      const d = docenteService.create({ nombre: 'Ana', apellido: 'García', dni: 55555555 })
      seedMateria(mockedDb, { cursoId, docenteId: d.docente_id, nombreMateria: 'Matemática' })
      const materias = docenteService.materias(d.docente_id)
      expect(materias).toHaveLength(1)
      expect(materias[0]).toMatchObject({ anio: 4, division: '1', nombre_materia: 'Matemática' })
    })
  })

  describe('estado (Disponible / Licencia)', () => {
    it('crea un docente Disponible por defecto', () => {
      const d = docenteService.create({ nombre: 'Ana', apellido: 'García', dni: 55555555 })
      expect(d.estado).toBe('Disponible')
    })

    it('acepta un estado al crear', () => {
      const d = docenteService.create({ nombre: 'Ana', apellido: 'García', dni: 55555555, estado: 'Licencia' })
      expect(d.estado).toBe('Licencia')
    })

    it('lanza 400 con estado inválido', () => {
      expect(() => docenteService.create({
        nombre: 'Ana', apellido: 'García', dni: 55555555, estado: 'Vacaciones',
      })).toThrow(/Estado inválido/)
    })

    it('cambia el estado de ida y vuelta', () => {
      const d = docenteService.create({ nombre: 'Ana', apellido: 'García', dni: 55555555 })
      expect(docenteService.cambiarEstado(d.docente_id, 'Licencia').estado).toBe('Licencia')
      expect(docenteService.cambiarEstado(d.docente_id, 'Disponible').estado).toBe('Disponible')
    })

    it('lanza 400 con estado inválido al cambiar', () => {
      const d = docenteService.create({ nombre: 'Ana', apellido: 'García', dni: 55555555 })
      expect(() => docenteService.cambiarEstado(d.docente_id, 'Ausente')).toThrow(/Estado inválido/)
    })

    it('actualiza estado vía update', () => {
      const d = docenteService.create({ nombre: 'Ana', apellido: 'García', dni: 55555555 })
      const updated = docenteService.update(d.docente_id, { estado: 'Licencia' })
      expect(updated.estado).toBe('Licencia')
    })
  })

  describe('reemplazo (suplencia vigente)', () => {
    function setup() {
      const materiaId = seedMateria(mockedDb, { cursoId })
      const titular = docenteService.create({
        nombre: 'Ana', apellido: 'García', dni: 55555555, puedeDictar: ['Matemática'],
      })
      const suplente = docenteService.create({
        nombre: 'Luis', apellido: 'Rodríguez', dni: 66666666, puedeDictar: ['Matemática'],
      })
      mockedDb.prepare('UPDATE materias SET docente_id = ? WHERE materia_id = ?').run(titular.docente_id, materiaId)
      return { titular, suplente, materiaId }
    }

    it('asigna reemplazo solo si el titular está de licencia', () => {
      const { titular, suplente, materiaId } = setup()
      expect(() => docenteService.asignarReemplazo(materiaId, suplente.docente_id))
        .toThrow(/Solo se puede asignar suplente/)

      docenteService.cambiarEstado(titular.docente_id, 'Licencia')
      const res = docenteService.asignarReemplazo(materiaId, suplente.docente_id)
      expect(res.suplente_id).toBe(suplente.docente_id)
    })

    it('no permite un reemplazo sin competencia', () => {
      const materiaId = seedMateria(mockedDb, { cursoId })
      const titular = docenteService.create({
        nombre: 'Ana', apellido: 'García', dni: 55555555, puedeDictar: ['Matemática'],
      })
      const sinCompetencia = docenteService.create({ nombre: 'Luis', apellido: 'Rodríguez', dni: 66666666 })
      mockedDb.prepare('UPDATE materias SET docente_id = ? WHERE materia_id = ?').run(titular.docente_id, materiaId)
      docenteService.cambiarEstado(titular.docente_id, 'Licencia')

      expect(() => docenteService.asignarReemplazo(materiaId, sinCompetencia.docente_id))
        .toThrow(/no puede dictar esta materia/)
    })

    it('no permite que el reemplazo sea el titular', () => {
      const { titular, materiaId } = setup()
      docenteService.cambiarEstado(titular.docente_id, 'Licencia')
      expect(() => docenteService.asignarReemplazo(materiaId, titular.docente_id))
        .toThrow(/no puede ser el docente titular/)
    })

    it('reemplaza el reemplazo existente', () => {
      const { titular, materiaId } = setup()
      const s2 = docenteService.create({
        nombre: 'Pablo', apellido: 'Díaz', dni: 77777777, puedeDictar: ['Matemática'],
      })
      docenteService.cambiarEstado(titular.docente_id, 'Licencia')
      docenteService.asignarReemplazo(materiaId, s2.docente_id)
      docenteService.asignarReemplazo(materiaId, s2.docente_id)

      const dispo = docenteService.disponibilidad()
      const d = dispo.find(x => x.docente_id === titular.docente_id)
      expect(d.materias[0].reemplazo).toMatchObject({ nombre: 'Pablo', apellido: 'Díaz' })
    })

    it('quita el reemplazo', () => {
      const { titular, suplente, materiaId } = setup()
      docenteService.cambiarEstado(titular.docente_id, 'Licencia')
      docenteService.asignarReemplazo(materiaId, suplente.docente_id)
      docenteService.quitarReemplazo(materiaId)

      const dispo = docenteService.disponibilidad()
      const d = dispo.find(x => x.docente_id === titular.docente_id)
      expect(d.materias[0].reemplazo).toBeNull()
    })

    it('al volver a Disponible limpia los reemplazos', () => {
      const { titular, suplente, materiaId } = setup()
      docenteService.cambiarEstado(titular.docente_id, 'Licencia')
      docenteService.asignarReemplazo(materiaId, suplente.docente_id)
      docenteService.cambiarEstado(titular.docente_id, 'Disponible')

      const dispo = docenteService.disponibilidad()
      const d = dispo.find(x => x.docente_id === titular.docente_id)
      expect(d.materias[0].reemplazo).toBeNull()
    })

    it('lanza 400 si la materia no tiene titular', () => {
      const materiaId = seedMateria(mockedDb, { cursoId })
      const suplente = docenteService.create({
        nombre: 'Luis', apellido: 'Rodríguez', dni: 66666666, puedeDictar: ['Matemática'],
      })
      expect(() => docenteService.asignarReemplazo(materiaId, suplente.docente_id))
        .toThrow(/no tiene docente titular/)
    })

    it('lanza 404 si la materia no existe', () => {
      const suplente = docenteService.create({ nombre: 'Luis', apellido: 'Rodríguez', dni: 66666666 })
      expect(() => docenteService.asignarReemplazo(999, suplente.docente_id))
        .toThrow(new HttpError(404, 'Materia no encontrada'))
    })

    it('lanza 404 si no hay reemplazo que quitar', () => {
      expect(() => docenteService.quitarReemplazo(1)).toThrow(/no tiene suplente/)
    })
  })

  describe('reemplazo por comisión', () => {
    const habilitar = (docenteId, nombre) =>
      mockedDb.prepare('INSERT INTO docente_materias (docente_id, nombre_materia) VALUES (?, ?)')
        .run(docenteId, nombre)

    it('asigna y quita reemplazo solo en la comisión indicada', () => {
      const materiaId = seedMateria(mockedDb, { cursoId, nombreMateria: 'Programación', tipo: 'Taller' })
      const ta = docenteService.create({ nombre: 'Ana', apellido: 'Ga', dni: 55555555, puedeDictar: ['Programación'] })
      const tb = docenteService.create({ nombre: 'Luis', apellido: 'Ro', dni: 66666666, puedeDictar: ['Programación'] })
      const sup = docenteService.create({ nombre: 'Pablo', apellido: 'Di', dni: 77777777, puedeDictar: ['Programación'] })
      mockedDb.prepare('INSERT INTO materia_comisiones (materia_id, comision, docente_id) VALUES (?, ?, ?)')
        .run(materiaId, 'A', ta.docente_id)
      mockedDb.prepare('INSERT INTO materia_comisiones (materia_id, comision, docente_id) VALUES (?, ?, ?)')
        .run(materiaId, 'B', tb.docente_id)

      docenteService.cambiarEstado(ta.docente_id, 'Licencia')
      docenteService.asignarReemplazo(materiaId, sup.docente_id, 'A')

      const dispo = docenteService.disponibilidad()
      const dA = dispo.find(x => x.docente_id === ta.docente_id)
      const dB = dispo.find(x => x.docente_id === tb.docente_id)
      const mA = dA.materias.find(x => x.materia_id === materiaId)
      const mB = dB.materias.find(x => x.materia_id === materiaId)
      expect(mA.comision).toBe('A')
      expect(mA.reemplazo).toMatchObject({ nombre: 'Pablo' })
      expect(mB.reemplazo).toBeNull()

      docenteService.quitarReemplazo(materiaId, 'A')
      const dA2 = docenteService.disponibilidad().find(x => x.docente_id === ta.docente_id)
      expect(dA2.materias.find(x => x.materia_id === materiaId).reemplazo).toBeNull()
    })

    it('rechaza reemplazo para una comisión inexistente', () => {
      const materiaId = seedMateria(mockedDb, { cursoId, nombreMateria: 'Programación', tipo: 'Taller' })
      const sup = docenteService.create({ nombre: 'Pablo', apellido: 'Di', dni: 77777777, puedeDictar: ['Programación'] })
      expect(() => docenteService.asignarReemplazo(materiaId, sup.docente_id, 'C'))
        .toThrow(/no tiene esa comisión/)
    })

    it('al volver a Disponible limpia el reemplazo de la comisión', () => {
      const materiaId = seedMateria(mockedDb, { cursoId, nombreMateria: 'Programación', tipo: 'Taller' })
      const ta = docenteService.create({ nombre: 'Ana', apellido: 'Ga', dni: 55555555, puedeDictar: ['Programación'] })
      const sup = docenteService.create({ nombre: 'Pablo', apellido: 'Di', dni: 77777777, puedeDictar: ['Programación'] })
      mockedDb.prepare('INSERT INTO materia_comisiones (materia_id, comision, docente_id) VALUES (?, ?, ?)')
        .run(materiaId, 'A', ta.docente_id)

      docenteService.cambiarEstado(ta.docente_id, 'Licencia')
      docenteService.asignarReemplazo(materiaId, sup.docente_id, 'A')
      docenteService.cambiarEstado(ta.docente_id, 'Disponible')

      const d = docenteService.disponibilidad().find(x => x.docente_id === ta.docente_id)
      expect(d.materias.find(x => x.materia_id === materiaId).reemplazo).toBeNull()
    })

    it('materias() incluye la comisión del docente', () => {
      const materiaId = seedMateria(mockedDb, { cursoId, nombreMateria: 'Programación', tipo: 'Taller' })
      const ta = docenteService.create({ nombre: 'Ana', apellido: 'Ga', dni: 55555555, puedeDictar: ['Programación'] })
      mockedDb.prepare('INSERT INTO materia_comisiones (materia_id, comision, docente_id) VALUES (?, ?, ?)')
        .run(materiaId, 'B', ta.docente_id)
      const materias = docenteService.materias(ta.docente_id)
      expect(materias).toHaveLength(1)
      expect(materias[0]).toMatchObject({ materia_id: materiaId, comision: 'B' })
    })
  })
})