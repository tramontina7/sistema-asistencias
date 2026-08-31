import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'

vi.mock('../../src/services/authService.js', () => ({
  authService: {
    login: vi.fn(),
    me: vi.fn(),
    loginAlumno: vi.fn(),
  },
}))

vi.mock('../../src/middlewares/auth.js', () => ({
  authenticate: vi.fn((req, _res, next) => {
    req.usuario = { id: 1, username: 'preceptor1', rol: 'preceptor' }
    next()
  }),
  authenticateAlumno: vi.fn((_req, _res, next) => next()),
}))

import createApp from '../../src/app.js'
import { authService } from '../../src/services/authService.js'
import { authenticate } from '../../src/middlewares/auth.js'
import { HttpError } from '../../src/utils/http-error.js'

const app = createApp()

beforeEach(() => {
  authService.login.mockReset()
  authService.me.mockReset()
  authService.loginAlumno.mockReset()
  authenticate.mockImplementation((req, _res, next) => {
    req.usuario = { id: 1, username: 'preceptor1', rol: 'preceptor' }
    next()
  })
})

describe('POST /api/auth/login', () => {
  it('devuelve 200 con token y usuario', async () => {
    authService.login.mockReturnValue({
      token: 'jwt-token',
      usuario: { id: 1, username: 'preceptor1', rol: 'preceptor' },
    })

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'preceptor1', password: 'preceptor123' })

    expect(res.status).toBe(200)
    expect(res.body.token).toBe('jwt-token')
    expect(res.body.usuario.username).toBe('preceptor1')
    expect(authService.login).toHaveBeenCalledWith({ username: 'preceptor1', password: 'preceptor123' })
  })

  it('devuelve 400 cuando faltan campos (HttpError capturado)', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'preceptor1' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Usuario y contraseña requeridos' })
  })

  it('propaga 401 cuando el servicio lanza HttpError', async () => {
    authService.login.mockImplementation(() => {
      throw new HttpError(401, 'Credenciales inválidas')
    })
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'x', password: 'y' })
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'Credenciales inválidas' })
  })

  it('devuelve 500 ante errores inesperados del servicio', async () => {
    authService.login.mockImplementation(() => {
      throw new Error('boom')
    })
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'x', password: 'y' })
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Error interno del servidor' })
  })
})

describe('GET /api/auth/me', () => {
  it('devuelve 200 con los datos del usuario autenticado', async () => {
    authService.me.mockReturnValue({ id: 1, username: 'preceptor1', rol: 'preceptor' })
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer x')
    expect(res.status).toBe(200)
    expect(res.body.username).toBe('preceptor1')
  })

  it('devuelve 401 cuando no hay token (middleware autentica falla)', async () => {
    authenticate.mockImplementation((_req, _res, next) => next(new HttpError(401, 'Token requerido')))
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'Token requerido' })
  })
})

describe('POST /api/auth/alumno/login', () => {
  it('devuelve 200 con token y datos de alumno', async () => {
    authService.loginAlumno.mockReturnValue({
      token: 'alumno-jwt',
      alumno: { id: 1, nombre: 'Ana', apellido: 'López', curso_id: 2 },
    })

    const res = await request(app)
      .post('/api/auth/alumno/login')
      .send({ nombre: 'Ana', apellido: 'López', dni: '40000001' })

    expect(res.status).toBe(200)
    expect(res.body.token).toBe('alumno-jwt')
    expect(res.body.alumno.curso_id).toBe(2)
    expect(authService.loginAlumno).toHaveBeenCalledWith({ nombre: 'Ana', apellido: 'López', dni: '40000001' })
  })

  it('devuelve 400 cuando faltan campos', async () => {
    const res = await request(app).post('/api/auth/alumno/login').send({ nombre: 'Ana' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Nombre, apellido y DNI son requeridos' })
  })

  it('propaga 401 cuando el servicio lanza HttpError', async () => {
    authService.loginAlumno.mockImplementation(() => {
      throw new HttpError(401, 'Datos incorrectos. Verificá tu nombre, apellido y DNI.')
    })
    const res = await request(app)
      .post('/api/auth/alumno/login')
      .send({ nombre: 'Ana', apellido: 'López', dni: '999' })
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'Datos incorrectos. Verificá tu nombre, apellido y DNI.' })
  })
})