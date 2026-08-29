import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'

vi.mock('../../src/services/alumnoService.js', () => ({
  alumnoService: {
    list: vi.fn(),
    getById: vi.fn(),
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
  authenticateAlumno: vi.fn((_req, _res, next) => next()),
}))

import createApp from '../../src/app.js'
import { alumnoService } from '../../src/services/alumnoService.js'
import { HttpError } from '../../src/utils/http-error.js'

const app = createApp()
const AUTH = { Authorization: 'Bearer x' }

beforeEach(() => {
  for (const fn of ['list', 'getById', 'create', 'update', 'remove']) {
    alumnoService[fn].mockReset()
  }
})

describe('GET /api/alumnos', () => {
  it('devuelve 200 con la lista filtrada', async () => {
    alumnoService.list.mockReturnValue([{ alumno_id: 1, dni: '40213456' }])
    const res = await request(app).get('/api/alumnos').query({ curso_id: '1', q: 'juan' }).set(AUTH)
    expect(res.status).toBe(200)
    expect(alumnoService.list).toHaveBeenCalledWith({ cursoId: '1', comision: undefined, q: 'juan' })
    expect(res.body).toHaveLength(1)
  })
})

describe('GET /api/alumnos/:id', () => {
  it('devuelve 200 con el alumno', async () => {
    alumnoService.getById.mockReturnValue({ alumno_id: 7, dni: '40213456' })
    const res = await request(app).get('/api/alumnos/7').set(AUTH)
    expect(res.status).toBe(200)
    expect(res.body.dni).toBe('40213456')
  })

  it('devuelve 404 si no existe (HttpError)', async () => {
    alumnoService.getById.mockImplementation(() => {
      throw new HttpError(404, 'Alumno no encontrado')
    })
    const res = await request(app).get('/api/alumnos/99').set(AUTH)
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Alumno no encontrado' })
  })
})

describe('POST /api/alumnos', () => {
  it('devuelve 201 al crear', async () => {
    alumnoService.create.mockReturnValue({ alumno_id: 1, dni: '40213456' })
    const res = await request(app)
      .post('/api/alumnos')
      .set(AUTH)
      .send({ nombre: 'Ana', apellido: 'López', dni: '40213456', curso_id: 1, comision: 'A' })
    expect(res.status).toBe(201)
    expect(alumnoService.create).toHaveBeenCalledWith({ nombre: 'Ana', apellido: 'López', dni: '40213456', cursoId: 1, comision: 'A' })
  })

  it('devuelve 400 cuando faltan campos', async () => {
    const res = await request(app).post('/api/alumnos').set(AUTH).send({ nombre: 'Ana' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Todos los campos son requeridos' })
  })

  it('devuelve 409 ante DNI duplicado', async () => {
    alumnoService.create.mockImplementation(() => {
      throw new HttpError(409, 'Ya existe un alumno con ese DNI')
    })
    const res = await request(app)
      .post('/api/alumnos')
      .set(AUTH)
      .send({ nombre: 'Ana', apellido: 'López', dni: '40213456', curso_id: 1, comision: 'A' })
    expect(res.status).toBe(409)
  })
})

describe('PUT /api/alumnos/:id', () => {
  it('devuelve 200 al actualizar', async () => {
    const res = await request(app)
      .put('/api/alumnos/1')
      .set(AUTH)
      .send({ nombre: 'Ana María' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ mensaje: 'Alumno actualizado' })
    expect(alumnoService.update).toHaveBeenCalled()
  })

  it('propaga 404 del servicio', async () => {
    alumnoService.update.mockImplementation(() => {
      throw new HttpError(404, 'Alumno no encontrado')
    })
    const res = await request(app).put('/api/alumnos/99').set(AUTH).send({ nombre: 'X' })
    expect(res.status).toBe(404)
  })

  it('propaga 400 del servicio (sin campos)', async () => {
    alumnoService.update.mockImplementation(() => {
      throw new HttpError(400, 'Sin campos para actualizar')
    })
    const res = await request(app).put('/api/alumnos/1').set(AUTH).send({})
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/alumnos/:id', () => {
  it('devuelve 200 al eliminar', async () => {
    const res = await request(app).delete('/api/alumnos/1').set(AUTH)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ mensaje: 'Alumno eliminado' })
    expect(alumnoService.remove).toHaveBeenCalledWith('1')
  })
})
