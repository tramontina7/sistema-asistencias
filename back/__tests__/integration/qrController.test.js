import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'

vi.mock('../../src/services/qrService.js', () => ({
  qrService: {
    generarTokens: vi.fn(),
    escanear: vi.fn(),
    tokensPorCurso: vi.fn(),
  },
}))

vi.mock('../../src/services/asistenciaService.js', () => ({
  asistenciaService: {
    registrarQr: vi.fn(),
    materiaDelMomento: vi.fn(),
  },
}))

vi.mock('../../src/middlewares/auth.js', () => ({
  authenticate: vi.fn((req, _res, next) => {
    req.usuario = { id: 1, rol: 'preceptor' }
    next()
  }),
}))

import createApp from '../../src/app.js'
import { qrService } from '../../src/services/qrService.js'
import { asistenciaService } from '../../src/services/asistenciaService.js'

const app = createApp()
const AUTH = { Authorization: 'Bearer x' }

beforeEach(() => {
  for (const fn of ['generarTokens', 'escanear', 'tokensPorCurso']) {
    qrService[fn].mockReset()
  }
  asistenciaService.registrarQr.mockReset()
  asistenciaService.materiaDelMomento.mockReset()
})

describe('POST /api/qr/token', () => {
  it('devuelve 200 con tokens (incluye url)', async () => {
    qrService.generarTokens.mockReturnValue([{ alumno_id: 1, nombre: 'Ana', apellido: 'López', token: 'qr-token' }])
    const res = await request(app).post('/api/qr/token').set(AUTH).send({ alumno_id: 1 })
    expect(res.status).toBe(200)
    expect(res.body.tokens).toHaveLength(1)
    expect(res.body.tokens[0].url).toContain('/scan?token=qr-token')
  })

  it('devuelve 400 sin alumno_id', async () => {
    const res = await request(app).post('/api/qr/token').set(AUTH).send({})
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'alumno_id requerido' })
  })
})

describe('POST /api/qr/escanear', () => {
  it('devuelve 200 y registra la asistencia', async () => {
    qrService.escanear.mockReturnValue({
      alumno: { alumno_id: 1, nombre: 'Ana', apellido: 'López', curso_id: 1 },
      fecha: '2024-09-02',
    })
    asistenciaService.registrarQr.mockReturnValue({ estado: 'Tarde', hora: '08:30:00' })
    const res = await request(app).post('/api/qr/escanear').set(AUTH).send({ token: 'qr-token', materia_id: 1 })
    expect(res.status).toBe(200)
    expect(res.body.mensaje).toBe('Asistencia registrada')
    expect(res.body.estado).toBe('Tarde')
    expect(res.body.hora).toBe('08:30:00')
    expect(asistenciaService.registrarQr).toHaveBeenCalledWith(expect.objectContaining({ alumnoId: 1, materiaId: 1, fecha: '2024-09-02' }))
  })

  it('devuelve 400 sin token', async () => {
    const res = await request(app).post('/api/qr/escanear').set(AUTH).send({ materia_id: 1 })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'token requerido' })
  })

  it('detecta la materia automáticamente cuando falta materia_id', async () => {
    qrService.escanear.mockReturnValue({
      alumno: { alumno_id: 1, nombre: 'Ana', apellido: 'López', curso_id: 7 },
      fecha: '2024-09-02',
    })
    asistenciaService.materiaDelMomento.mockReturnValue({ materia_id: 5, nombre_materia: 'Matemática' })
    asistenciaService.registrarQr.mockReturnValue({ estado: 'Tarde', hora: '08:30:00' })

    const res = await request(app).post('/api/qr/escanear').set(AUTH).send({ token: 'qr-token' })
    expect(res.status).toBe(200)
    expect(asistenciaService.materiaDelMomento).toHaveBeenCalledWith({ cursoId: 7 })
    expect(asistenciaService.registrarQr).toHaveBeenCalledWith(expect.objectContaining({ alumnoId: 1, materiaId: 5, fecha: '2024-09-02' }))
    expect(res.body.materia_nombre).toBe('Matemática')
  })
})

describe('POST /api/qr/tokens-por-curso', () => {
  it('devuelve 200 con los tokens del curso', async () => {
    qrService.tokensPorCurso.mockReturnValue([{ id: 1, token: 't' }])
    const res = await request(app).post('/api/qr/tokens-por-curso').set(AUTH).send({ curso_id: 1 })
    expect(res.status).toBe(200)
    expect(res.body.tokens).toHaveLength(1)
  })

  it('devuelve 400 sin curso_id', async () => {
    const res = await request(app).post('/api/qr/tokens-por-curso').set(AUTH).send({})
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'curso_id requerido' })
  })
})
