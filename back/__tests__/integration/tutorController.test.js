import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'

vi.mock('../../src/services/tutorService.js', () => ({
  tutorService: {
    list: vi.fn(),
    listarPorAlumno: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('../../src/services/retiroService.js', () => ({
  retiroService: {
    listarPresentesPorCurso: vi.fn(),
    registrar: vi.fn(),
  },
}))

vi.mock('../../src/middlewares/auth.js', () => ({
  authenticate: vi.fn((req, _res, next) => {
    req.usuario = { id: 1, rol: 'preceptor' }
    next()
  }),
  authenticateAlumno: vi.fn((_req, _res, next) => next()),
}))

import createApp from '../../src/app.js'
import { tutorService } from '../../src/services/tutorService.js'

const app = createApp()

beforeEach(() => {
  for (const fn of Object.values(tutorService)) fn.mockReset()
})

describe('GET /api/retiros/tutores', () => {
  it('lista todos los tutores', async () => {
    tutorService.list.mockReturnValue([{ tutor_id: 1, nombre: 'Pedro', apellido: 'Pérez' }])
    const res = await request(app).get('/api/retiros/tutores').set('Authorization', 'Bearer x')
    expect(res.status).toBe(200)
    expect(res.body[0].nombre).toBe('Pedro')
    expect(tutorService.list).toHaveBeenCalled()
  })

  it('lista los tutores de un alumno cuando se pasa alumno_id', async () => {
    tutorService.listarPorAlumno.mockReturnValue([{ tutor_id: 1, nombre: 'Pedro' }])
    const res = await request(app).get('/api/retiros/tutores?alumno_id=5').set('Authorization', 'Bearer x')
    expect(res.status).toBe(200)
    expect(tutorService.listarPorAlumno).toHaveBeenCalledWith(5)
  })
})

describe('GET /api/retiros/tutores/:id', () => {
  it('devuelve un tutor', async () => {
    tutorService.getById.mockReturnValue({ tutor_id: 1, nombre: 'Pedro' })
    const res = await request(app).get('/api/retiros/tutores/1').set('Authorization', 'Bearer x')
    expect(res.status).toBe(200)
    expect(tutorService.getById).toHaveBeenCalledWith(1)
  })
})

describe('POST /api/retiros/tutores', () => {
  it('crea un tutor devolviendo 201', async () => {
    tutorService.create.mockReturnValue({ tutor_id: 3, nombre: 'Ana' })
    const res = await request(app)
      .post('/api/retiros/tutores')
      .set('Authorization', 'Bearer x')
      .send({ nombre: 'Ana', apellido: 'López', dni: '44444444', vinculos: [{ alumno_id: 1, parentesco: 'Madre' }] })
    expect(res.status).toBe(201)
    expect(tutorService.create).toHaveBeenCalledWith({
      nombre: 'Ana', apellido: 'López', dni: '44444444', telefono: undefined,
      vinculos: [{ alumno_id: 1, parentesco: 'Madre' }],
    })
  })
})

describe('PUT /api/retiros/tutores/:id', () => {
  it('actualiza un tutor', async () => {
    tutorService.update.mockReturnValue({ tutor_id: 1, nombre: 'Pedro' })
    const res = await request(app)
      .put('/api/retiros/tutores/1')
      .set('Authorization', 'Bearer x')
      .send({ nombre: 'Pedro', telefono: '5555-5555' })
    expect(res.status).toBe(200)
    expect(tutorService.update).toHaveBeenCalledWith(1, { nombre: 'Pedro', telefono: '5555-5555' })
  })
})

describe('DELETE /api/retiros/tutores/:id', () => {
  it('elimina un tutor', async () => {
    tutorService.remove.mockReturnValue({ mensaje: 'Tutor eliminado' })
    const res = await request(app).delete('/api/retiros/tutores/1').set('Authorization', 'Bearer x')
    expect(res.status).toBe(200)
    expect(tutorService.remove).toHaveBeenCalledWith(1)
  })
})
