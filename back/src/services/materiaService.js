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

function validarDocenteHabil(nombreMateria, docenteId) {
  const docente = db.prepare('SELECT docente_id FROM docentes WHERE docente_id = ?').get(docenteId)
  if (!docente) throw new HttpError(404, 'Docente no encontrado')

  const habil = db.prepare(
    'SELECT 1 FROM docente_materias WHERE docente_id = ? AND nombre_materia = ?'
  ).get(docenteId, nombreMateria)
  if (!habil) throw new HttpError(400, 'El docente no puede dictar esta materia')
}

function docentesDisponibles(nombreMateria) {
  return db.prepare(
    `SELECT d.docente_id, d.nombre, d.apellido
     FROM docente_materias dm
     JOIN docentes d ON d.docente_id = dm.docente_id
     WHERE dm.nombre_materia = ?
     ORDER BY d.apellido, d.nombre`
  ).all(nombreMateria)
}

function reemplazoDeMateria(materiaId) {
  const s = db.prepare(
    `SELECT s.suplente_docente_id as reemplazo_id,
            r.nombre as reemplazo_nombre, r.apellido as reemplazo_apellido
     FROM docente_suplencias s
     LEFT JOIN docentes r ON r.docente_id = s.suplente_docente_id
     WHERE s.materia_id = ? AND s.comision IS NULL`
  ).get(materiaId)
  return s
    ? { reemplazo_id: s.reemplazo_id, reemplazo_nombre: s.reemplazo_nombre, reemplazo_apellido: s.reemplazo_apellido }
    : { reemplazo_id: null, reemplazo_nombre: null, reemplazo_apellido: null }
}

function reemplazosPorMateriaIds(materiaIds) {
  if (materiaIds.length === 0) return new Map()
  const placeholders = materiaIds.map(() => '?').join(',')
  const filas = db.prepare(
    `SELECT s.materia_id, s.suplente_docente_id as reemplazo_id,
            r.nombre as reemplazo_nombre, r.apellido as reemplazo_apellido
     FROM docente_suplencias s
     LEFT JOIN docentes r ON r.docente_id = s.suplente_docente_id
     WHERE s.materia_id IN (${placeholders}) AND s.comision IS NULL`
  ).all(...materiaIds)
  const porMateria = new Map()
  for (const c of filas) porMateria.set(c.materia_id, c)
  return porMateria
}

function comisionesDeMateria(materiaId) {
  return db.prepare(
    `SELECT mc.materia_comision_id, mc.materia_id, mc.comision, mc.docente_id,
            d.nombre as docente_nombre, d.apellido as docente_apellido,
            d.estado as docente_estado,
            s.comision as suplencia_comision,
            s.suplente_docente_id as reemplazo_id,
            r.nombre as reemplazo_nombre, r.apellido as reemplazo_apellido
     FROM materia_comisiones mc
     LEFT JOIN docentes d ON d.docente_id = mc.docente_id
     LEFT JOIN docente_suplencias s ON s.materia_id = mc.materia_id AND s.comision = mc.comision
     LEFT JOIN docentes r ON r.docente_id = s.suplente_docente_id
     WHERE mc.materia_id = ?
     ORDER BY mc.comision`
  ).all(materiaId)
}

function mapearComisiones(filas) {
  return filas.map(c => ({
    materia_comision_id: c.materia_comision_id,
    comision: c.comision,
    docente_id: c.docente_id,
    docente_nombre: c.docente_nombre,
    docente_apellido: c.docente_apellido,
    docente_estado: c.docente_estado,
    reemplazo_id: c.reemplazo_id,
    reemplazo_nombre: c.reemplazo_nombre,
    reemplazo_apellido: c.reemplazo_apellido,
  }))
}

function comisionesPorMateriaIds(materiaIds) {
  if (materiaIds.length === 0) return new Map()
  const placeholders = materiaIds.map(() => '?').join(',')
  const filas = db.prepare(
    `SELECT mc.materia_comision_id, mc.materia_id, mc.comision, mc.docente_id,
            d.nombre as docente_nombre, d.apellido as docente_apellido,
            d.estado as docente_estado,
            s.suplente_docente_id as reemplazo_id,
            r.nombre as reemplazo_nombre, r.apellido as reemplazo_apellido
     FROM materia_comisiones mc
     LEFT JOIN docentes d ON d.docente_id = mc.docente_id
     LEFT JOIN docente_suplencias s ON s.materia_id = mc.materia_id AND s.comision = mc.comision
     LEFT JOIN docentes r ON r.docente_id = s.suplente_docente_id
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
      `SELECT m.materia_id, m.nombre_materia, m.especialidad, m.tipo, m.curso_id, m.docente_id,
              d.nombre as docente_nombre, d.apellido as docente_apellido,
              d.estado as docente_estado
       FROM materias m
       LEFT JOIN docentes d ON d.docente_id = m.docente_id
       WHERE m.curso_id = ?
       ORDER BY m.nombre_materia`
    ).all(cursoId)

    const porMateria = comisionesPorMateriaIds(rows.map(r => r.materia_id))
    const reemplazos = reemplazosPorMateriaIds(rows.map(r => r.materia_id))

    return rows.map(r => ({
      ...r,
      ...(reemplazos.get(r.materia_id) || { reemplazo_id: null, reemplazo_nombre: null, reemplazo_apellido: null }),
      comisiones: mapearComisiones(porMateria.get(r.materia_id) || []),
    }))
  },

  listAll() {
    const rows = db.prepare(
      `SELECT m.materia_id, m.nombre_materia, m.especialidad, m.tipo, m.curso_id, m.docente_id,
              d.nombre as docente_nombre, d.apellido as docente_apellido,
              d.estado as docente_estado,
              c.anio, c.division, c.especialidad as curso_especialidad, c.turno
       FROM materias m
       JOIN cursos c ON c.curso_id = m.curso_id
       LEFT JOIN docentes d ON d.docente_id = m.docente_id
       ORDER BY c.anio ASC, c.division, m.nombre_materia`
    ).all()

    const horarios = db.prepare(
      'SELECT horario_id, materia_id, dia_semana, hora_entrada, hora_salida, comision, docente_id FROM horarios'
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
        docente_id: h.docente_id,
      })
    }

    const comisiones = comisionesPorMateriaIds(rows.map(r => r.materia_id))
    const reemplazos = reemplazosPorMateriaIds(rows.map(r => r.materia_id))

    return rows.map(r => ({
      ...r,
      curso_nombre: formatNombre(r),
      horarios: porMateria.get(r.materia_id) || [],
      ...(reemplazos.get(r.materia_id) || { reemplazo_id: null, reemplazo_nombre: null, reemplazo_apellido: null }),
      comisiones: mapearComisiones(comisiones.get(r.materia_id) || []),
    }))
  },

  getById(materiaId) {
    const m = db.prepare(
      `SELECT m.materia_id, m.nombre_materia, m.especialidad, m.tipo, m.curso_id, m.docente_id,
              d.nombre as docente_nombre, d.apellido as docente_apellido,
              d.estado as docente_estado,
              c.anio, c.division, c.especialidad as curso_especialidad, c.turno
       FROM materias m
       LEFT JOIN docentes d ON d.docente_id = m.docente_id
       JOIN cursos c ON c.curso_id = m.curso_id
       WHERE m.materia_id = ?`
    ).get(materiaId)
    if (!m) throw new HttpError(404, 'Materia no encontrada')

    const curso_nombre = formatNombre(m)

    const horarios = db.prepare(
      'SELECT horario_id, dia_semana, hora_entrada, hora_salida, comision, docente_id FROM horarios WHERE materia_id = ?'
    ).all(materiaId)

    return {
      ...m,
      ...reemplazoDeMateria(materiaId),
      curso_nombre,
      horarios,
      comisiones: mapearComisiones(comisionesDeMateria(materiaId)),
      docentes_disponibles: docentesDisponibles(m.nombre_materia),
    }
  },

  create({ cursoId, nombreMateria, especialidad, tipo, docenteId }) {
    if (!cursoId) throw new HttpError(400, 'curso_id requerido')
    if (!nombreMateria || !String(nombreMateria).trim()) throw new HttpError(400, 'nombre_materia requerido')
    if (!especialidad || !String(especialidad).trim()) throw new HttpError(400, 'especialidad requerida')

    const tipoFinal = tipo || 'Teoría'
    validarTipo(tipoFinal)
    const nombreFinal = String(nombreMateria).trim()

    const curso = db.prepare('SELECT curso_id FROM cursos WHERE curso_id = ?').get(cursoId)
    if (!curso) throw new HttpError(404, 'Curso no encontrado')

    if (docenteId) validarDocenteHabil(nombreFinal, docenteId)

    const result = db.prepare(
      'INSERT INTO materias (nombre_materia, especialidad, tipo, curso_id, docente_id) VALUES (?, ?, ?, ?, ?)'
    ).run(nombreFinal, String(especialidad).trim(), tipoFinal, cursoId, docenteId || null)

    return this.getById(result.lastInsertRowid)
  },

  update(materiaId, { nombreMateria, especialidad, tipo, docenteId }) {
    const exists = db.prepare('SELECT materia_id, nombre_materia FROM materias WHERE materia_id = ?').get(materiaId)
    if (!exists) throw new HttpError(404, 'Materia no encontrada')

    const updates = []
    const params = []

    let nombreFinal = exists.nombre_materia

    if (nombreMateria !== undefined) {
      if (!String(nombreMateria).trim()) throw new HttpError(400, 'nombre_materia requerido')
      nombreFinal = String(nombreMateria).trim()
      updates.push('nombre_materia = ?'); params.push(nombreFinal)
    }
    if (especialidad !== undefined) {
      updates.push('especialidad = ?'); params.push(String(especialidad).trim())
    }
    if (tipo !== undefined) {
      throw new HttpError(400, 'El tipo de una materia es inmutable')
    }
    if (docenteId !== undefined) {
      if (docenteId) validarDocenteHabil(nombreFinal, docenteId)
      updates.push('docente_id = ?'); params.push(docenteId || null)
    }

    if (updates.length === 0) throw new HttpError(400, 'Sin campos para actualizar')

    params.push(materiaId)
    db.prepare(`UPDATE materias SET ${updates.join(', ')} WHERE materia_id = ?`).run(...params)
    return this.getById(materiaId)
  },

  setHorarios(materiaId, horarios) {
    const exists = db.prepare('SELECT materia_id, nombre_materia FROM materias WHERE materia_id = ?').get(materiaId)
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
      if (h.docente_id) validarDocenteHabil(exists.nombre_materia, h.docente_id)
    }

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM horarios WHERE materia_id = ?').run(materiaId)
      const insert = db.prepare(
        'INSERT INTO horarios (materia_id, dia_semana, hora_entrada, hora_salida, comision, docente_id) VALUES (?, ?, ?, ?, ?, ?)'
      )
      for (const h of horarios) {
        insert.run(materiaId, h.dia_semana, h.hora_entrada, h.hora_salida, h.comision || null, h.docente_id || null)
      }
    })
    tx()
    return this.getById(materiaId)
  },

  setComisiones(materiaId, comisiones) {
    const materia = db.prepare(
      'SELECT materia_id, nombre_materia, tipo FROM materias WHERE materia_id = ?'
    ).get(materiaId)
    if (!materia) throw new HttpError(404, 'Materia no encontrada')
    if (materia.tipo === 'Teoría') {
      throw new HttpError(400, 'Solo las materias de Taller o Laboratorio admiten docentes por comisión')
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
      if (c.docente_id) validarDocenteHabil(materia.nombre_materia, c.docente_id)
    }

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM materia_comisiones WHERE materia_id = ?').run(materiaId)
      const insert = db.prepare(
        'INSERT INTO materia_comisiones (materia_id, comision, docente_id) VALUES (?, ?, ?)'
      )
      for (const c of comisiones) {
        insert.run(materiaId, String(c.comision).trim(), c.docente_id || null)
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
