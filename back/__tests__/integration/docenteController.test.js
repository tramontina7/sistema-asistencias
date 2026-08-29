import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'

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

vi.mock('../../src/services/ausenciaService.js', () => ({
  ausenciaService: {
    listar: vi.fn(),
    listarDocentes: vi.fn(),
    marcar: vi.fn(),
    quitar: vi.fn(),
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
import { docenteService } from '../../src/services/docenteService.js'
import { ausenciaService } from '../../src/services/ausenciaService.js'

const app = createApp()

beforeEach(() => {
  for (const fn of Object.values(docenteService)) fn.mockReset()
  for (const fn of Object.values(ausenciaService)) fn.mockReset()
})

describe('GET /api/docentes', () => {
  it('devuelve la lista de docentes', async () => {
    docenteService.list.mockReturnValue([{ docente_id: 1, apellido: 'García', dni: '55555555' }])
    const res = await request(app).get('/api/docentes').set('Authorization', 'Bearer x')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].dni).toBe('55555555')
  })
})

describe('POST /api/docentes', () => {
  it('crea un docente y devuelve 201', async () => {
    docenteService.create.mockReturnValue({ docente_id: 1, nombre: 'Ana', apellido: 'García', dni: '55555555' })
    const res = await request(app)
      .post('/api/docentes')
      .set('Authorization', 'Bearer x')
      .send({ nombre: 'Ana', apellido: 'García', dni: 55555555 })
    expect(res.status).toBe(201)
    expect(docenteService.create).toHaveBeenCalledWith({
      nombre: 'Ana', apellido: 'García', dni: 55555555, correo: undefined, telefono: undefined,
      puedeDictar: undefined, estado: undefined,
    })
  })
})

describe('PUT /api/docentes/:id', () => {
  it('actualiza y devuelve 200', async () => {
    docenteService.update.mockReturnValue({ docente_id: 2, nombre: 'Ana', apellido: 'Pérez' })
    const res = await request(app)
      .put('/api/docentes/2')
      .set('Authorization', 'Bearer x')
      .send({ apellido: 'Pérez' })
    expect(res.status).toBe(200)
    expect(res.body.apellido).toBe('Pérez')
    expect(docenteService.update).toHaveBeenCalledWith('2', {
      nombre: undefined, apellido: 'Pérez', dni: undefined, correo: undefined, telefono: undefined,
      puedeDictar: undefined, estado: undefined,
    })
  })
})

describe('DELETE /api/docentes/:id', () => {
  it('elimina y devuelve 200', async () => {
    docenteService.remove.mockReturnValue(undefined)
    const res = await request(app).delete('/api/docentes/2').set('Authorization', 'Bearer x')
    expect(res.status).toBe(200)
    expect(docenteService.remove).toHaveBeenCalledWith('2')
  })
})

describe('GET /api/docentes/:id/materias', () => {
  it('devuelve las materias del docente', async () => {
    docenteService.materias.mockReturnValue([{ materia_id: 1, nombre_materia: 'Matemática' }])
    const res = await request(app).get('/api/docentes/1/materias').set('Authorization', 'Bearer x')
    expect(res.status).toBe(200)
    expect(res.body[0].nombre_materia).toBe('Matemática')
  })
})

describe('GET /api/docentes/disponibilidad', () => {
  it('devuelve disponibilidad de docentes', async () => {
    docenteService.disponibilidad.mockReturnValue([{ docente_id: 1, estado: 'Disponible', materias: [] }])
    const res = await request(app).get('/api/docentes/disponibilidad').set('Authorization', 'Bearer x')
    expect(res.status).toBe(200)
    expect(res.body[0].estado).toBe('Disponible')
  })
})

describe('PUT /api/docentes/:id/estado', () => {
  it('cambia el estado del docente', async () => {
    docenteService.cambiarEstado.mockReturnValue({ docente_id: 1, estado: 'Licencia' })
    const res = await request(app)
      .put('/api/docentes/1/estado')
      .set('Authorization', 'Bearer x')
      .send({ estado: 'Licencia' })
    expect(res.status).toBe(200)
    expect(res.body.estado).toBe('Licencia')
    expect(docenteService.cambiarEstado).toHaveBeenCalledWith('1', 'Licencia')
  })
})

describe('PUT /api/docentes/reemplazos', () => {
  it('asigna un reemplazo y devuelve 201', async () => {
    docenteService.asignarReemplazo.mockReturnValue({ materia_id: 3, suplente_id: 2, comision: null })
    const res = await request(app)
      .put('/api/docentes/reemplazos')
      .set('Authorization', 'Bearer x')
      .send({ materia_id: 3, suplente_id: 2 })
    expect(res.status).toBe(201)
    expect(docenteService.asignarReemplazo).toHaveBeenCalledWith(3, 2, undefined)
  })

  it('asigna un reemplazo por comisión', async () => {
    docenteService.asignarReemplazo.mockReturnValue({ materia_id: 3, suplente_id: 2, comision: 'B' })
    const res = await request(app)
      .put('/api/docentes/reemplazos')
      .set('Authorization', 'Bearer x')
      .send({ materia_id: 3, suplente_id: 2, comision: 'B' })
    expect(res.status).toBe(201)
    expect(docenteService.asignarReemplazo).toHaveBeenCalledWith(3, 2, 'B')
  })
})

describe('DELETE /api/docentes/reemplazos/:materia_id', () => {
  it('quita un reemplazo', async () => {
    docenteService.quitarReemplazo.mockReturnValue({ mensaje: 'Suplente quitado' })
    const res = await request(app)
      .delete('/api/docentes/reemplazos/3')
      .set('Authorization', 'Bearer x')
    expect(res.status).toBe(200)
    expect(docenteService.quitarReemplazo).toHaveBeenCalledWith('3', undefined)
  })

  it('quita un reemplazo de una comisión', async () => {
    docenteService.quitarReemplazo.mockReturnValue({ mensaje: 'Suplente quitado' })
    const res = await request(app)
      .delete('/api/docentes/reemplazos/3?comision=B')
      .set('Authorization', 'Bearer x')
    expect(res.status).toBe(200)
    expect(docenteService.quitarReemplazo).toHaveBeenCalledWith('3', 'B')
  })
})