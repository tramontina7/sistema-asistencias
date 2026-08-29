import db from '../db/index.js'
import { HttpError } from '../utils/http-error.js'

const ESTADOS_PREVIA = ['Pendiente', 'Aprobada', 'Regularizada', 'En Curso']

export const previaService = {
  listPorCurso({ cursoId }) {
    return db.prepare(
      `SELECT p.previa_id, p.alumno_id, p.materia_id, p.docente_id,
              p.anio_cursada, p.estado, p.fecha_evaluacion, p.nota,
              al.nombre as alumno_nombre, al.apellido as alumno_apellido,
              m.nombre_materia,
              d.nombre as docente_nombre, d.apellido as docente_apellido
       FROM previas p
       JOIN alumnos al ON al.alumno_id = p.alumno_id
       JOIN materias m ON m.materia_id = p.materia_id
       LEFT JOIN docentes d ON d.docente_id = p.docente_id
       WHERE al.curso_id = ?
       ORDER BY al.apellido, al.nombre, m.nombre_materia`
    ).all(cursoId)
  },

  listPorAlumno({ alumnoId }) {
    return db.prepare(
      `SELECT p.previa_id, p.materia_id, p.docente_id,
              p.anio_cursada, p.estado, p.fecha_evaluacion, p.nota,
              m.nombre_materia, m.especialidad,
              d.nombre as docente_nombre, d.apellido as docente_apellido
       FROM previas p
       JOIN materias m ON m.materia_id = p.materia_id
       LEFT JOIN docentes d ON d.docente_id = p.docente_id
       WHERE p.alumno_id = ?
       ORDER BY p.anio_cursada, m.nombre_materia`
    ).all(alumnoId)
  },

  create({ alumnoId, materiaId, docenteId, anioCursada, estado }) {
    if (!alumnoId || !materiaId) throw new HttpError(400, 'alumno_id y materia_id requeridos')
    if (!anioCursada) throw new HttpError(400, 'anio_cursada requerido')
    if (!ESTADOS_PREVIA.includes(estado)) {
      throw new HttpError(400, `Estado inválido (valores: ${ESTADOS_PREVIA.join(', ')})`)
    }

    const alumno = db.prepare('SELECT alumno_id FROM alumnos WHERE alumno_id = ?').get(alumnoId)
    if (!alumno) throw new HttpError(404, 'Alumno no encontrado')

    const materia = db.prepare('SELECT materia_id FROM materias WHERE materia_id = ?').get(materiaId)
    if (!materia) throw new HttpError(404, 'Materia no encontrada')

    if (docenteId) {
      const docente = db.prepare('SELECT docente_id FROM docentes WHERE docente_id = ?').get(docenteId)
      if (!docente) throw new HttpError(404, 'Docente no encontrado')
    }

    const result = db.prepare(
      `INSERT INTO previas (alumno_id, materia_id, docente_id, anio_cursada, estado)
       VALUES (?, ?, ?, ?, ?)`
    ).run(alumnoId, materiaId, docenteId || null, anioCursada, estado)

    return this._getById(result.lastInsertRowid)
  },

  update(previaId, { estado, nota, fechaEvaluacion, docenteId }) {
    const exists = db.prepare('SELECT previa_id FROM previas WHERE previa_id = ?').get(previaId)
    if (!exists) throw new HttpError(404, 'Previa no encontrada')

    const updates = []
    const params = []

    if (estado !== undefined) {
      if (!ESTADOS_PREVIA.includes(estado)) throw new HttpError(400, 'Estado inválido')
      updates.push('estado = ?'); params.push(estado)
    }
    if (nota !== undefined) {
      updates.push('nota = ?'); params.push(nota)
    }
    if (fechaEvaluacion !== undefined) {
      updates.push('fecha_evaluacion = ?'); params.push(fechaEvaluacion || null)
    }
    if (docenteId !== undefined) {
      if (docenteId) {
        const docente = db.prepare('SELECT docente_id FROM docentes WHERE docente_id = ?').get(docenteId)
        if (!docente) throw new HttpError(404, 'Docente no encontrado')
      }
      updates.push('docente_id = ?'); params.push(docenteId || null)
    }

    if (updates.length === 0) throw new HttpError(400, 'Sin campos para actualizar')

    params.push(previaId)
    db.prepare(`UPDATE previas SET ${updates.join(', ')} WHERE previa_id = ?`).run(...params)
    return this._getById(previaId)
  },

  remove(previaId) {
    db.prepare('DELETE FROM previas WHERE previa_id = ?').run(previaId)
  },

  _getById(previaId) {
    return db.prepare(
      `SELECT p.*, m.nombre_materia,
              d.nombre as docente_nombre, d.apellido as docente_apellido
       FROM previas p
       JOIN materias m ON m.materia_id = p.materia_id
       LEFT JOIN docentes d ON d.docente_id = p.docente_id
       WHERE p.previa_id = ?`
    ).get(previaId)
  },
}
