import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'

vi.mock('../../src/services/qrService.js', () => ({
  qrService: {
    alumno: vi.fn(),
    escanear: vi.fn(),
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
  authenticateAlumno: vi.fn((req, _res, next) => {
    req.alumno = { tipo: 'alumno', alumno_id: 99, nombre: 'Ana', apellido: 'López' }
    next()
  }),
}))

import createApp from '../../src/app.js'
import { qrService } from '../../src/services/qrService.js'
import { asistenciaService } from '../../src/services/asistenciaService.js'

const app = createApp()
const AUTH = { Authorization: 'Bearer x' }

beforeEach(() => {
  qrService.alumno.mockReset()
  qrService.escanear.mockReset()
  asistenciaService.registrarQr.mockReset()
  asistenciaService.materiaDelMomento.mockReset()
})

describe('GET /api/qr/alumno', () => {
  it('devuelve 200 con el token QR del alumno autenticado', async () => {
    qrService.alumno.mockReturnValue({
      token: 'qr-token',
      alumno: { alumno_id: 99, nombre: 'Ana', apellido: 'López', curso_id: 1 },
    })
    const res = await request(app).get('/api/qr/alumno').set({ Authorization: 'Bearer alumno-token' })
    expect(res.status).toBe(200)
    expect(res.body.token).toBe('qr-token')
    expect(qrService.alumno).toHaveBeenCalledWith(99)
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
