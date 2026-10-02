import { describe, it, expect } from 'vitest'
import {
  ESQUEMA_ESPERADO,
  bdConEsquemaDeLaApp,
  columnasReales,
} from '../helpers/esquemaEsperado.js'

describe('esquema esperado', () => {
  it('declara las 7 tablas del dominio', () => {
    expect(Object.keys(ESQUEMA_ESPERADO).sort()).toEqual([
      'alumnos', 'asistencias', 'cursos', 'horarios',
      'materia_comisiones', 'materias', 'preceptores',
    ])
  })

  it('cada tabla del snapshot tiene las columnas que declara el DDL de la app', () => {
    const db = bdConEsquemaDeLaApp()
    try {
      for (const [tabla, esperadas] of Object.entries(ESQUEMA_ESPERADO)) {
        expect(columnasReales(db, tabla), `columnas de ${tabla}`).toEqual(esperadas)
      }
    } finally {
      db.close()
    }
  })

  it('el snapshot no declara tablas que la app no crea', () => {
    const db = bdConEsquemaDeLaApp()
    try {
      const reales = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all()
        .map(r => r.name)
        .sort()
      expect(reales).toEqual(Object.keys(ESQUEMA_ESPERADO).sort())
    } finally {
      db.close()
    }
  })

  it('cada tabla declara su clave primaria', () => {
    const pk = {
      preceptores: 'preceptor_id',
      cursos: 'curso_id',
      alumnos: 'alumno_id',
      materias: 'materia_id',
      horarios: 'horario_id',
      materia_comisiones: 'materia_comision_id',
      asistencias: 'asistencia_id',
    }
    for (const [tabla, columna] of Object.entries(pk)) {
      expect(ESQUEMA_ESPERADO[tabla], `${tabla}.${columna}`).toContain(columna)
    }
  })

  it('los servicios no dependen de columnas que el snapshot no declara', () => {
    // Columnas que los servicios leen por nombre en sus consultas.
    const usadasPorServicios = {
      alumnos: ['dni_hash', 'dni_cif', 'curso_id', 'comision', 'nombre', 'apellido'],
      asistencias: ['alumno_id', 'materia_id', 'fecha', 'estado', 'hora_ingreso', 'motivo_tarde'],
      preceptores: ['password_hash', 'activo', 'turno'],
      cursos: ['anio', 'division', 'especialidad', 'turno'],
      materias: ['nombre_materia', 'especialidad', 'tipo'],
      horarios: ['dia_semana', 'hora_entrada', 'hora_salida', 'comision'],
    }
    for (const [tabla, columnas] of Object.entries(usadasPorServicios)) {
      for (const c of columnas) {
        expect(ESQUEMA_ESPERADO[tabla], `${tabla}.${c}`).toContain(c)
      }
    }
  })
})
