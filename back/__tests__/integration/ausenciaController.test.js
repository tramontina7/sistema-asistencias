import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'

vi.mock('../../src/services/ausenciaService.js', () => ({
  ausenciaService: {
    listar: vi.fn(),
    listarDocentes: vi.fn(),
    marcar: vi.fn(),
    quitar: vi.fn(),
  },
}))

vi.mock('../../src/services/docenteService.js', () => ({
  docenteService: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    materias: vi.fn(),
    disponibilidad: vi.fn(),
    cambiarEstado: vi.fn(),
    asignarReemplazo: vi.fn(),
    quitarReemplazo: vi.fn(),
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
import { ausenciaService } from '../../src/services/ausenciaService.js'

const app = createApp()

beforeEach(() => {
  for (const fn of Object.values(ausenciaService)) fn.mockReset()
})

describe('GET /api/docentes/ausencias', () => {
  it('devuelve ausentes con bloques para la fecha', async () => {
    ausenciaService.listar.mockReturnValue([{ docente_id: 1, nombre: 'Roberto', apellido: 'Fernández', bloques: [] }])
    const res = await request(app)
      .get('/api/docentes/ausencias')
      .query({ fecha: '2026-08-24' })
      .set('Authorization', 'Bearer x')
    expect(res.status).toBe(200)
    expect(res.body[0].nombre).toBe('Roberto')
    expect(ausenciaService.listar).toHaveBeenCalledWith({ fecha: '2026-08-24' })
  })
})

describe('GET /api/docentes/ausencias/docentes', () => {
  it('devuelve los docentes con bandera ausente', async () => {
    ausenciaService.listarDocentes.mockReturnValue([{ docente_id: 1, nombre: 'Roberto', apellido: 'Fernández', ausente: true }])
    const res = await request(app)
      .get('/api/docentes/ausencias/docentes')
      .query({ fecha: '2026-08-24' })
      .set('Authorization', 'Bearer x')
    expect(res.status).toBe(200)
    expect(res.body[0].ausente).toBe(true)
  })
})

describe('PUT /api/docentes/ausencias', () => {
  it('marca una ausencia y devuelve 201', async () => {
    ausenciaService.marcar.mockReturnValue({ docente_id: 1, fecha: '2026-08-24' })
    const res = await request(app)
      .put('/api/docentes/ausencias')
      .set('Authorization', 'Bearer x')
      .send({ docente_id: 1, fecha: '2026-08-24' })
    expect(res.status).toBe(201)
    expect(ausenciaService.marcar).toHaveBeenCalledWith(1, '2026-08-24')
  })
})

describe('DELETE /api/docentes/ausencias', () => {
  it('quita una ausencia', async () => {
    ausenciaService.quitar.mockReturnValue({ message: 'Ausencia quitada' })
    const res = await request(app)
      .delete('/api/docentes/ausencias')
      .query({ docente_id: 1, fecha: '2026-08-24' })
      .set('Authorization', 'Bearer x')
    expect(res.status).toBe(200)
    expect(ausenciaService.quitar).toHaveBeenCalledWith('1', '2026-08-24')
  })
})
