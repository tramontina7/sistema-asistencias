import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'

vi.mock('../../src/services/retiroService.js', () => ({
  retiroService: {
    listarPresentesPorCurso: vi.fn(),
    registrar: vi.fn(),
  },
}))

vi.mock('../../src/services/tutorService.js', () => ({
  tutorService: {
    validarTutorPorAlumno: vi.fn(),
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
import { retiroService } from '../../src/services/retiroService.js'
import { tutorService } from '../../src/services/tutorService.js'

const app = createApp()

beforeEach(() => {
  for (const fn of Object.values(retiroService)) fn.mockReset()
  for (const fn of Object.values(tutorService)) fn.mockReset()
})

describe('GET /api/retiros/presentes', () => {
  it('devuelve los alumnos presentes del curso para la fecha', async () => {
    retiroService.listarPresentesPorCurso.mockReturnValue([
      { alumno_id: 1, nombre: 'Lucía', apellido: 'Pérez', comision: 'B', curso_nombre: '1ro 1ra Ciclo Básico' },
    ])
    const res = await request(app)
      .get('/api/retiros/presentes')
      .query({ curso_id: 1, fecha: '2026-08-28' })
      .set('Authorization', 'Bearer x')
    expect(res.status).toBe(200)
    expect(res.body[0].nombre).toBe('Lucía')
    expect(retiroService.listarPresentesPorCurso).toHaveBeenCalledWith({ cursoId: '1', fecha: '2026-08-28' })
  })
})

describe('POST /api/retiros', () => {
  it('valida el tutor y registra el retiro devolviendo 201', async () => {
    tutorService.validarTutorPorAlumno.mockReturnValue({ tutor_id: 1 })
    retiroService.registrar.mockReturnValue({ retiro_id: 10, alumno_id: 5, fecha: '2026-08-28' })
    const res = await request(app)
      .post('/api/retiros')
      .set('Authorization', 'Bearer x')
      .send({ alumnoId: 5, nombre: 'Pedro', apellido: 'Pérez', dni: '30000000', fecha: '2026-08-28', hora: '10:30' })
    expect(res.status).toBe(201)
    expect(tutorService.validarTutorPorAlumno).toHaveBeenCalledWith({
      alumnoId: 5, nombre: 'Pedro', apellido: 'Pérez', dni: '30000000',
    })
    expect(retiroService.registrar).toHaveBeenCalledWith({
      alumnoId: 5, tutorId: 1, fecha: '2026-08-28', hora: '10:30',
    })
  })
})
