import db from '../db/index.js'
import { HttpError } from '../utils/http-error.js'
import { formatNombre } from './cursoService.js'

const DIAS_VALIDOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const TIPOS_VALIDOS = ['Teoría', 'Taller', 'Laboratorio']

function validarDia(dia) {
  if (!DIAS_VALIDOS.includes(dia)) {
    throw new HttpError(400, `Día inválido (valores: ${DIAS_VALIDOS.join(', ')})`)
  }
}

function validarHora(hora) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
    throw new HttpError(400, 'Formato de hora inválido (HH:MM)')
  }
}

function validarTipo(tipo) {
  if (!TIPOS_VALIDOS.includes(tipo)) {
    throw new HttpError(400, `Tipo inválido (valores: ${TIPOS_VALIDOS.join(', ')})`)
  }
}

function comisionesDeMateria(materiaId) {
  return db.prepare(
    `SELECT mc.materia_comision_id, mc.materia_id, mc.comision
     FROM materia_comisiones mc
     WHERE mc.materia_id = ?
     ORDER BY mc.comision`
  ).all(materiaId)
}

function mapearComisiones(filas) {
  return filas.map(c => ({
    materia_comision_id: c.materia_comision_id,
    comision: c.comision,
  }))
}

function comisionesPorMateriaIds(materiaIds) {
  if (materiaIds.length === 0) return new Map()
  const placeholders = materiaIds.map(() => '?').join(',')
  const filas = db.prepare(
    `SELECT mc.materia_comision_id, mc.materia_id, mc.comision
     FROM materia_comisiones mc
     WHERE mc.materia_id IN (${placeholders})
     ORDER BY mc.materia_id, mc.comision`
  ).all(...materiaIds)

  const porMateria = new Map()
  for (const c of filas) {
    if (!porMateria.has(c.materia_id)) porMateria.set(c.materia_id, [])
    porMateria.get(c.materia_id).push(c)
  }
  return porMateria
}

export const materiaService = {
  list({ cursoId }) {
    const rows = db.prepare(
      `SELECT m.materia_id, m.nombre_materia, m.especialidad, m.tipo, m.curso_id
       FROM materias m
       WHERE m.curso_id = ?
       ORDER BY m.nombre_materia`
    ).all(cursoId)

    const porMateria = comisionesPorMateriaIds(rows.map(r => r.materia_id))

    return rows.map(r => ({
      ...r,
      comisiones: mapearComisiones(porMateria.get(r.materia_id) || []),
    }))
  },

  listAll() {
    const rows = db.prepare(
      `SELECT m.materia_id, m.nombre_materia, m.especialidad, m.tipo, m.curso_id,
              c.anio, c.division, c.especialidad as curso_especialidad, c.turno
       FROM materias m
       JOIN cursos c ON c.curso_id = m.curso_id
       ORDER BY c.anio ASC, c.division, m.nombre_materia`
    ).all()

    const horarios = db.prepare(
      'SELECT horario_id, materia_id, dia_semana, hora_entrada, hora_salida, comision FROM horarios'
    ).all()

    const porMateria = new Map()
    for (const h of horarios) {
      if (!porMateria.has(h.materia_id)) porMateria.set(h.materia_id, [])
      porMateria.get(h.materia_id).push({
        horario_id: h.horario_id,
        dia_semana: h.dia_semana,
        hora_entrada: h.hora_entrada,
        hora_salida: h.hora_salida,
        comision: h.comision,
      })
    }

    const comisiones = comisionesPorMateriaIds(rows.map(r => r.materia_id))

    return rows.map(r => ({
      ...r,
      curso_nombre: formatNombre(r),
      horarios: porMateria.get(r.materia_id) || [],
      comisiones: mapearComisiones(comisiones.get(r.materia_id) || []),
    }))
  },

  getById(materiaId) {
    const m = db.prepare(
      `SELECT m.materia_id, m.nombre_materia, m.especialidad, m.tipo, m.curso_id,
              c.anio, c.division, c.especialidad as curso_especialidad, c.turno
       FROM materias m
       JOIN cursos c ON c.curso_id = m.curso_id
       WHERE m.materia_id = ?`
    ).get(materiaId)
    if (!m) throw new HttpError(404, 'Materia no encontrada')

    const curso_nombre = formatNombre(m)

    const horarios = db.prepare(
      'SELECT horario_id, dia_semana, hora_entrada, hora_salida, comision FROM horarios WHERE materia_id = ?'
    ).all(materiaId)

    return {
      ...m,
      curso_nombre,
      horarios,
      comisiones: mapearComisiones(comisionesDeMateria(materiaId)),
    }
  },

  create({ cursoId, nombreMateria, especialidad, tipo }) {
    if (!cursoId) throw new HttpError(400, 'curso_id requerido')
    if (!nombreMateria || !String(nombreMateria).trim()) throw new HttpError(400, 'nombre_materia requerido')
    if (!especialidad || !String(especialidad).trim()) throw new HttpError(400, 'especialidad requerida')

    const tipoFinal = tipo || 'Teoría'
    validarTipo(tipoFinal)
    const nombreFinal = String(nombreMateria).trim()

    const curso = db.prepare('SELECT curso_id FROM cursos WHERE curso_id = ?').get(cursoId)
    if (!curso) throw new HttpError(404, 'Curso no encontrado')

    const result = db.prepare(
      'INSERT INTO materias (nombre_materia, especialidad, tipo, curso_id) VALUES (?, ?, ?, ?)'
    ).run(nombreFinal, String(especialidad).trim(), tipoFinal, cursoId)

    return this.getById(result.lastInsertRowid)
  },

  update(materiaId, { nombreMateria, especialidad, tipo }) {
    const exists = db.prepare('SELECT materia_id, nombre_materia FROM materias WHERE materia_id = ?').get(materiaId)
    if (!exists) throw new HttpError(404, 'Materia no encontrada')

    const updates = []
    const params = []

    if (nombreMateria !== undefined) {
      if (!String(nombreMateria).trim()) throw new HttpError(400, 'nombre_materia requerido')
      updates.push('nombre_materia = ?'); params.push(String(nombreMateria).trim())
    }
    if (especialidad !== undefined) {
      updates.push('especialidad = ?'); params.push(String(especialidad).trim())
    }
    if (tipo !== undefined) {
      throw new HttpError(400, 'El tipo de una materia es inmutable')
    }

    if (updates.length === 0) throw new HttpError(400, 'Sin campos para actualizar')

    params.push(materiaId)
    db.prepare(`UPDATE materias SET ${updates.join(', ')} WHERE materia_id = ?`).run(...params)
    return this.getById(materiaId)
  },

  setHorarios(materiaId, horarios) {
    const exists = db.prepare('SELECT materia_id FROM materias WHERE materia_id = ?').get(materiaId)
    if (!exists) throw new HttpError(404, 'Materia no encontrada')
    if (!Array.isArray(horarios)) throw new HttpError(400, 'horarios debe ser un arreglo')

    for (const h of horarios) {
      if (!h.dia_semana || !h.hora_entrada || !h.hora_salida) {
        throw new HttpError(400, 'Cada horario debe incluir dia_semana, hora_entrada y hora_salida')
      }
      validarDia(h.dia_semana)
      validarHora(h.hora_entrada)
      validarHora(h.hora_salida)
      if (h.hora_salida <= h.hora_entrada) {
        throw new HttpError(400, 'hora_salida debe ser posterior a hora_entrada')
      }
      if (h.comision !== undefined && h.comision !== null && h.comision !== 'A' && h.comision !== 'B') {
        throw new HttpError(400, `Comisión inválida '${h.comision}'; solo se admiten 'A' y 'B'`)
      }
    }

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM horarios WHERE materia_id = ?').run(materiaId)
      const insert = db.prepare(
        'INSERT INTO horarios (materia_id, dia_semana, hora_entrada, hora_salida, comision) VALUES (?, ?, ?, ?, ?)'
      )
      for (const h of horarios) {
        insert.run(materiaId, h.dia_semana, h.hora_entrada, h.hora_salida, h.comision || null)
      }
    })
    tx()
    return this.getById(materiaId)
  },

  setComisiones(materiaId, comisiones) {
    const materia = db.prepare(
      'SELECT materia_id, tipo FROM materias WHERE materia_id = ?'
    ).get(materiaId)
    if (!materia) throw new HttpError(404, 'Materia no encontrada')
    if (materia.tipo === 'Teoría') {
      throw new HttpError(400, 'Solo las materias de Taller o Laboratorio admiten comisiones')
    }
    if (!Array.isArray(comisiones)) throw new HttpError(400, 'comisiones debe ser un arreglo')

    const vistas = new Set()
    for (const c of comisiones) {
      if (!c.comision || !String(c.comision).trim()) {
        throw new HttpError(400, 'Cada comisión debe incluir un nombre')
      }
      const nombre = String(c.comision).trim()
      if (nombre !== 'A' && nombre !== 'B') {
        throw new HttpError(400, `Comisión inválida '${nombre}'; solo se admiten 'A' y 'B'`)
      }
      if (vistas.has(nombre)) throw new HttpError(400, `Comisión duplicada: ${nombre}`)
      vistas.add(nombre)
    }

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM materia_comisiones WHERE materia_id = ?').run(materiaId)
      const insert = db.prepare(
        'INSERT INTO materia_comisiones (materia_id, comision) VALUES (?, ?)'
      )
      for (const c of comisiones) {
        insert.run(materiaId, String(c.comision).trim())
      }
    })
    tx()
    return this.getById(materiaId)
  },

  catalogo() {
    return db.prepare(
      'SELECT DISTINCT especialidad, nombre_materia FROM materias ORDER BY especialidad, nombre_materia'
    ).all()
  },

  remove(materiaId) {
    db.prepare('DELETE FROM materias WHERE materia_id = ?').run(materiaId)
  },
}