import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'

vi.mock('../../src/services/reporteService.js', () => ({
  reporteService: {
    generar: vi.fn(),
    matrizPorMateria: vi.fn(),
  },
}))

vi.mock('../../src/middlewares/auth.js', () => ({
  authenticate: vi.fn((req, _res, next) => {
    req.usuario = { id: 1, rol: 'preceptor' }
    next()
  }),
}))

import createApp from '../../src/app.js'
import { reporteService } from '../../src/services/reporteService.js'
import { HttpError } from '../../src/utils/http-error.js'

const app = createApp()
const AUTH = { Authorization: 'Bearer x' }

beforeEach(() => {
  reporteService.generar.mockReset()
  reporteService.matrizPorMateria.mockReset()
})

describe('GET /api/reportes', () => {
  it('devuelve 200 con el reporte generado', async () => {
    reporteService.generar.mockReturnValue({ desde: '2024-09-02', hasta: '2024-09-02', dias: [], resumen: [], detalle: [] })
    const res = await request(app).get('/api/reportes').query({ curso_id: '1', fecha: '2024-09-02' }).set(AUTH)
    expect(res.status).toBe(200)
    expect(reporteService.generar).toHaveBeenCalledWith({ cursoId: '1', tipo: 'dia', fecha: '2024-09-02' })
    expect(res.body.desde).toBe('2024-09-02')
  })

  it('usa el tipo por defecto dia', async () => {
    reporteService.generar.mockReturnValue({})
    const res = await request(app).get('/api/reportes').query({ curso_id: '1', fecha: '2024-09-02' }).set(AUTH)
    expect(res.status).toBe(200)
    expect(reporteService.generar).toHaveBeenCalledWith({ cursoId: '1', tipo: 'dia', fecha: '2024-09-02' })
  })

  it('pasa el cuatrimestre indicado', async () => {
    reporteService.generar.mockReturnValue({})
    const res = await request(app)
      .get('/api/reportes')
      .query({ curso_id: '1', tipo: 'cuatrimestre', fecha: '2024-05-15', cuatrimestre: '2' })
      .set(AUTH)
    expect(res.status).toBe(200)
    expect(reporteService.generar)
      .toHaveBeenCalledWith({ cursoId: '1', tipo: 'cuatrimestre', fecha: '2024-05-15', cuatrimestre: '2' })
  })

  it('devuelve 400 sin curso_id o fecha', async () => {
    const res = await request(app).get('/api/reportes').query({ curso_id: '1' }).set(AUTH)
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'curso_id y fecha requeridos' })
  })

  it('propaga HttpError del servicio', async () => {
    reporteService.generar.mockImplementation(() => {
      throw new HttpError(500, 'error de cálculo')
    })
    const res = await request(app).get('/api/reportes').query({ curso_id: '1', fecha: '2024-09-02' }).set(AUTH)
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'error de cálculo' })
  })
})

describe('GET /api/reportes/materia', () => {
  it('devuelve 200 con la matriz por materia', async () => {
    reporteService.matrizPorMateria.mockReturnValue({ materias: [], alumnos: [] })
    const res = await request(app)
      .get('/api/reportes/materia')
      .query({ curso_id: '1' })
      .set(AUTH)
    expect(res.status).toBe(200)
    expect(reporteService.matrizPorMateria).toHaveBeenCalledWith({ cursoId: '1' })
  })

  it('devuelve 400 sin curso_id', async () => {
    const res = await request(app).get('/api/reportes/materia').set(AUTH)
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'curso_id requerido' })
  })
})
