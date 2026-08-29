import db from '../db/index.js'
import { HttpError } from '../utils/http-error.js'

const TURNOS_VALIDOS = ['Mañana', 'Tarde', 'Vespertino', 'Noche']

const ORDINAL_ANIO = { 1: 'ro', 2: 'do', 3: 'ro', 4: 'to', 5: 'to', 6: 'to', 7: 'mo' }
const ORDINAL_DIVISION = { 1: 'ra', 2: 'da', 3: 'ra', 4: 'ta', 5: 'ta', 6: 'ta', 7: 'ma', 8: 'va', 9: 'na', 10: 'ma' }

export function ordinal(num, map, fallback) {
  const n = Number(num)
  return map[n] ? `${n}${map[n]}` : fallback
}

export function formatNombre({ anio, division }) {
  const a = ordinal(anio, ORDINAL_ANIO, String(anio))
  const d = ordinal(division, ORDINAL_DIVISION, String(division))
  return `${a} ${d}`
}

export const cursoService = {
  mapear(rows) {
    return rows.map(r => ({ ...r, nombre: formatNombre(r) }))
  },

  list() {
    const rows = db.prepare(
      `SELECT curso_id, anio, division, especialidad, turno
       FROM cursos ORDER BY anio ASC, division ASC, especialidad`
    ).all()
    return this.mapear(rows)
  },

  create({ anio, division, especialidad, turno }) {
    const anioNum = Number(anio)
    if (!Number.isInteger(anioNum) || anioNum < 1 || anioNum > 7) {
      throw new HttpError(400, 'Año inválido (1 a 7)')
    }
    if (!division || !String(division).trim()) {
      throw new HttpError(400, 'División requerida')
    }
    if (!TURNOS_VALIDOS.includes(turno)) {
      throw new HttpError(400, `Turno inválido (valores: ${TURNOS_VALIDOS.join(', ')})`)
    }

    const result = db.prepare(
      'INSERT INTO cursos (anio, division, especialidad, turno) VALUES (?, ?, ?, ?)'
    ).run(anioNum, String(division).trim(), especialidad || '', turno)

    return this.getById(result.lastInsertRowid)
  },

  update(cursoId, { anio, division, especialidad, turno }) {
    const campos = []
    const params = []

    if (anio !== undefined) {
      const v = Number(anio)
      if (!Number.isInteger(v) || v < 1 || v > 7) throw new HttpError(400, 'Año inválido (1 a 7)')
      campos.push('anio = ?'); params.push(v)
    }
    if (division !== undefined) {
      if (!String(division).trim()) throw new HttpError(400, 'División requerida')
      campos.push('division = ?'); params.push(String(division).trim())
    }
    if (especialidad !== undefined) {
      campos.push('especialidad = ?'); params.push(especialidad || '')
    }
    if (turno !== undefined) {
      if (!TURNOS_VALIDOS.includes(turno)) throw new HttpError(400, 'Turno inválido')
      campos.push('turno = ?'); params.push(turno)
    }

    if (campos.length === 0) throw new HttpError(400, 'No hay campos para actualizar')

    const exists = db.prepare('SELECT curso_id FROM cursos WHERE curso_id = ?').get(cursoId)
    if (!exists) throw new HttpError(404, 'Curso no encontrado')

    params.push(cursoId)
    db.prepare(`UPDATE cursos SET ${campos.join(', ')} WHERE curso_id = ?`).run(...params)

    return this.getById(cursoId)
  },

  getById(cursoId) {
    const row = db.prepare(
      'SELECT curso_id, anio, division, especialidad, turno FROM cursos WHERE curso_id = ?'
    ).get(cursoId)
    if (!row) return null
    return { ...row, nombre: formatNombre(row) }
  },

  remove(cursoId) {
    db.prepare('DELETE FROM cursos WHERE curso_id = ?').run(cursoId)
  },
}
