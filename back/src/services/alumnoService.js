import db from '../db/index.js'
import bcrypt from 'bcryptjs'
import { encrypt, decrypt } from '../utils/crypto.js'
import { HttpError } from '../utils/http-error.js'
import { formatNombre } from './cursoService.js'

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

  perfil(alumnoId) {
    const alumno = db.prepare(
      `${BASE_SELECT} WHERE alumno_id = ?`
    ).get(alumnoId)
    if (!alumno) throw new HttpError(404, 'Alumno no encontrado')

    const curso = db.prepare(
      'SELECT curso_id, anio, division, especialidad, turno FROM cursos WHERE curso_id = ?'
    ).get(alumno.curso_id)

    const ultimas = db.prepare(
      `SELECT a.asistencia_id, a.fecha, a.estado, a.motivo, a.hora_ingreso, a.motivo_tarde,
              m.materia_id, m.nombre_materia
       FROM asistencias a
       JOIN materias m ON m.materia_id = a.materia_id
       WHERE a.alumno_id = ?
       ORDER BY a.fecha DESC, a.asistencia_id DESC
       LIMIT 5`
    ).all(alumnoId)

    const totales = db.prepare(
      `SELECT
         COUNT(*) AS total,
         COUNT(CASE WHEN estado = 'Presente' THEN 1 END) AS presentes,
         COUNT(CASE WHEN estado = 'Ausente' THEN 1 END) AS ausencias,
         COUNT(CASE WHEN estado = 'Tarde' THEN 1 END) AS tardanzas,
         COUNT(CASE WHEN estado = 'Justificado' THEN 1 END) AS justificados
       FROM asistencias
       WHERE alumno_id = ?`
    ).get(alumnoId)

    return {
      ...toPublic(alumno),
      curso: curso ? { curso_id: curso.curso_id, nombre: formatNombre(curso), especialidad: curso.especialidad, turno: curso.turno } : null,
      ultimas,
      totales: totales || { total: 0, presentes: 0, ausencias: 0, tardanzas: 0, justificados: 0 },
    }
  },

  create({ nombre, apellido, dni, cursoId, comision }) {
    if (!nombre || !apellido || !dni || !cursoId || !comision) {
      throw new HttpError(400, 'Todos los campos son requeridos')
    }

    const dniText = dni.toString()
    const dniHash = bcrypt.hashSync(dniText, 10)
    
    // Verificar duplicado comparando con bcrypt (hash determinista no es posible con salt aleatorio)
    const existentes = db.prepare('SELECT dni_hash FROM alumnos').all()
    const duplicate = existentes.some(r => bcrypt.compareSync(dniText, r.dni_hash))
    if (duplicate) throw new HttpError(409, 'Ya existe un alumno con ese DNI')

    const curso = db.prepare('SELECT curso_id FROM cursos WHERE curso_id = ?').get(cursoId)
    if (!curso) throw new HttpError(404, 'Curso no encontrado')

    const result = db.prepare(
      `INSERT INTO alumnos (nombre, apellido, dni_hash, dni_cif, curso_id, comision)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(nombre, apellido, dniHash, encrypt(dniText), cursoId, comision)

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
      const dniHash = bcrypt.hashSync(dniText, 10)
      updates.push('dni_hash = ?', 'dni_cif = ?')
      params.push(dniHash, encrypt(dniText))
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
