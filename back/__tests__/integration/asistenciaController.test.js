import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'

vi.mock('../../src/services/asistenciaService.js', () => ({
  asistenciaService: {
    ESTADOS_MANUALES: ['Presente', 'Ausente'],
    tomar: vi.fn(),
    list: vi.fn(),
    updateEstado: vi.fn(),
    registrarQr: vi.fn(),
  },
}))

vi.mock('../../src/middlewares/auth.js', () => ({
  authenticate: vi.fn((req, _res, next) => {
    req.usuario = { id: 1, rol: 'preceptor' }
    next()
  }),
}))

import createApp from '../../src/app.js'
import { asistenciaService } from '../../src/services/asistenciaService.js'
import { fechaLocal } from '../../src/utils/fecha.js'
import { HttpError } from '../../src/utils/http-error.js'

const app = createApp()
const AUTH = { Authorization: 'Bearer x' }

beforeEach(() => {
  for (const fn of ['tomar', 'list', 'updateEstado']) {
    asistenciaService[fn].mockReset()
  }
})

describe('POST /api/asistencias/tomar', () => {
  const hoy = fechaLocal()

  it('devuelve 200 al registrar', async () => {
    const res = await request(app)
      .post('/api/asistencias/tomar')
      .set(AUTH)
      .send({ materia_id: 1, fecha: hoy, asistencias: [{ alumno_id: 1, estado: 'Presente' }] })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ mensaje: 'Asistencia registrada' })
    expect(asistenciaService.tomar).toHaveBeenCalledWith(expect.objectContaining({ materiaId: 1, fecha: hoy, asistencias: [{ alumno_id: 1, estado: 'Presente' }] }))
  })

  it('devuelve 400 si falta materia_id', async () => {
    const res = await request(app).post('/api/asistencias/tomar').set(AUTH).send({ fecha: hoy, asistencias: [] })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'materia_id, fecha y asistencias requeridos' })
  })

  it('devuelve 400 si la fecha no es la de hoy', async () => {
    const res = await request(app)
      .post('/api/asistencias/tomar')
      .set(AUTH)
      .send({ materia_id: 1, fecha: '2024-09-02', asistencias: [] })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Solo se puede tomar la asistencia del día actual' })
  })
})

describe('GET /api/asistencias', () => {
  it('devuelve 200 con la lista', async () => {
    asistenciaService.list.mockReturnValue([{ asistencia_id: 1, estado: 'Presente' }])
    const res = await request(app).get('/api/asistencias').query({ materia_id: '1', fecha: '2024-09-02' }).set(AUTH)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })

  it('devuelve 400 sin materia_id/fecha', async () => {
    const res = await request(app).get('/api/asistencias').query({ materia_id: '1' }).set(AUTH)
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/asistencias/:id', () => {
  it('devuelve 200 al actualizar estado', async () => {
    const res = await request(app).put('/api/asistencias/5').set(AUTH).send({ estado: 'Ausente' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ mensaje: 'Asistencia actualizada' })
    expect(asistenciaService.updateEstado).toHaveBeenCalledWith('5', {
      estado: 'Ausente',
      motivo: undefined,
      horaIngreso: undefined,
      motivoTarde: undefined,
    })
  })

  it('devuelve 400 sin estado', async () => {
    const res = await request(app).put('/api/asistencias/5').set(AUTH).send({})
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Estado requerido' })
  })
})
