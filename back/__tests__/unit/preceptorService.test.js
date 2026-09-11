import { describe, it, expect, beforeEach } from 'vitest'
import { setupTestDb, resetDb, seedPreceptor } from '../helpers/inMemoryDb.js'

const mockedDb = setupTestDb()

import { preceptorService, asegurarPreceptores } from '../../src/services/preceptorService.js'

beforeEach(() => {
  resetDb(mockedDb)
})

describe('crear', () => {
  it('crea un preceptor y devuelve sus datos sin credenciales', () => {
    const creado = preceptorService.create({
      username: 'jperez', password: 'Clave123!', nombre: 'Juan', apellido: 'Pérez',
      dni: '12345678', telefono: '11-2345-6789', turno: 'Tarde',
    })
    expect(creado.preceptor_id).toBeTruthy()
    expect(creado).toMatchObject({ username: 'jperez', nombre: 'Juan', apellido: 'Pérez', turno: 'Tarde', activo: 1 })
    expect(creado.password_hash).toBeUndefined()
    expect(creado.dni_cif).toBeUndefined()
  })

  it('lanza error si falta un campo obligatorio', () => {
    expect(() => preceptorService.create({
      username: 'jperez', nombre: 'Juan', apellido: 'Pérez', dni: '12345678', telefono: '11',
    })).toThrow(/password/)
  })

  it('lanza error si el username ya existe', () => {
    seedPreceptor(mockedDb, { username: 'test' })
    expect(() => preceptorService.create({
      username: 'test', password: 'x', nombre: 'A', apellido: 'B', dni: '11', telefono: '11',
    })).toThrow(/Ya existe un preceptor con el username/)
  })

  it('lanza error si el turno es inválido', () => {
    expect(() => preceptorService.create({
      username: 'j', password: 'x', nombre: 'A', apellido: 'B', dni: '11', telefono: '11', turno: 'Vespertino',
    })).toThrow(/Turno inválido/)
  })

  it('permite turno vacío (null)', () => {
    const creado = preceptorService.create({
      username: 'j', password: 'x', nombre: 'A', apellido: 'B', dni: '11', telefono: '11', turno: '',
    })
    expect(creado.turno).toBeNull()
  })
})

describe('list', () => {
  it('devuelve los preceptores sin credenciales', () => {
    seedPreceptor(mockedDb, { username: 'a' })
    seedPreceptor(mockedDb, { username: 'b' })
    const lista = preceptorService.list()
    expect(lista).toHaveLength(2)
    expect(lista[0].password_hash).toBeUndefined()
    expect(lista[0].dni_cif).toBeUndefined()
  })
})

describe('update', () => {
  it('actualiza datos y turno', () => {
    const id = seedPreceptor(mockedDb, { username: 'test' })
    const actualizado = preceptorService.update(id, { nombre: 'Nuevo', turno: 'Noche' })
    expect(actualizado.nombre).toBe('Nuevo')
    expect(actualizado.turno).toBe('Noche')
  })

  it('actualiza por username', () => {
    seedPreceptor(mockedDb, { username: 'test' })
    const actualizado = preceptorService.update('test', { telefono: '99-9999' })
    expect(actualizado.telefono).toBe('99-9999')
  })

  it('cambia el password re-hasheando', () => {
    const id = seedPreceptor(mockedDb, { username: 'test', password: 'orig' })
    preceptorService.update(id, { password: 'nueva' })
    const row = mockedDb.prepare('SELECT password_hash FROM preceptores WHERE preceptor_id = ?').get(id)
    expect(row.password_hash).not.toBe('hash_orig')
  })

  it('lanza error si el preceptor no existe', () => {
    expect(() => preceptorService.update(999, { nombre: 'X' })).toThrow(/no encontrado/)
  })

  it('lanza error sin campos', () => {
    const id = seedPreceptor(mockedDb, { username: 'test' })
    expect(() => preceptorService.update(id, {})).toThrow(/No hay campos/)
  })
})

describe('setActivo', () => {
  it('desactiva y reactiva un preceptor', () => {
    const id = seedPreceptor(mockedDb, { username: 'test' })
    seedPreceptor(mockedDb, { username: 'otro' })
    const desactivado = preceptorService.setActivo(id, false)
    expect(desactivado.activo).toBe(0)
    const reactivado = preceptorService.setActivo(id, true)
    expect(reactivado.activo).toBe(1)
  })

  it('no permite desactivar al último preceptor activo', () => {
    const id = seedPreceptor(mockedDb, { username: 'test' })
    expect(() => preceptorService.setActivo(id, false)).toThrow(/último preceptor activo/)
  })

  it('permite desactivar cuando hay más de un activo', () => {
    const a = seedPreceptor(mockedDb, { username: 'a' })
    seedPreceptor(mockedDb, { username: 'b' })
    const desactivado = preceptorService.setActivo(a, false)
    expect(desactivado.activo).toBe(0)
  })

  it('lanza error si no existe', () => {
    expect(() => preceptorService.setActivo(999, false)).toThrow(/no encontrado/)
  })
})

describe('remove', () => {
  it('elimina por id y devuelve la fila eliminada', () => {
    const id = seedPreceptor(mockedDb, { username: 'a' })
    seedPreceptor(mockedDb, { username: 'b' })
    const eliminado = preceptorService.remove(id)
    expect(eliminado).toMatchObject({ username: 'a', activo: 1 })
    expect(mockedDb.prepare('SELECT COUNT(*) c FROM preceptores WHERE preceptor_id = ?').get(id).c).toBe(0)
  })

  it('elimina por username', () => {
    seedPreceptor(mockedDb, { username: 'a' })
    seedPreceptor(mockedDb, { username: 'b' })
    preceptorService.remove('a')
    expect(mockedDb.prepare('SELECT COUNT(*) c FROM preceptores WHERE username = ?').get('a').c).toBe(0)
  })

  it('lanza error si no existe', () => {
    expect(() => preceptorService.remove(999)).toThrow(/no encontrado/)
  })

  it('no permite eliminar al último preceptor activo', () => {
    const id = seedPreceptor(mockedDb, { username: 'test' })
    expect(() => preceptorService.remove(id)).toThrow(/último preceptor activo/)
  })

  it('permite eliminar cuando hay más de un activo', () => {
    const a = seedPreceptor(mockedDb, { username: 'a' })
    seedPreceptor(mockedDb, { username: 'b' })
    const eliminado = preceptorService.remove(a)
    expect(eliminado.activo).toBe(1)
    expect(mockedDb.prepare('SELECT COUNT(*) c FROM preceptores').get().c).toBe(1)
  })
})

describe('asegurarPreceptores', () => {
  it('inserta preceptores idempotente por username', async () => {
    await asegurarPreceptores([
      { username: 'a', password: 'x', nombre: 'A', apellido: 'B', dni: '11', telefono: '11', turno: 'Mañana' },
      { username: 'a', password: 'x', nombre: 'A', apellido: 'B', dni: '11', telefono: '11', turno: 'Mañana' },
    ])
    expect(mockedDb.prepare('SELECT COUNT(*) c FROM preceptores').get().c).toBe(1)
  })
})
