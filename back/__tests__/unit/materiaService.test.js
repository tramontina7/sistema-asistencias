import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DDL, seedCurso, seedMateria } from '../helpers/inMemoryDb.js'

vi.mock('../../src/db/index.js', async () => {
  const Database = (await import('better-sqlite3')).default
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(DDL)
  return { default: db }
})

const mockedDb = (await import('../../src/db/index.js')).default

import { materiaService } from '../../src/services/materiaService.js'
import { HttpError } from '../../src/utils/http-error.js'

const RESET = [
  'materia_comisiones', 'previas', 'asistencias', 'docente_suplencias', 'horarios', 'materias',
  'alumnos_tutores', 'alumnos', 'preceptores_cursos', 'preceptores',
  'docente_materias', 'docentes', 'cursos', 'tutores',
]

let cursoId

beforeEach(() => {
  for (const t of RESET) {
    try { mockedDb.prepare(`DELETE FROM ${t}`).run() } catch {}
  }
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

    it('incluye el docente y el reemplazo de la materia', () => {
      const t = mockedDb.prepare(
        `INSERT INTO docentes (nombre, apellido, dni_hash, dni_cif, correo, telefono, estado)
         VALUES ('Ana', 'García', 'h', 'c', 'a@b', '1234', 'Licencia')`
      ).run().lastInsertRowid
      const r = mockedDb.prepare(
        `INSERT INTO docentes (nombre, apellido, dni_hash, dni_cif, correo, telefono, estado)
         VALUES ('Luis', 'Rodríguez', 'h2', 'c2', 'l@b', '4321', 'Disponible')`
      ).run().lastInsertRowid
      mockedDb.prepare('INSERT INTO docente_materias (docente_id, nombre_materia) VALUES (?, ?)').run(t, 'Matemática')
      mockedDb.prepare('INSERT INTO docente_materias (docente_id, nombre_materia) VALUES (?, ?)').run(r, 'Matemática')

      const m = materiaService.create({ cursoId, nombreMateria: 'Matemática', especialidad: 'Informática', docenteId: t })
      mockedDb.prepare('INSERT INTO docente_suplencias (materia_id, suplente_docente_id) VALUES (?, ?)')
        .run(m.materia_id, r)

      const found = materiaService.listAll().find(x => x.materia_id === m.materia_id)
      expect(found.docente_nombre).toBe('Ana')
      expect(found.docente_apellido).toBe('García')
      expect(found.docente_estado).toBe('Licencia')
      expect(found.reemplazo_id).toBe(r)
      expect(found.reemplazo_nombre).toBe('Luis')
      expect(found.reemplazo_apellido).toBe('Rodríguez')
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

  describe('asignación por competencia', () => {
    const habilitar = (docenteId, nombre) =>
      mockedDb.prepare(
        'INSERT INTO docente_materias (docente_id, nombre_materia) VALUES (?, ?)'
      ).run(docenteId, nombre)

    it('devuelve docentes_disponibles según la competencia', () => {
      const dId = mockedDb.prepare(
        "INSERT INTO docentes (nombre, apellido, dni_hash, dni_cif, telefono) VALUES ('Ana', 'García', 'h', 'e', '1234')"
      ).run().lastInsertRowid
      habilitar(dId, 'Matemática')
      const m = materiaService.create({ cursoId, nombreMateria: 'Matemática', especialidad: 'Informática' })
      const otro = materiaService.getById(m.materia_id)
      expect(otro.docentes_disponibles).toHaveLength(1)
      expect(otro.docentes_disponibles[0]).toMatchObject({ docente_id: dId, apellido: 'García' })
    })

    it('rechaza asignar un docente sin competencia', () => {
      const m = materiaService.create({ cursoId, nombreMateria: 'Química', especialidad: 'Informática' })
      const dId = mockedDb.prepare(
        "INSERT INTO docentes (nombre, apellido, dni_hash, dni_cif, telefono) VALUES ('Ana', 'García', 'h1', 'e1', '1234')"
      ).run().lastInsertRowid
      expect(() => materiaService.update(m.materia_id, { docenteId: dId }))
        .toThrow(new HttpError(400, 'El docente no puede dictar esta materia'))
    })

    it('acepta asignar un docente con competencia', () => {
      const m = materiaService.create({ cursoId, nombreMateria: 'Química', especialidad: 'Informática' })
      const dId = mockedDb.prepare(
        "INSERT INTO docentes (nombre, apellido, dni_hash, dni_cif, telefono) VALUES ('Ana', 'García', 'h2', 'e2', '1234')"
      ).run().lastInsertRowid
      habilitar(dId, 'Química')
      const updated = materiaService.update(m.materia_id, { docenteId: dId })
      expect(updated.docente_id).toBe(dId)
    })

    it('permite quitar el docente con null', () => {
      const m = materiaService.create({ cursoId, nombreMateria: 'Química', especialidad: 'Informática' })
      const dId = mockedDb.prepare(
        "INSERT INTO docentes (nombre, apellido, dni_hash, dni_cif, telefono) VALUES ('Ana', 'García', 'h3', 'e3', '1234')"
      ).run().lastInsertRowid
      habilitar(dId, 'Química')
      materiaService.update(m.materia_id, { docenteId: dId })
      const sinDocente = materiaService.update(m.materia_id, { docenteId: null })
      expect(sinDocente.docente_id).toBeNull()
    })
  })

  describe('setComisiones', () => {
    const habilitar = (docenteId, nombre) =>
      mockedDb.prepare(
        'INSERT INTO docente_materias (docente_id, nombre_materia) VALUES (?, ?)'
      ).run(docenteId, nombre)
    const crearDocente = (nombre) => mockedDb.prepare(
      "INSERT INTO docentes (nombre, apellido, dni_hash, dni_cif, telefono) VALUES (?, 'X', ?, ?, '1234')"
    ).run(nombre, `h_${nombre}`, `e_${nombre}`).lastInsertRowid

    it('rechaza comisiones para materias de Teoría', () => {
      const m = materiaService.create({ cursoId, nombreMateria: 'Matemática', especialidad: 'Info' })
      expect(() => materiaService.setComisiones(m.materia_id, [{ comision: 'A' }]))
        .toThrow(new HttpError(400, 'Solo las materias de Taller o Laboratorio admiten docentes por comisión'))
    })

    it('asigna docentes por comisión en una materia de Taller', () => {
      const m = materiaService.create({ cursoId, nombreMateria: 'Programación', especialidad: 'Info', tipo: 'Taller' })
      const a = crearDocente('Ana'); habilitar(a, 'Programación')
      const b = crearDocente('Luis'); habilitar(b, 'Programación')
      const result = materiaService.setComisiones(m.materia_id, [
        { comision: 'A', docente_id: a },
        { comision: 'B', docente_id: b },
      ])
      expect(result.comisiones).toHaveLength(2)
      expect(result.comisiones.map(c => c.comision)).toEqual(['A', 'B'])
      expect(result.comisiones[0]).toMatchObject({ docente_id: a, docente_nombre: 'Ana' })
      expect(result.comisiones[1]).toMatchObject({ docente_id: b, docente_nombre: 'Luis' })
    })

    it('validar que el docente tenga competencia', () => {
      const m = materiaService.create({ cursoId, nombreMateria: 'Programación', especialidad: 'Info', tipo: 'Laboratorio' })
      const a = crearDocente('Ana')
      expect(() => materiaService.setComisiones(m.materia_id, [{ comision: 'A', docente_id: a }]))
        .toThrow(new HttpError(400, 'El docente no puede dictar esta materia'))
    })

    it('rechaza comisiones duplicadas', () => {
      const m = materiaService.create({ cursoId, nombreMateria: 'Programación', especialidad: 'Info', tipo: 'Taller' })
      const a = crearDocente('Ana'); habilitar(a, 'Programación')
      expect(() => materiaService.setComisiones(m.materia_id, [
        { comision: 'A', docente_id: a },
        { comision: 'A', docente_id: a },
      ])).toThrow(/Comisión duplicada/)
    })

    it('permite comisión sin docente', () => {
      const m = materiaService.create({ cursoId, nombreMateria: 'Programación', especialidad: 'Info', tipo: 'Taller' })
      const result = materiaService.setComisiones(m.materia_id, [{ comision: 'A' }])
      expect(result.comisiones[0]).toMatchObject({ comision: 'A', docente_id: null })
    })

    it('rechaza comisiones con nombre distinto de A/B', () => {
      const m = materiaService.create({ cursoId, nombreMateria: 'Programación', especialidad: 'Info', tipo: 'Taller' })
      expect(() => materiaService.setComisiones(m.materia_id, [{ comision: 'Comisión C' }]))
        .toThrow(/Comisión inválida/)
    })
  })
})
