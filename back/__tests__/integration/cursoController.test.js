import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'

vi.mock('../../src/services/cursoService.js', () => ({
  cursoService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('../../src/middlewares/auth.js', () => ({
  authenticate: vi.fn((req, _res, next) => {
    req.usuario = { id: 1, rol: 'preceptor' }
    next()
  }),
}))

import createApp from '../../src/app.js'
import { cursoService } from '../../src/services/cursoService.js'
import { HttpError } from '../../src/utils/http-error.js'

const app = createApp()

beforeEach(() => {
  cursoService.list.mockReset()
  cursoService.create.mockReset()
  cursoService.update.mockReset()
  cursoService.remove.mockReset()
})

describe('GET /api/cursos', () => {
  it('devuelve 200 con la lista de cursos', async () => {
    cursoService.list.mockReturnValue([{ curso_id: 1, anio: 4, division: '1', especialidad: 'Informática', nombre: '4° 1° - Informática' }])
    const res = await request(app).get('/api/cursos').set('Authorization', 'Bearer x')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].nombre).toBe('4° 1° - Informática')
    expect(cursoService.list).toHaveBeenCalledWith()
  })
})

describe('POST /api/cursos', () => {
  it('devuelve 201 al crear un curso', async () => {
    cursoService.create.mockReturnValue({ curso_id: 5, anio: 1, division: '1', especialidad: '', turno: 'Mañana', nombre: '1° 1° (Mañana)' })
    const res = await request(app)
      .post('/api/cursos')
      .set('Authorization', 'Bearer x')
      .send({ anio: 1, division: '1', turno: 'Mañana' })
    expect(res.status).toBe(201)
    expect(res.body.curso_id).toBe(5)
    expect(res.body.nombre).toBe('1° 1° (Mañana)')
    expect(cursoService.create).toHaveBeenCalledWith({ anio: 1, division: '1', especialidad: undefined, turno: 'Mañana' })
  })

  it('devuelve 400 cuando faltan campos', async () => {
    const res = await request(app)
      .post('/api/cursos')
      .set('Authorization', 'Bearer x')
      .send({ anio: 1 })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'anio, division y turno requeridos' })
  })
})

describe('PUT /api/cursos/:id', () => {
  it('actualiza el curso y devuelve 200', async () => {
    cursoService.update.mockReturnValue({ curso_id: 2, anio: 4, division: '1', especialidad: 'Informática', turno: 'Tarde', nombre: '4° 1° - Informática (Tarde)' })
    const res = await request(app)
      .put('/api/cursos/2')
      .set('Authorization', 'Bearer x')
      .send({ turno: 'Tarde' })
    expect(res.status).toBe(200)
    expect(res.body.turno).toBe('Tarde')
    expect(cursoService.update).toHaveBeenCalledWith('2', { anio: undefined, division: undefined, especialidad: undefined, turno: 'Tarde' })
  })

  it('devuelve 400 sin campos', async () => {
    const res = await request(app)
      .put('/api/cursos/2')
      .set('Authorization', 'Bearer x')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'No hay campos para actualizar' })
  })
})

describe('DELETE /api/cursos/:id', () => {
  it('devuelve 200 al eliminar', async () => {
    cursoService.remove.mockReturnValue(undefined)
    const res = await request(app).delete('/api/cursos/2').set('Authorization', 'Bearer x')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ mensaje: 'Curso eliminado' })
    expect(cursoService.remove).toHaveBeenCalledWith('2')
  })

  it('propaga HttpError del servicio', async () => {
    cursoService.remove.mockImplementation(() => {
      throw new HttpError(403, 'Acceso denegado')
    })
    const res = await request(app).delete('/api/cursos/2').set('Authorization', 'Bearer x')
    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: 'Acceso denegado' })
  })
})
