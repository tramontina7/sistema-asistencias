import db from '../db/index.js'
import { encrypt, decrypt } from '../utils/crypto.js'
import { HttpError } from '../utils/http-error.js'

const BASE_SELECT =
  'SELECT alumno_id, nombre, apellido, dni_cif, curso_id, comision FROM alumnos'

function toPublic(row) {
  if (!row) return null
  return { ...row, dni: decrypt(row.dni_cif), dni_cif: undefined }
}

export const alumnoService = {
  list({ cursoId, comision, q }) {
    let sql = `${BASE_SELECT} WHERE 1=1`
    const params = []

    if (cursoId) {
      sql += ' AND curso_id = ?'
      params.push(cursoId)
    }
    if (comision) {
      sql += ' AND comision = ?'
      params.push(comision)
    }
    if (q) {
      sql += ' AND (nombre LIKE ? OR apellido LIKE ?)'
      params.push(`%${q}%`, `%${q}%`)
    }

    sql += ' ORDER BY apellido, nombre'
    return db.prepare(sql).all(...params).map(toPublic)
  },

  getById(alumnoId) {
    const row = db.prepare(
      `${BASE_SELECT} WHERE alumno_id = ?`
    ).get(alumnoId)
    if (!row) throw new HttpError(404, 'Alumno no encontrado')
    return toPublic(row)
  },

  create({ nombre, apellido, dni, cursoId, comision }) {
    if (!nombre || !apellido || !dni || !cursoId || !comision) {
      throw new HttpError(400, 'Todos los campos son requeridos')
    }

    const dniText = dni.toString()
    const duplicate = db.prepare('SELECT dni_cif FROM alumnos').all()
      .some(r => decrypt(r.dni_cif) === dniText)
    if (duplicate) throw new HttpError(409, 'Ya existe un alumno con ese DNI')

    const curso = db.prepare('SELECT curso_id FROM cursos WHERE curso_id = ?').get(cursoId)
    if (!curso) throw new HttpError(404, 'Curso no encontrado')

    const result = db.prepare(
      `INSERT INTO alumnos (nombre, apellido, dni_hash, dni_cif, curso_id, comision)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(nombre, apellido, encrypt(dniText), encrypt(dniText), cursoId, comision)

    return {
      alumno_id: result.lastInsertRowid,
      nombre,
      apellido,
      dni: dniText,
      curso_id: cursoId,
      comision,
    }
  },

  update(alumnoId, { nombre, apellido, dni, cursoId, comision }) {
    const existing = db.prepare(
      'SELECT alumno_id FROM alumnos WHERE alumno_id = ?'
    ).get(alumnoId)
    if (!existing) throw new HttpError(404, 'Alumno no encontrado')

    const updates = []
    const params = []
    if (nombre !== undefined) { updates.push('nombre = ?'); params.push(nombre) }
    if (apellido !== undefined) { updates.push('apellido = ?'); params.push(apellido) }
    if (dni !== undefined) {
      const dniText = dni.toString()
      updates.push('dni_hash = ?', 'dni_cif = ?')
      params.push(encrypt(dniText), encrypt(dniText))
    }
    if (cursoId !== undefined) { updates.push('curso_id = ?'); params.push(cursoId) }
    if (comision !== undefined) { updates.push('comision = ?'); params.push(comision) }

    if (updates.length === 0) throw new HttpError(400, 'Sin campos para actualizar')

    params.push(alumnoId)
    db.prepare(`UPDATE alumnos SET ${updates.join(', ')} WHERE alumno_id = ?`).run(...params)
  },

  remove(alumnoId) {
    db.prepare('DELETE FROM alumnos WHERE alumno_id = ?').run(alumnoId)
  },
}
